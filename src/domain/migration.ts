import type {
  PluginContentItem as ContentItem,
  CollectionSchemaInfo,
} from "emdash";
import type { EventRecord, VenueRecord } from "./event";
import type { EventualContext } from "../storage";
import {
  plainTextToPortableText,
  portableTextToPlainText,
} from "./portable-text";
import { normalizeNativeSchedule } from "./native-validation";
import { nativeEntryToEventRecord } from "./event-expansion";
import { calendarHost, reconcileNativeCalendar } from "./native-calendar";
import { eventUid } from "./icalendar";
import { listNative } from "./native-source";

export interface MigrateToNativeOptions {
  locale?: string;
  venueCollection?: string;
  dryRun?: boolean;
  venueMapping?: Record<string, string>;
  cursor?: string;
  limit?: number;
}
export interface MigrationItemResult {
  legacyId: string;
  nativeId: string;
  titleOrName: string;
  status: "planned" | "migrated" | "already_exists" | "skipped" | "error";
  error?: string;
  payload?: Record<string, unknown>;
  action?: "create" | "resume_publication" | "none";
}
export interface MigrationResult {
  ok: boolean;
  dryRun: boolean;
  locale: string;
  venueCollection: string;
  venues: MigrationItemResult[];
  events: MigrationItemResult[];
  nextCursor?: string;
  error?: string;
  warnings?: string[];
  summary: {
    totalVenues: number;
    migratedVenues: number;
    totalEvents: number;
    migratedEvents: number;
    errors: number;
  };
}
export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "item"
  );
}
const text = (value: unknown) => (typeof value === "string" ? value : "");
const ledgerKey = (collection: string, id: string) =>
  "state:eventual-migration:" + collection + ":" + encodeURIComponent(id);
function fitPayload(
  schema: CollectionSchemaInfo,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const fields = new Set(schema.fields.map((field) => field.slug));
  const filtered = Object.fromEntries(
    Object.entries(payload).filter(
      ([key, value]) =>
        fields.has(key) && value !== undefined && value !== null,
    ),
  );
  for (const field of schema.fields)
    if (
      field.required &&
      !(field.slug in filtered) &&
      field.default === undefined
    )
      throw new Error("Missing required target field " + field.slug);
  return filtered;
}
export async function migrateToNative(
  ctx: EventualContext,
  options: MigrateToNativeOptions = {},
): Promise<MigrationResult> {
  const locale = options.locale ?? "fr";
  const dryRun = options.dryRun === true;
  const result: MigrationResult = {
    ok: false,
    dryRun,
    locale,
    venueCollection: options.venueCollection ?? "venues",
    venues: [],
    events: [],
    summary: {
      totalVenues: 0,
      migratedVenues: 0,
      totalEvents: 0,
      migratedEvents: 0,
      errors: 0,
    },
  };
  let lease: { revision: string } | null = null;
  const lockKey = "state:eventual-migration-lock";
  try {
    if (Intl.getCanonicalLocales(locale)[0] !== locale)
      throw new Error("Use a canonical BCP 47 locale.");
    if (dryRun)
      result.warnings = [
        "Native IDs are assigned during execution. Site locale configuration and other plugins' save/publication policies are checked by EmDash during execution.",
      ];
    if (
      !ctx.schema ||
      !ctx.content?.create ||
      !ctx.content.publish ||
      !ctx.content.getVersioned
    )
      throw new Error(
        "Native schema, content write and publication APIs are required.",
      );
    const schemas = await ctx.schema.listCollections();
    const eventsSchema = schemas.find((schema) => schema.slug === "events");
    if (!eventsSchema)
      throw new Error("Apply the Eventual events blueprint before migrating.");
    const reference = eventsSchema.fields.find(
      (field) => field.slug === "venue",
    )?.options?.collection;
    result.venueCollection =
      options.venueCollection ??
      (typeof reference === "string"
        ? reference
        : schemas.some((schema) => schema.slug === "locations")
          ? "locations"
          : "venues");
    if (reference !== result.venueCollection)
      throw new Error(
        "venueCollection must match the events.venue reference target.",
      );
    const venuesSchema = schemas.find(
      (schema) => schema.slug === result.venueCollection,
    );
    if (!venuesSchema) throw new Error("Target venue collection is missing.");
    for (const schema of [eventsSchema, venuesSchema]) {
      const legacy = schema.fields.find((field) => field.slug === "legacy_id");
      if (!legacy?.unique || !legacy.indexed)
        throw new Error(
          schema.slug +
            " requires a unique indexed legacy_id field for resumable migration.",
        );
      if (
        !schema.fields.some(
          (field) => field.slug === "legacy_metadata" && field.type === "json",
        )
      )
        throw new Error(
          schema.slug +
            " requires legacy_metadata JSON for recovery and traceability.",
        );
    }
    const required = [
      "start_date",
      "end_date",
      "all_day",
      "timezone",
      "description",
      "event_status",
      "calendar_uid",
      "exceptions",
      "occurrence_content",
      "legacy_metadata",
      "image_url",
      "organizer_details",
      "categories",
      "location",
    ];
    for (const slug of required)
      if (!eventsSchema.fields.some((field) => field.slug === slug))
        throw new Error("Update the events blueprint: missing " + slug);
    if (!dryRun) {
      const old = await ctx.kv.getVersioned<{ until: number }>(lockKey);
      if (old && old.value.until > Date.now())
        throw new Error("Migration is already running.");
      const applied = await ctx.kv.compareAndSet(
        lockKey,
        old?.revision ?? null,
        { until: Date.now() + 300000 },
      );
      if (!applied.applied) throw new Error("Migration lock conflict; retry.");
      lease = await ctx.kv.getVersioned(lockKey);
    }
    const existingVenues = await listNative(ctx, result.venueCollection);
    const existingEvents = await listNative(ctx, "events");
    const indexes = new Map<string, Map<string, ContentItem>>([
      [
        result.venueCollection,
        new Map(
          existingVenues
            .filter((item) => typeof item.data.legacy_id === "string")
            .map((item) => [item.data.legacy_id as string, item]),
        ),
      ],
      [
        "events",
        new Map(
          existingEvents
            .filter((item) => typeof item.data.legacy_id === "string")
            .map((item) => [item.data.legacy_id as string, item]),
        ),
      ],
    ]);
    const mapping = new Map<string, string>();
    for (const [id, target] of Object.entries(options.venueMapping ?? {})) {
      if (typeof target !== "string" || !target)
        throw new Error("venueMapping values must be non-empty native IDs.");
      if (!(await ctx.content.get(result.venueCollection, target)))
        throw new Error("Mapped venue does not exist: " + target);
      mapping.set(id, target);
      if (!dryRun)
        await ctx.kv.set(ledgerKey(result.venueCollection, id), {
          id: target,
          published: true,
          status: "complete",
        });
    }
    for (const item of existingVenues)
      if (
        typeof item.data.legacy_id === "string" &&
        !mapping.has(item.data.legacy_id)
      ) {
        const ledger = await ctx.kv.get<{ status?: string }>(
          ledgerKey(result.venueCollection, item.data.legacy_id),
        );
        if (
          !ledger ||
          ledger.status === "complete" ||
          item.status === "published"
        )
          mapping.set(item.data.legacy_id, item.id);
      }
    const venuePayload = (row: Record<string, unknown>, id: string) =>
      fitPayload(venuesSchema, {
        name: text(row.name).trim(),
        title: text(row.name).trim(),
        street: text(row.street),
        street2: text(row.street2),
        address: text(row.street),
        streetAddress: text(row.street),
        locality: text(row.locality),
        city: text(row.locality),
        region: text(row.region),
        state: text(row.region),
        postal_code: text(row.postalCode),
        postalCode: text(row.postalCode),
        zip: text(row.postalCode),
        country: text(row.country),
        legacy_id: id,
        legacy_metadata: JSON.stringify(row),
      });
    let phase: "venues" | "events" = "venues";
    let cursor: string | undefined;
    if (options.cursor) {
      const resume = JSON.parse(options.cursor) as {
        phase: string;
        cursor?: string;
        locale: string;
        collection: string;
      };
      if (
        !["venues", "events"].includes(resume.phase) ||
        resume.locale !== locale ||
        resume.collection !== result.venueCollection ||
        (resume.cursor !== undefined && typeof resume.cursor !== "string")
      )
        throw new Error("Invalid migration cursor.");
      phase = resume.phase as typeof phase;
      cursor = resume.cursor;
    }
    let remaining = options.limit ?? 25;
    if (!Number.isInteger(remaining) || remaining < 1 || remaining > 100)
      throw new Error("limit must be between 1 and 100.");
    const host = dryRun
      ? (() => {
          try {
            return new URL(ctx.site.url).host;
          } catch {
            return "eventual.invalid";
          }
        })()
      : await calendarHost(ctx);
    const existingHost = await ctx.kv.get<string>(
      "state:eventual-calendar-host",
    );
    const renew = async () => {
      if (dryRun || !lease) return;
      const result = await ctx.kv.compareAndSet(lockKey, lease.revision, {
        until: Date.now() + 300000,
      });
      if (!result.applied)
        throw new Error("Migration lease expired or changed; retry the batch.");
      lease = await ctx.kv.getVersioned(lockKey);
    };
    const migrate = async (
      collection: string,
      schema: CollectionSchemaInfo,
      legacyId: string,
      payload: Record<string, unknown>,
      published: boolean,
    ): Promise<{
      id: string;
      existed: boolean;
      action: NonNullable<MigrationItemResult["action"]>;
    }> => {
      await renew();
      const key = ledgerKey(collection, legacyId);
      const ledger = await ctx.kv.get<{
        id: string;
        published: boolean;
        status?: string;
        token?: string;
      }>(key);
      let existing = indexes.get(collection)?.get(legacyId);
      if (ledger?.id) {
        const row = await ctx.content!.get(collection, ledger.id);
        if (!row)
          throw new Error(
            "Migrated native item was removed; restore it explicitly instead of resurrecting legacy data.",
          );
        existing = row;
      }
      if (existing) {
        if (
          collection === "events" &&
          existing.locale &&
          existing.locale !== locale
        )
          throw new Error(
            "Migration identity belongs to locale " +
              existing.locale +
              "; use its original locale.",
          );
        const metadata =
          typeof existing.data.legacy_metadata === "string"
            ? JSON.parse(existing.data.legacy_metadata)
            : existing.data.legacy_metadata;
        const recovering =
          ledger &&
          ledger.status !== "complete" &&
          ledger.token &&
          metadata?.migrationToken === ledger.token;
        const action =
          recovering && published && existing.status !== "published"
            ? "resume_publication"
            : "none";
        // Never republish a completed migration after an editor unpublishes it.
        if (
          !dryRun &&
          recovering &&
          published &&
          existing.status !== "published"
        ) {
          const current = await ctx.content!.getVersioned!(
            collection,
            existing.id,
          );
          if (!current) throw new Error("Created item disappeared.");
          await ctx.content!.publish!(collection, existing.id, {
            _rev: current._rev,
          });
        }
        if (!dryRun && (!ledger || recovering))
          await ctx.kv.set(key, {
            id: existing.id,
            published,
            status: "complete",
            token: ledger?.token,
          });
        return { id: existing.id, existed: true, action };
      }
      if (dryRun) return { id: "", existed: false, action: "create" };
      const token = crypto.randomUUID();
      const metadata =
        typeof payload.legacy_metadata === "string"
          ? JSON.parse(payload.legacy_metadata)
          : (payload.legacy_metadata ?? {});
      await ctx.kv.set(key, { id: "", published, status: "creating", token });
      const created = await ctx.content!.create!(
        collection,
        fitPayload(schema, {
          ...payload,
          legacy_metadata: JSON.stringify({
            ...metadata,
            migrationToken: token,
          }),
        }),
        { locale },
      );
      // Both the durable intent and unique legacy_id recover a lost create response.
      indexes.get(collection)!.set(legacyId, created);
      await renew();
      await ctx.kv.set(key, {
        id: created.id,
        published,
        status: "created",
        token,
      });
      if (published && created.status !== "published") {
        const current = await ctx.content!.getVersioned!(
          collection,
          created.id,
        );
        if (!current) throw new Error("Created item disappeared.");
        await ctx.content!.publish!(collection, created.id, {
          _rev: current._rev,
        });
      }
      await renew();
      await ctx.kv.set(key, {
        id: created.id,
        published,
        status: "complete",
        token,
      });
      return { id: created.id, existed: false, action: "create" };
    };
    while (remaining > 0) {
      const page = await ctx.storage[phase]!.query({
        limit: remaining,
        cursor,
      });
      if (page.hasMore && (!page.cursor || page.cursor === cursor))
        throw new Error("Incomplete legacy storage cursor.");
      for (const item of page.items) {
        remaining--;
        const legacyId = item.id;
        const row = item.data as unknown as Record<string, unknown>;
        const titleOrName = text(
          phase === "venues" ? row.name : row.title,
        ).trim();
        const target = phase === "venues" ? result.venues : result.events;
        try {
          if (phase === "venues" && mapping.has(legacyId)) {
            target.push({
              legacyId,
              nativeId: mapping.get(legacyId)!,
              titleOrName: titleOrName || legacyId,
              status: "already_exists",
            });
            continue;
          }
          if (!titleOrName) throw new Error("Missing title or venue name.");
          let payload: Record<string, unknown>;
          let published = false;
          let schema: CollectionSchemaInfo;
          let collection: string;
          if (phase === "venues") {
            schema = venuesSchema;
            collection = result.venueCollection;
            payload = venuePayload(row, legacyId);
            published = true;
          } else {
            collection = "events";
            schema = eventsSchema;
            const event = row as unknown as EventRecord;
            let nativeVenue = event.venueId
              ? (mapping.get(event.venueId) ??
                (
                  await ctx.kv.get<{ id: string }>(
                    ledgerKey(result.venueCollection, event.venueId),
                  )
                )?.id)
              : undefined;
            if (dryRun && event.venueId && !nativeVenue) {
              const source = (await ctx.storage.venues!.get(
                event.venueId,
              )) as VenueRecord | null;
              if (
                text(source?.name).trim() &&
                venuePayload(
                  source as unknown as Record<string, unknown>,
                  event.venueId,
                )
              )
                nativeVenue = "planned:" + event.venueId;
            }
            if (event.venueId && !nativeVenue)
              throw new Error("Unmapped venue " + event.venueId);
            if (
              nativeVenue &&
              !nativeVenue.startsWith("planned:") &&
              !(await ctx.content.get(result.venueCollection, nativeVenue))
            )
              throw new Error("Mapped venue was removed.");
            if (
              event.published &&
              nativeVenue &&
              !nativeVenue.startsWith("planned:") &&
              (await ctx.content.get(result.venueCollection, nativeVenue))
                ?.status !== "published"
            )
              throw new Error(
                "Publish the mapped venue before migrating a published event.",
              );
            if (
              event.imageMediaId &&
              !(await ctx.media?.get(event.imageMediaId))
            )
              throw new Error("Legacy media item is unavailable.");
            const editorialKeys = new Set([
              "title",
              "description",
              "location",
              "organizer",
            ]);
            const exceptions = (event.exceptions ?? []).map((ex) => ({
              ...ex,
              overrides: ex.overrides
                ? Object.fromEntries(
                    Object.entries(ex.overrides).filter(
                      ([key]) => !editorialKeys.has(key) && key !== "locale",
                    ),
                  )
                : undefined,
            }));
            const copy = (event.exceptions ?? []).flatMap((ex) => {
              const overrides = Object.fromEntries(
                Object.entries(ex.overrides ?? {}).filter(([key]) =>
                  editorialKeys.has(key),
                ),
              );
              return Object.keys(overrides).length
                ? [{ recurrenceId: ex.recurrenceId, overrides }]
                : [];
            });
            // Editorial-only modifications are represented solely in the locale field.
            const schedules = exceptions.filter(
              (ex) =>
                ex.status === "cancelled" ||
                Object.keys(ex.overrides ?? {}).length,
            );
            const organizer = event.organizerId
              ? await ctx.storage.organizers?.get(event.organizerId)
              : undefined;
            const normalized = normalizeNativeSchedule({
              start: event.start,
              end: event.end,
              all_day: event.allDay,
              timezone: event.timezone,
              recurrence: event.recurrence,
              exceptions: schedules,
              occurrence_content: copy,
            });
            payload = fitPayload(schema, {
              title: titleOrName,
              description: plainTextToPortableText(text(event.description)),
              excerpt: portableTextToPlainText(event.description).slice(0, 160),
              ...normalized,
              location_type: event.locationType ?? "physical",
              location: text(event.location),
              venue: nativeVenue,
              virtual_url: event.virtualUrl || undefined,
              external_url: event.externalUrl || undefined,
              organizer: text(event.organizer),
              organizer_details: organizer
                ? JSON.stringify(organizer)
                : undefined,
              categories: JSON.stringify(event.categories ?? []),
              featured_image: event.imageMediaId
                ? {
                    id: event.imageMediaId,
                    ...(event.imageUrl ? { src: event.imageUrl } : {}),
                  }
                : undefined,
              image_url: event.imageMediaId
                ? undefined
                : event.imageUrl || undefined,
              event_status: ["cancelled", "postponed", "rescheduled"].includes(
                event.status ?? "",
              )
                ? event.status
                : "published",
              recurrence: event.recurrence
                ? JSON.stringify(event.recurrence)
                : undefined,
              exceptions: JSON.stringify(schedules),
              occurrence_content: JSON.stringify(copy),
              previous_start_date: event.previousStartDate,
              schedule_history: event.scheduleHistory
                ? JSON.stringify(event.scheduleHistory)
                : undefined,
              legacy_id: legacyId,
              calendar_uid: eventUid(legacyId, existingHost ?? host),
              legacy_metadata: JSON.stringify({
                createdAt: event.createdAt,
                updatedAt: event.updatedAt,
                organizerId: event.organizerId,
                locale: event.locale,
                description: event.description,
                exceptions: event.exceptions,
              }),
            });
            if (
              !nativeEntryToEventRecord({
                id: legacyId,
                status: "published",
                type: "events",
                data: payload,
              })
            )
              throw new Error("Invalid migrated event payload.");
            published = event.published === true;
          }
          const saved = await migrate(
            collection,
            schema,
            legacyId,
            payload,
            published,
          );
          if (phase === "venues")
            mapping.set(legacyId, saved.id || "planned:" + legacyId);
          target.push({
            legacyId,
            nativeId: saved.id,
            action: saved.action,
            titleOrName,
            status: saved.existed
              ? "already_exists"
              : dryRun
                ? "planned"
                : "migrated",
            ...(dryRun ? { payload } : {}),
          });
        } catch (error) {
          target.push({
            legacyId,
            nativeId: "",
            titleOrName,
            status: "error",
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      if (page.hasMore) {
        result.nextCursor = JSON.stringify({
          phase,
          cursor: page.cursor,
          locale,
          collection: result.venueCollection,
        });
        break;
      }
      if (phase === "events") break;
      phase = "events";
      cursor = undefined;
      if (!remaining)
        result.nextCursor = JSON.stringify({
          phase,
          locale,
          collection: result.venueCollection,
        });
    }
    if (!dryRun) await reconcileNativeCalendar(ctx);
    result.ok = !result.venues
      .concat(result.events)
      .some((item) => item.status === "error");
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  } finally {
    if (lease) await ctx.kv.compareAndDelete(lockKey, lease.revision);
  }
  result.summary = {
    totalVenues: result.venues.length,
    migratedVenues: result.venues.filter((item) => item.status === "migrated")
      .length,
    totalEvents: result.events.length,
    migratedEvents: result.events.filter((item) => item.status === "migrated")
      .length,
    errors:
      result.venues
        .concat(result.events)
        .filter((item) => item.status === "error").length +
      (result.error ? 1 : 0),
  };
  return result;
}
