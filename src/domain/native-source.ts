import type {
  PluginContentItem as ContentItem,
  CollectionSchemaInfo,
} from "emdash";
import type { EventRecord } from "./event";
import { nativeEntryToEventRecord } from "./event-expansion";
import { normalizeVenueRecord, type NormalizedVenue } from "./venue-adapter";
import { referenceTarget, eventSchema } from "./native-references";
import { safeHttpUrl } from "./venue";
import {
  listEvents,
  listVenuesById,
  MAX_EVENT_SCAN,
  EventScanLimitError,
  type EventualContext,
} from "../storage";

export async function nativeSchema(
  ctx: EventualContext,
): Promise<CollectionSchemaInfo | undefined> {
  if (!ctx.schema || !ctx.content) return undefined;
  const schemas = await ctx.schema.listCollections();
  const schema = schemas.find((item) => item.slug === "events");
  if (schema && !schema.fields?.some((field) => field.slug === "start"))
    throw new Error("The events collection is not an Eventual schema.");
  return schema;
}
export async function listNative(
  ctx: EventualContext,
  collection: string,
  published = false,
): Promise<ContentItem[]> {
  const result: ContentItem[] = [];
  let cursor: string | undefined;
  const seen = new Set<string>();
  do {
    const page = await ctx.content!.list(collection, {
      limit: 100,
      cursor,
      ...(published ? { where: { status: "published" as const } } : {}),
    });
    result.push(...page.items);
    if (result.length > MAX_EVENT_SCAN)
      throw new EventScanLimitError(MAX_EVENT_SCAN);
    if (!page.hasMore) break;
    if (!page.cursor || seen.has(page.cursor))
      throw new Error("Incomplete or repeated native content cursor.");
    seen.add(page.cursor);
    cursor = page.cursor;
  } while (true);
  return result;
}
export async function readEventSource(ctx: EventualContext, through?: string) {
  const schema = await nativeSchema(ctx);
  if (!schema) {
    return {
      native: false,
      events: await listEvents(ctx, {
        published: true,
        ...(through ? { through } : {}),
      }),
      schema,
    };
  }
  const entries = await listNative(ctx, "events", true);
  const events: EventRecord[] = [];
  for (const entry of entries) {
    const event = nativeEntryToEventRecord(entry);
    if (!event) throw new Error("Invalid native event " + entry.id);
    if (event.published) events.push(event);
  }
  return { native: true, events, schema };
}
export async function resolveEventVenues(
  ctx: EventualContext,
  events: EventRecord[],
  schema?: CollectionSchemaInfo,
): Promise<Map<string, NormalizedVenue>> {
  const result = new Map<string, NormalizedVenue>();
  const ids = [
    ...new Set(
      events.flatMap((event) => (event.venueId ? [event.venueId] : [])),
    ),
  ];
  if (!schema) {
    const stored = await listVenuesById(ctx, ids);
    for (const [id, value] of stored) {
      const venue = normalizeVenueRecord(value);
      if (venue) result.set(id, venue);
    }
  } else {
    const collection = referenceTarget(schema, "venue");
    if (ids.length && typeof collection !== "string")
      throw new Error("Missing native venue reference target.");
    for (const [key, record] of await localizedReferences(
      ctx,
      collection,
      events,
      (event) => event.venueId,
    )) {
      const venue = normalizeVenueRecord(record);
      if (venue) result.set(key, venue);
    }
  }
  return result;
}
async function localizedReferences(
  ctx: EventualContext,
  target: string,
  events: EventRecord[],
  idOf: (event: EventRecord) => string | undefined,
) {
  const requested = new Map<string, Set<string>>();
  for (const event of events) {
    const id = idOf(event);
    if (!id) continue;
    const locales = requested.get(id) ?? new Set<string>();
    locales.add((event.locale ?? "").toLowerCase());
    requested.set(id, locales);
  }
  const result = new Map<string, ContentItem>();
  const ids = [...requested.keys()];
  for (let i = 0; i < ids.length; i += 20)
    await Promise.all(
      ids.slice(i, i + 20).map(async (id) => {
        const base = await ctx.content!.get(target, id);
        if (base?.status !== "published") return;
        result.set(id, base);
        const locales = [...requested.get(id)!].filter(
          (locale) => locale && locale !== base.locale?.toLowerCase(),
        );
        if (!locales.length || !ctx.content?.getTranslations) return;
        const siblings = await ctx.content.getTranslations(target, id);
        for (const locale of locales) {
          const sibling = siblings.translations.find(
            (row) => row.locale?.toLowerCase() === locale,
          );
          if (!sibling) continue;
          const translated = await ctx.content.get(target, sibling.id);
          if (translated?.status === "published")
            result.set(id + "|" + locale, translated);
        }
      }),
    );
  return result;
}
export function selectEventLocales(
  events: EventRecord[],
  locale?: string,
  strict = false,
): EventRecord[] {
  const canonical = (value: string) =>
    Intl.getCanonicalLocales(value)[0]!.toLowerCase();
  const requested = locale ? canonical(locale) : undefined;
  const groups = new Map<string, EventRecord[]>();
  for (const event of events) {
    const key = event.translationGroup ?? event.id;
    const group = groups.get(key) ?? [];
    group.push(event);
    groups.set(key, group);
  }
  const result: EventRecord[] = [];
  for (const group of groups.values()) {
    group.sort(
      (a, b) =>
        (a.locale ?? "").localeCompare(b.locale ?? "") ||
        a.id.localeCompare(b.id),
    );
    const match = requested
      ? group.find(
          (event) => event.locale && canonical(event.locale) === requested,
        )
      : group[0];
    if (match) result.push(match);
    else if (!strict) {
      const fallback = group[0]!;
      const prefix = fallback.locale
        ? "[" + fallback.locale.toUpperCase() + "] "
        : "";
      result.push({
        ...fallback,
        title: prefix + fallback.title,
        exceptions: (fallback.exceptions ?? []).map((item) =>
          item.overrides?.title !== undefined
            ? {
                ...item,
                overrides: {
                  ...item.overrides,
                  title: prefix + item.overrides.title,
                },
              }
            : item,
        ),
      });
    }
  }
  return result;
}

export async function hydrateNativeAssets(
  ctx: EventualContext,
  events: EventRecord[],
): Promise<EventRecord[]> {
  const urls = new Map<string, string>();
  const images = new Map<string, string>();
  const organizers = new Map<
    string,
    NonNullable<EventRecord["organizerDetails"]>
  >();
  const organizerIds = [
    ...new Set(
      events.flatMap((event) => (event.organizerId ? [event.organizerId] : [])),
    ),
  ];
  if (organizerIds.length) {
    const target = referenceTarget(await eventSchema(ctx), "organizer_ref");
    for (const [key, entry] of await localizedReferences(
      ctx,
      target,
      events,
      (event) => event.organizerId,
    )) {
      organizers.set(key, {
        id: entry.id,
        name: String(entry.data.name ?? entry.data.title ?? ""),
        website: safeHttpUrl(String(entry.data.website ?? "")),
        contactUrl: safeHttpUrl(
          String(entry.data.contact_url ?? entry.data.contactUrl ?? ""),
        ),
      });
    }
  }
  const ids = [...new Set(events.map((event) => event.id.split("#")[0]!))];
  for (let i = 0; i < ids.length; i += 20)
    await Promise.all(
      ids.slice(i, i + 20).map(async (id) => {
        const url = await ctx.content?.getPublicUrl?.("events", id);
        if (url) urls.set(id, url);
      }),
    );
  const mediaIds = [
    ...new Set(
      events.flatMap((event) =>
        event.imageMediaId && !event.imageUrl ? [event.imageMediaId] : [],
      ),
    ),
  ];
  for (let i = 0; i < mediaIds.length; i += 20)
    await Promise.all(
      mediaIds.slice(i, i + 20).map(async (id) => {
        const media = await ctx.media?.get(id);
        if (media) images.set(id, media.url);
      }),
    );
  return events.map((event) => ({
    ...event,
    organizer:
      event.organizer ||
      (
        organizers.get(
          (event.organizerId ?? "") + "|" + (event.locale ?? "").toLowerCase(),
        ) ?? organizers.get(event.organizerId ?? "")
      )?.name ||
      event.organizerDetails?.name ||
      "",
    organizerDetails:
      organizers.get(
        (event.organizerId ?? "") + "|" + (event.locale ?? "").toLowerCase(),
      ) ??
      organizers.get(event.organizerId ?? "") ??
      event.organizerDetails,
    publicUrl: urls.get(event.id.split("#")[0]!) ?? event.publicUrl,
    imageUrl: event.imageUrl || images.get(event.imageMediaId ?? "") || "",
  }));
}
