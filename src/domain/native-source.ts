import { reject } from './messages';
import type {
  PluginContentItem as ContentItem,
  CollectionSchemaInfo,
} from "emdash";
import type { EventRecord } from "./event";
import { nativeEntryToEventRecord } from "./event-expansion";
import { normalizeVenueRecord, type NormalizedVenue } from "./venue-adapter";
import { referenceTarget, eventSchema } from "./native-references";
import { safeHttpUrl } from "./venue";
import { publicEventImageUrl } from "./image";
import {requestMemo} from './request-memo';
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
  const schema = await eventSchema(ctx);
  if (schema && !schema.fields?.some((field) => field.slug === "start"))
    reject("The events collection is not an Eventual schema.");
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
      reject("Invalid content cursor.");
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
      events: (await listEvents(ctx, {
        published: true,
        ...(through ? { through } : {}),
      })).map(event=>event.locale ? event : {...event,locale:ctx.site?.locale ?? 'en'}),
      schema,
    };
  }
  const entries = await listNative(ctx, schema.slug, true);
  const events: EventRecord[] = [];
  for (const entry of entries) {
    const event = nativeEntryToEventRecord(entry);
    if (!event) reject("Invalid native event " + entry.id);
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
  const entries = schema
    ? await localizedReferences(ctx, referenceTarget(schema, 'venue'), events, event => event.venueId)
    : await listVenuesById(ctx, ids);
  for (const [key, record] of entries) {
    const venue = normalizeVenueRecord(record);
    if (venue) result.set(key, venue);
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
  if (!requested.size || !ctx.content) return result;

  const items = await requestMemo(ctx, 'directory:'+target, () => listNative(ctx, target, true));
  const byId = new Map<string, ContentItem>();
  const byGroupLocale = new Map<string, ContentItem>();

  for (const item of items) {
    if (item.status !== 'published') continue;
    byId.set(item.id, item);
    const groupKey = item.translationGroup || item.id;
    const loc = (item.locale ?? "").toLowerCase();
    byGroupLocale.set(`${groupKey}|${loc}`, item);
  }

  for (const [id, locales] of requested) {
    const base = byId.get(id);
    if (!base) continue;
    result.set(id, base);
    for (const locale of locales) {
      if (!locale || locale === (base.locale ?? "").toLowerCase()) continue;
      const groupKey = base.translationGroup || base.id;
      const translated = byGroupLocale.get(`${groupKey}|${locale}`);
      if (translated) {
        result.set(`${id}|${locale}`, translated);
      }
    }
  }

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
    // Standalone translations are editorial projections, never additional schedules.
    for (const [language, copy] of Object.entries(event.translations ?? {})) {
      group.push({ ...event, ...copy, locale: language, descriptionBlocks: undefined,
        exceptions: event.exceptions.map(item => ({ ...item, overrides: item.overrides
          ? Object.fromEntries(Object.entries(item.overrides).filter(([key]) => !['title','description','location','organizer','locale'].includes(key))) : undefined })),
      });
    }
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
      : group.find(event => !event.translations || events.includes(event)) ?? group[0];
    if (match) result.push(match);
    else if (!strict) {
      const fallback = group.find(event => events.includes(event)) ?? group[0]!;
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
  publicUrls = true,
): Promise<EventRecord[]> {
  const organizers = new Map<
    string,
    NonNullable<EventRecord["organizerDetails"]>
  >();
  const schema = await eventSchema(ctx);
  if (events.some(e => e.organizerId)) {
    const target = referenceTarget(schema, "organizer_ref");
    for (const [key, entry] of await localizedReferences(ctx, target, events, (e) => e.organizerId)) {
      organizers.set(key, {
        id: entry.id,
        name: String(entry.data.name ?? entry.data.title ?? ""),
        website: safeHttpUrl(String(entry.data.website ?? "")),
        contactUrl: safeHttpUrl(String(entry.data.contact_url ?? entry.data.contactUrl ?? "")),
      });
    }
  }

  const pId = ctx.plugin?.id ?? "eventual";
  const hydrated: EventRecord[] = [];
  for (const e of events) {
    const org = organizers.get((e.organizerId ?? "") + "|" + (e.locale ?? "").toLowerCase()) ?? organizers.get(e.organizerId ?? "");
    let publicUrl = e.publicUrl;
    if (publicUrls && schema && e.published && e.slug && ctx.content?.getPublicUrl) {
      const id = e.id.split('#')[0]!;
      publicUrl = await requestMemo(ctx, 'url:'+schema.slug+':'+id, () => ctx.content!.getPublicUrl!(schema.slug, id)) ?? e.publicUrl;
    }
    hydrated.push({
      ...e,
      organizer: e.organizer || org?.name || e.organizerDetails?.name || "",
      organizerDetails: org ?? e.organizerDetails,
      publicUrl,
      imageUrl: (e.featuredMediaId || e.imageMediaId)
        ? publicEventImageUrl(pId, e.id)
        : (e.imageUrl || ""),
    });
  }
  return hydrated;
}
