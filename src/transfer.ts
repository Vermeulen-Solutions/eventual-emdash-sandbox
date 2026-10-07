import type { StorageCollection } from "emdash";
import type { EventRecord, VenueRecord, OrganizerRecord } from "./domain/event";
import { eventToDraft, prepareEventData } from "./domain/event-data";
import { isDateOnly, isValidTimeZone } from "./domain/date-time";
import { validRecurrence } from "./domain/recurrence-rule";
import {
  exceptionIdsMatchRecurrence,
  scheduledOccurrence,
} from "./domain/recurrence";
import { safeHttpUrl } from "./domain/venue";
import { validateMcpInput, validateSavedRecord } from "./mcp-schemas";
import type { EventualContext } from "./storage";
import {
  migrateToNative,
  type MigrateToNativeOptions,
} from "./domain/migration";
import { nativeSchema } from "./domain/native-source";
import { referenceTarget } from "./domain/native-references";

type Collection = "events" | "venues" | "organizers";
type RecordData = EventRecord | VenueRecord | OrganizerRecord;
export interface TransferInput {
  collection: Collection;
  source: string;
  mode?: "copy" | "restore";
  records: Array<{ sourceId: string; data: RecordData }>;
}

export async function transferId(
  source: string,
  collection: Collection,
  id: string,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify([source, collection, id])),
  );
  return `import-${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function validTimestamp(value: string): boolean {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    return false;
  return (
    new Date(value).toISOString().replace(".000Z", "Z") ===
    value.replace(".000Z", "Z")
  );
}
function checkSchedule(
  event: Pick<EventRecord, "start" | "end" | "allDay" | "timezone">,
): boolean {
  if (!isValidTimeZone(event.timezone)) return false;
  return event.allDay
    ? isDateOnly(event.start) &&
        isDateOnly(event.end) &&
        event.end >= event.start
    : validTimestamp(event.start) &&
        validTimestamp(event.end) &&
        Date.parse(event.end) >= Date.parse(event.start);
}

async function prepare(
  ctx: EventualContext,
  input: TransferInput,
  data: RecordData,
  id: string,
  write: boolean,
  warnings: string[],
): Promise<RecordData> {
  if (![data.createdAt, data.updatedAt].every(validTimestamp))
    throw new Error("Invalid record timestamp.");
  const now = new Date().toISOString();
  if (input.collection !== "events") {
    const named = data as VenueRecord | OrganizerRecord;
    if (!named.name.trim()) throw new Error("Name is required.");
    if (
      input.collection === "organizers" &&
      [
        (data as OrganizerRecord).website,
        (data as OrganizerRecord).contactUrl,
      ].some((url) => url && !safeHttpUrl(url))
    )
      throw new Error("Public URLs must use HTTP(S).");
    return { ...data, name: named.name.trim(), id, updatedAt: now };
  }
  const event = data as EventRecord;
  if (
    !checkSchedule(event) ||
    (event.recurrence && !validRecurrence(event.recurrence))
  )
    throw new Error("Invalid schedule or recurrence.");
  const fields = prepareEventData(
    eventToDraft({ ...event, published: false, status: "draft" }),
    { start: event.start, end: event.end },
  );
  if (!fields.data) throw new Error(fields.error);
  const imported: EventRecord = {
    ...fields.data,
    id,
    createdAt: event.createdAt,
    updatedAt: now,
  };
  for (const key of ["venueId", "organizerId"] as const) {
    const reference = event[key];
    if (!reference) continue;
    const collection = key === "venueId" ? "venues" : "organizers";
    const mapped =
      input.mode === "restore"
        ? reference
        : await transferId(input.source, collection, reference);
    if (!(await ctx.storage[collection]!.get(mapped))) {
      const message = `Missing ${collection} reference: ${reference}. Import referenced records first.`;
      if (write) throw new Error(message);
      warnings.push(message);
    }
    imported[key] = mapped;
  }
  // Media bytes are outside the export. An ID is useful only on its original site.
  if (event.imageMediaId)
    throw new Error(
      "Remove imageMediaId or replace it with an external image URL; media is not restored by this tool.",
    );
  for (const exception of imported.exceptions) {
    const original = scheduledOccurrence(imported, exception.recurrenceId);
    if (!original) throw new Error("Invalid exception recurrenceId.");
    if (exception.status === "modified") {
      const patch = exception.overrides;
      if (!patch || !Object.keys(patch).length)
        throw new Error("Modified exceptions require overrides.");
      if (patch.imageMediaId)
        throw new Error("Exception media IDs require a host media restore.");
      if (
        ["virtualUrl", "externalUrl", "imageUrl"].some((key) => {
          const url = patch[key as "virtualUrl" | "externalUrl" | "imageUrl"];
          return url && !safeHttpUrl(url);
        })
      )
        throw new Error("Exception URLs must use HTTP(S).");
      if (
        (patch.start === undefined) !== (patch.end === undefined) ||
        (patch.allDay !== undefined &&
          patch.allDay !== original.allDay &&
          patch.start === undefined)
      )
        throw new Error("Replacement schedule requires start and end.");
      const effective = { ...original, ...patch };
      if (!checkSchedule(effective))
        throw new Error("Invalid exception schedule.");
      patch.status = "draft";
    }
  }
  if (
    new Set(imported.exceptions.map((exception) => exception.recurrenceId))
      .size !== imported.exceptions.length ||
    !exceptionIdsMatchRecurrence(imported)
  )
    throw new Error("Duplicate or invalid exception IDs.");
  if (
    event.scheduleHistory?.some(
      (schedule) =>
        !checkSchedule(schedule) || !validTimestamp(schedule.changedAt),
    )
  )
    throw new Error("Invalid schedule history.");
  if (
    event.previousStartDate &&
    !isDateOnly(event.previousStartDate) &&
    !validTimestamp(event.previousStartDate)
  )
    throw new Error("Invalid previous start.");
  if (event.scheduleHistory) imported.scheduleHistory = event.scheduleHistory;
  if (event.previousStartDate)
    imported.previousStartDate = event.previousStartDate;
  return imported;
}

export async function importRecords(
  ctx: EventualContext,
  input: TransferInput,
  write: boolean,
) {
  if (await nativeSchema(ctx)) {
    return {
      ok: false,
      preview: !write,
      error: "NATIVE_COLLECTIONS_ACTIVE",
      details:
        "Import into native collections using EmDash content tools. Legacy storage imports are disabled when native collections are active.",
      rows: [],
    };
  }
  if (
    !validateMcpInput(write ? "importRecords" : "previewImport", input) ||
    new TextEncoder().encode(JSON.stringify(input)).length > 65536
  )
    return { ok: false, error: "VALIDATION_ERROR", maxBytes: 65536 };
  const rows = [];
  const seen = new Set<string>();
  for (const [index, row] of input.records.entries()) {
    const id =
      input.mode === "restore"
        ? row.sourceId
        : await transferId(input.source, input.collection, row.sourceId);
    try {
      if (!validateSavedRecord(input.collection, row.data))
        throw new Error("Record does not match its collection schema.");
      if (row.sourceId !== row.data.id)
        throw new Error("sourceId must match the record ID.");
      if (seen.has(id)) throw new Error("Duplicate source ID in this batch.");
      seen.add(id);
      const warnings: string[] = [];
      const data = await prepare(
        ctx,
        input,
        structuredClone(row.data),
        id,
        write,
        warnings,
      );
      const collection = ctx.storage[
        input.collection
      ] as StorageCollection<RecordData>;
      const status = write
        ? (await collection.compareAndSet(id, null, data)).applied
          ? "imported"
          : "skipped"
        : (await collection.exists(id))
          ? "skipped"
          : "ready";
      rows.push({
        row: index + 1,
        sourceId: row.sourceId,
        id,
        status,
        ...(warnings.length ? { warnings } : {}),
      });
    } catch (error) {
      rows.push({
        row: index + 1,
        sourceId: row.sourceId,
        id,
        status: "error",
        error: error instanceof Error ? error.message : "Import failed.",
      });
    }
  }
  return {
    ok: rows.every((row) => row.status !== "error"),
    preview: !write,
    rows,
  };
}

export const transferRoutes = {
  "mcp/transfer/preview": {
    permission: "plugins:manage" as const,
    handler: (route: { input: unknown }, ctx: EventualContext) =>
      importRecords(ctx, route.input as TransferInput, false),
  },
  "mcp/transfer/import": {
    permission: "plugins:manage" as const,
    handler: (route: { input: unknown }, ctx: EventualContext) =>
      importRecords(ctx, route.input as TransferInput, true),
  },
  "mcp/transfer/export": {
    permission: "plugins:manage" as const,
    handler: async (route: { input: unknown }, ctx: EventualContext) => {
      if (!validateMcpInput("exportRecords", route.input))
        return { ok: false, error: "VALIDATION_ERROR" };
      const input = route.input as {
        collection: Collection;
        cursor?: string;
        limit?: number;
      };
      const schema = await nativeSchema(ctx);
      if (schema) {
        const target =
          input.collection === "venues"
            ? referenceTarget(schema, "venue")
            : input.collection === "organizers"
              ? referenceTarget(schema, "organizer_ref")
              : "events";
        const page = await ctx.content!.list(target, {
          limit: input.limit ?? 5,
          cursor: input.cursor,
        });
        if (page.hasMore && (!page.cursor || page.cursor === input.cursor))
          return { ok: false, error: "INCOMPLETE_PAGE" };
        const records = page.items.map((item) => ({
          sourceId: item.id,
          data: item.data,
          metadata: {
            slug: item.slug,
            locale: item.locale,
            status: item.status,
            translationGroup: item.translationGroup,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            publishedAt: item.publishedAt,
            scheduledAt: item.scheduledAt,
            draftRevisionId: item.draftRevisionId,
            liveRevisionId: item.liveRevisionId,
          },
        }));
        if (new TextEncoder().encode(JSON.stringify(records)).length > 65536)
          return {
            ok: false,
            error: "EXPORT_PAGE_TOO_LARGE",
            details:
              "Retry with limit 1; oversized individual records require an EmDash site export.",
          };
        return {
          ok: true,
          format: "native-content-v1",
          collection: target,
          records,
          ...(page.hasMore ? { nextCursor: page.cursor } : {}),
        };
      }
      const page = await ctx.storage[input.collection]!.query({
        limit: input.limit ?? 5,
        cursor: input.cursor,
      });
      if (page.hasMore && !page.cursor)
        return { ok: false, error: "INCOMPLETE_PAGE" };
      const records = page.items.map((item) => ({
        sourceId: item.id,
        data: item.data,
      }));
      if (new TextEncoder().encode(JSON.stringify(records)).length > 65536)
        return {
          ok: false,
          error: "EXPORT_PAGE_TOO_LARGE",
          details:
            "Retry with limit 1; oversized individual records require a host storage export.",
        };
      return {
        ok: true,
        collection: input.collection,
        records,
        ...(page.hasMore ? { nextCursor: page.cursor } : {}),
      };
    },
  },
  "mcp/transfer/migrateToNative": {
    permission: "plugins:manage" as const,
    handler: async (route: { input: unknown }, ctx: EventualContext) => {
      const input = route.input ?? {};
      if (!validateMcpInput("migrateToNative", input))
        return { ok: false, error: "VALIDATION_ERROR" };
      return migrateToNative(ctx, input as MigrateToNativeOptions);
    },
  },
};
