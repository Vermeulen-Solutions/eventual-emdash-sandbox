import { EXTERNAL_URL_ERROR } from './domain/messages';
import { validateMcpInput, type McpEventInput } from "./mcp-schemas";

import { normalizeCategories } from "./domain/category";
import { isDateOnly, isValidTimeZone } from "./domain/date-time";
import {
  normalizeEventStatus,
  eventToDraft,
  prepareEventData,
} from "./domain/event-data";
import type {
  EventDraft,
  EventException,
  EventRecord,
  VenueFields,
  VenueRecord,
} from "./domain/event";
import { EMPTY_EVENT_DRAFT } from './domain/event';
import {
  exceptionIdsMatchRecurrence,
  expandEventsInDateRange,
  scheduledOccurrence,
} from "./domain/recurrence";
import { safeHttpUrl } from "./domain/venue";
import {
  deleteEvent,
  deleteVenue,
  EventScanLimitError,
  getEvent,
  getVenue,
  listEvents,
  listEventsByVenueId,
  listVenues,
  listVenuesById,
  putEvent,
  putVenue,
  type EventualContext,
} from "./storage";
import { normalizeEventDates } from "./domain/date-time";
import { isUsableEventImage } from "./media";
import { inspectOccurrences, validOccurrenceRange } from "./domain/occurrences";
import { saveOrganizer } from "./organizers";
import { organizerCollection, listOrganizers } from "./storage";
import {
  nativeSchema,
  listNative,
  resolveEventVenues,
  hydrateNativeAssets,
} from "./domain/native-source";
import { referenceTarget } from "./domain/native-references";
import { saveCollectionBindings, collectionSchemas, collectionSettings } from './domain/collections';
import { normalizeVenueRecord, localizedVenue } from "./domain/venue-adapter";
import { nativeEntryToEventRecord } from "./domain/event-expansion";
import {withInvocationBudget} from './domain/invocation-budget';

const validEventInput = (value: unknown) =>
  validateMcpInput("createEvent", value);
const validEventPatch = (value: unknown) =>
  validateMcpInput("updateEvent", value);
const validVenueInput = (value: unknown) =>
  validateMcpInput("createVenue", value);
const validVenuePatch = (value: unknown) =>
  validateMcpInput("updateVenue", value);
const validId = (value: unknown) => validateMcpInput("getEvent", value);
const validEmpty = (value: unknown) => validateMcpInput("getSettings", value);
const validListEvents = (value: unknown) =>
  validateMcpInput("listEvents", value);
const validExceptionSet = (value: unknown) =>
  validateMcpInput("setOccurrenceException", value);
const validExceptionRemove = (value: unknown) =>
  validateMcpInput("removeOccurrenceException", value);
const validSettingsUpdate = (value: unknown) =>
  validateMcpInput("updateSettings", value);

function route(
  validate: (input: unknown) => boolean,
  run: (input: any, ctx: EventualContext) => Promise<unknown>,
  nativeAllowed = false,
) {
  return {
    permission: "plugins:manage" as const,
    handler: async (routeCtx: { input: unknown }, ctx: EventualContext) => {
      if (nativeAllowed) ctx = withInvocationBudget(ctx);
      if (!validate(routeCtx.input))
        return { ok: false, error: "VALIDATION_ERROR" };
      if (!nativeAllowed && (await nativeSchema(ctx)))
        return {
          ok: false,
          error: "NATIVE_COLLECTIONS_ACTIVE",
          details:
            "Use the EmDash content tools for events and venues. Legacy storage is retained for export.",
        };
      return run(routeCtx.input, ctx);
    },
  };
}

function draftFromFields(
  fields: McpEventInput,
  base?: EventRecord,
): EventDraft {
  const draft = base
    ? eventToDraft(base)
    : EMPTY_EVENT_DRAFT;
  const recurrence =
    fields.recurrence === null
      ? undefined
      : (fields.recurrence ?? base?.recurrence);
  return {
    ...draft,
    title: fields.title ?? draft.title,
    description: fields.description ?? draft.description,
    start: fields.start ?? draft.start,
    end: fields.end ?? draft.end,
    allDay: fields.allDay ?? draft.allDay,
    timezone: fields.timezone ?? draft.timezone,
    location: fields.location ?? draft.location,
    locationType: fields.locationType ?? draft.locationType ?? "physical",
    virtualUrl: fields.virtualUrl ?? draft.virtualUrl ?? "",
    status:
      fields.status ??
      draft.status ??
      (draft.published ? "published" : "draft"),
    organizer: fields.organizer ?? draft.organizer,
    organizerId: fields.organizerId ?? draft.organizerId,
    externalUrl: fields.externalUrl ?? draft.externalUrl,
    imageUrl: fields.imageUrl ?? draft.imageUrl,
    categories: fields.categories
      ? fields.categories.join(", ")
      : draft.categories,
    venueId: fields.venueId ?? draft.venueId,
    imageMediaId: fields.imageMediaId ?? draft.imageMediaId,
    repeatFrequency: recurrence?.frequency ?? "none",
    recurrenceUntil: recurrence?.until ?? "",
    recurrenceInterval: recurrence?.interval ?? 1,
    weeklyWeekdays:
      recurrence?.frequency === "weekly" ? recurrence.weekdays : undefined,
    monthlyDayOfMonth:
      recurrence?.frequency === "monthly" &&
      recurrence.pattern.type === "dayOfMonth"
        ? recurrence.pattern.dayOfMonth
        : undefined,
    monthlyPattern:
      recurrence?.frequency === "monthly"
        ? recurrence.pattern.type
        : "dayOfMonth",
    missingDayBehavior:
      recurrence?.frequency === "monthly" &&
      recurrence.pattern.type === "dayOfMonth"
        ? recurrence.pattern.missingDayBehavior
        : "skip",
    monthlyWeekday:
      recurrence?.frequency === "monthly" &&
      recurrence.pattern.type === "weekdayOfMonth"
        ? recurrence.pattern.weekday
        : "monday",
    monthlyPosition:
      recurrence?.frequency === "monthly" &&
      recurrence.pattern.type === "weekdayOfMonth"
        ? recurrence.pattern.position
        : 1,
  };
}

function validationResult(error: string) {
  return { ok: false, error: "INVALID_EVENT", details: [error] };
}

async function saveEvent(
  ctx: EventualContext,
  fields: McpEventInput,
  previous?: EventRecord,
) {
  const draft = draftFromFields(fields, previous);
  const prepared = prepareEventData(draft);
  if (!prepared.data)
    return validationResult(prepared.error ?? "Check the event fields.");
  if (prepared.data.externalUrl && !safeHttpUrl(prepared.data.externalUrl))
    return validationResult(EXTERNAL_URL_ERROR);
  if (
    draft.imageMediaId &&
    !(await isUsableEventImage(ctx, draft.imageMediaId))
  )
    return validationResult(
      "Choose a ready JPEG, PNG, GIF, WebP, or AVIF media image under 8 MiB.",
    );
  if (draft.venueId && !(await getVenue(ctx, draft.venueId)))
    return validationResult("The selected saved venue does not exist.");
  if (
    draft.organizerId &&
    !(await organizerCollection(ctx).get(draft.organizerId))
  )
    return validationResult("The selected saved organizer does not exist.");
  const now = new Date().toISOString();
  const event: EventRecord = {
    ...previous,
    ...prepared.data,
    recurrence:prepared.data.recurrence, venueId:prepared.data.venueId, organizerId:prepared.data.organizerId, imageMediaId:prepared.data.imageMediaId, virtualUrl:prepared.data.virtualUrl,
    locale: previous?.locale ?? ctx.site.locale ?? 'en',
    id: previous?.id ?? crypto.randomUUID(),
    exceptions: previous?.exceptions ?? [],
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  };
  for (const key of ['recurrence','venueId','organizerId','imageMediaId','virtualUrl'] as const) if(event[key] === undefined) delete event[key];
  if (!exceptionIdsMatchRecurrence(event))
    return validationResult(
      "Changing this schedule would invalidate occurrence exceptions. Remove or update those exceptions first.",
    );
  return { ok: true, event: await putEvent(ctx, event) };
}

function venueInput(fields: VenueFields, previous?: VenueRecord): VenueRecord {
  const now = new Date().toISOString();
  return {
    name: fields.name.trim(),
    street: fields.street?.trim() ?? "",
    street2: fields.street2?.trim() ?? "",
    locality: fields.locality?.trim() ?? "",
    region: fields.region?.trim() ?? "",
    postalCode: fields.postalCode?.trim() ?? "",
    country: fields.country?.trim() ?? "",
    id: previous?.id ?? crypto.randomUUID(),
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  };
}

function addDays(value: string, count: number): string {
  const result = new Date(`${value}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + count);
  return result.toISOString().slice(0, 10);
}

export const mcpRoutes = {
  "mcp/organizers/list": route(
    (input) => validateMcpInput("listOrganizers", input),
    async (_input, ctx) => {
      const schema = await nativeSchema(ctx);
      if (schema) {
        const target = referenceTarget(schema, "organizer_ref");
        if (
          !(await collectionSchemas(ctx)).some(
            (item) => item.slug === target,
          )
        )
          return { ok: true, organizers: [] };
        const entries = await listNative(ctx, target);
        return {
          ok: true,
          organizers: entries.map((item) => ({
            id: item.id,
            name: String(item.data.name ?? item.data.title ?? item.id),
            website: String(item.data.website ?? ""),
            contactUrl: String(item.data.contact_url ?? ""),
            locale: item.locale,
            status: item.status,
          })),
        };
      }
      return { ok: true, organizers: await listOrganizers(ctx) };
    },
    true,
  ),
  "mcp/organizers/create": route(
    (input) => validateMcpInput("createOrganizer", input),
    async (input, ctx) => saveOrganizer(ctx, input),
  ),
  "mcp/organizers/update": route(
    (input) => validateMcpInput("updateOrganizer", input),
    async (input, ctx) => {
      const previous = await organizerCollection(ctx).get(input.id);
      if (!previous) return { ok: false, error: "NOT_FOUND" };
      return saveOrganizer(
        ctx,
        { ...previous, ...input.patch },
        input.id,
        input.expectedUpdatedAt,
      );
    },
  ),
  "mcp/events/list": route(
    validListEvents,
    async (input, ctx) => {
      const today = new Date().toISOString().slice(0, 10);
      const from = input.from ?? today;
      const through = input.through ?? addDays(from, 180);
      if (
        from > through ||
        Date.parse(`${through}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`) >
          365 * 86400000
      )
        return { ok: false, error: "INVALID_DATE_RANGE" };

      const eventCollection = await nativeSchema(ctx);
      if (eventCollection) {
        const entries = await listNative(ctx, eventCollection.slug);
        const records: EventRecord[] = entries
          .map(nativeEntryToEventRecord)
          .filter((e: any): e is EventRecord => e !== null);
        const filtered = input.includeDrafts
          ? records
          : records.filter((e) => e.published);
        const occurrences = expandEventsInDateRange(
          filtered,
          from,
          through,
        ).slice(0, input.limit ?? 50);
        return { ok: true, from, through, events: occurrences };
      }

      let stored;
      try {
        stored = await listEvents(ctx, {
          published: input.includeDrafts ? undefined : true,
        });
      } catch (error) {
        if (error instanceof EventScanLimitError)
          return {
            ok: false,
            error: "EVENT_LIMIT_EXCEEDED",
            maxEvents: error.limit,
          };
        throw error;
      }
      const occurrences = expandEventsInDateRange(stored, from, through).slice(
        0,
        input.limit ?? 50,
      );
      const venues = await listVenuesById(
        ctx,
        occurrences.flatMap((event) => (event.venueId ? [event.venueId] : [])),
      );
      return {
        ok: true,
        from,
        through,
        events: occurrences.map((event) => ({
          ...event,
          venue: event.venueId ? (venues.get(event.venueId) ?? null) : null,
        })),
      };
    },
    true,
  ),
  "mcp/events/get": route(
    validId,
    async ({ id }, ctx) => {
      const eventCollection = await nativeSchema(ctx);
      if (eventCollection) {
        const entry = await ctx.content?.get(eventCollection.slug, id);
        if (!entry) return { ok: false, error: "NOT_FOUND" };
        const event = nativeEntryToEventRecord(entry);
        if (!event) return { ok: false, error: "NOT_FOUND" };
        const schema = await nativeSchema(ctx);
        const venues = await resolveEventVenues(ctx, [event], schema);
        return {
          ok: true,
          event: (await hydrateNativeAssets(ctx, [event]))[0],
          venue: localizedVenue(venues, event) ?? null,
        };
      }
      const event = await getEvent(ctx, id);
      if (!event) return { ok: false, error: "NOT_FOUND" };
      return {
        ok: true,
        event,
        venue: event.venueId ? await getVenue(ctx, event.venueId) : null,
      };
    },
    true,
  ),
  "mcp/events/occurrences": route(
    (input) => validateMcpInput("listOccurrences", input),
    async (input, ctx) => {
      const from = input.from ?? new Date().toISOString().slice(0, 10);
      const through = input.through ?? addDays(from, 89);
      if (!validOccurrenceRange(from, through))
        return { ok: false, error: "INVALID_DATE_RANGE" };

      const eventCollection = await nativeSchema(ctx);
      if (eventCollection) {
        const entry = await ctx.content?.get(eventCollection.slug, input.id);
        if (!entry) return { ok: false, error: "NOT_FOUND" };
        const event = nativeEntryToEventRecord(entry);
        if (!event) return { ok: false, error: "NOT_FOUND" };
        return {
          ok: true,
          eventId: event.id,
          published: event.published,
          ...inspectOccurrences(event, from, through, input.limit ?? 50),
        };
      }

      const event = await getEvent(ctx, input.id);
      if (!event) return { ok: false, error: "NOT_FOUND" };
      return {
        ok: true,
        eventId: event.id,
        published: event.published,
        ...inspectOccurrences(event, from, through, input.limit ?? 50),
      };
    },
    true,
  ),
  "mcp/events/create": route(
    (input) => validEventInput(input),
    async (input, ctx) => saveEvent(ctx, input),
  ),
  "mcp/events/update": route(validEventPatch, async ({ id, patch }, ctx) => {
    if (!Object.keys(patch).length) return { ok: false, error: "EMPTY_PATCH" };
    const previous = await getEvent(ctx, id);
    if (!previous) return { ok: false, error: "NOT_FOUND" };
    const current = eventToDraft(previous);
    const recurrence =
      patch.recurrence === undefined ? previous.recurrence : patch.recurrence;
    const fields = {
      title: patch.title ?? current.title,
      description: patch.description ?? current.description,
      start: patch.start ?? current.start,
      end: patch.end ?? current.end,
      allDay: patch.allDay ?? current.allDay,
      timezone: patch.timezone ?? current.timezone,
      location: patch.location ?? current.location,
      locationType: patch.locationType ?? current.locationType,
      virtualUrl: patch.virtualUrl ?? current.virtualUrl,
      status: patch.status ?? current.status,
      organizer: patch.organizer ?? current.organizer,
      organizerId: patch.organizerId ?? current.organizerId,
      externalUrl: patch.externalUrl ?? current.externalUrl,
      imageUrl: patch.imageUrl ?? current.imageUrl,
      imageMediaId: patch.imageMediaId ?? current.imageMediaId,
      categories: patch.categories ?? normalizeCategories(current.categories),
      venueId: patch.venueId ?? current.venueId,
      recurrence,
    };
    return saveEvent(ctx, fields, previous);
  }),
  "mcp/events/publish": route(validId, async ({ id }, ctx) => {
    const event = await getEvent(ctx, id);
    if (!event) return { ok: false, error: "NOT_FOUND" };
    const updated = {
      ...event,
      published: true,
      status: normalizeEventStatus(true, event.status),
      updatedAt: new Date().toISOString(),
    };
    await putEvent(ctx, updated);
    return { ok: true, event: updated };
  }),
  "mcp/events/unpublish": route(validId, async ({ id }, ctx) => {
    const event = await getEvent(ctx, id);
    if (!event) return { ok: false, error: "NOT_FOUND" };
    const updated = {
      ...event,
      published: false,
      status: normalizeEventStatus(false, event.status),
      updatedAt: new Date().toISOString(),
    };
    await putEvent(ctx, updated);
    return { ok: true, event: updated };
  }),
  "mcp/events/delete": route(validId, async ({ id }, ctx) => ({
    ok: true,
    deleted: await deleteEvent(ctx, id),
  })),
  "mcp/events/exception/set": route(validExceptionSet, async (input, ctx) => {
    const event = await getEvent(ctx, input.eventId);
    if (!event) return { ok: false, error: "NOT_FOUND" };
    if (!event.recurrence) return { ok: false, error: "NOT_RECURRING" };
    const day = input.recurrenceId.slice(0, 10);
    const timedId = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
    if (
      !isDateOnly(day) ||
      (event.allDay
        ? input.recurrenceId !== day
        : !timedId.test(input.recurrenceId))
    )
      return { ok: false, error: "INVALID_RECURRENCE_ID" };
    if (!scheduledOccurrence(event, input.recurrenceId))
      return { ok: false, error: "OCCURRENCE_NOT_FOUND" };
    let exception: EventException;
    if (input.status === "cancelled")
      exception = { recurrenceId: input.recurrenceId, status: "cancelled" };
    else {
      if (!input.overrides || !Object.keys(input.overrides).length)
        return { ok: false, error: "OVERRIDES_REQUIRED" };
      const patch = input.overrides;
      const allDay = patch.allDay ?? event.allDay;
      const timezone = patch.timezone ?? event.timezone;
      const start = patch.start;
      const end = patch.end;
      if ((start === undefined) !== (end === undefined))
        return { ok: false, error: "START_AND_END_REQUIRED" };
      if (allDay !== event.allDay && start === undefined)
        return { ok: false, error: "REPLACEMENT_SCHEDULE_REQUIRED" };
      const overrides: NonNullable<EventException["overrides"]> = { ...patch };
      if (start && end) {
        const normalized = normalizeEventDates({
          start,
          end,
          allDay,
          timezone,
        });
        if (!normalized.dates)
          return validationResult(
            normalized.errors.start ??
              normalized.errors.end ??
              normalized.errors.timezone ??
              "Check the replacement schedule.",
          );
        overrides.start = normalized.dates.start;
        overrides.end = normalized.dates.end;
      }
      if (
        patch.virtualUrl !== undefined &&
        patch.virtualUrl &&
        !safeHttpUrl(patch.virtualUrl)
      )
        return validationResult("Virtual URL must use HTTP or HTTPS.");
      if (patch.virtualUrl !== undefined)
        overrides.virtualUrl = safeHttpUrl(patch.virtualUrl);
      if (patch.status !== undefined)
        overrides.status = normalizeEventStatus(event.published, patch.status);
      if (
        patch.externalUrl !== undefined &&
        patch.externalUrl &&
        !safeHttpUrl(patch.externalUrl)
      )
        return validationResult(EXTERNAL_URL_ERROR);
      if (
        patch.imageUrl !== undefined &&
        patch.imageUrl &&
        !safeHttpUrl(patch.imageUrl)
      )
        return validationResult("Image URL must use HTTP or HTTPS.");
      if (!isValidTimeZone(timezone))
        return validationResult("Choose a valid IANA timezone.");
      if (patch.categories)
        overrides.categories = normalizeCategories(patch.categories);
      exception = {
        recurrenceId: input.recurrenceId,
        status: "modified",
        overrides,
      };
    }
    const exceptions = [
      ...event.exceptions.filter(
        (item) => item.recurrenceId !== input.recurrenceId,
      ),
      exception,
    ].sort((a, b) => a.recurrenceId.localeCompare(b.recurrenceId));
    if (exceptions.length > 500)
      return { ok: false, error: "TOO_MANY_EXCEPTIONS" };
    const updated = {
      ...event,
      exceptions,
      updatedAt: new Date().toISOString(),
    };
    await putEvent(ctx, updated);
    return { ok: true, event: updated };
  }),
  "mcp/events/exception/remove": route(
    validExceptionRemove,
    async ({ eventId, recurrenceId }, ctx) => {
      const event = await getEvent(ctx, eventId);
      if (!event) return { ok: false, error: "NOT_FOUND" };
      const exceptions = event.exceptions.filter(
        (item) => item.recurrenceId !== recurrenceId,
      );
      if (exceptions.length === event.exceptions.length)
        return { ok: false, error: "EXCEPTION_NOT_FOUND" };
      const updated = {
        ...event,
        exceptions,
        updatedAt: new Date().toISOString(),
      };
      await putEvent(ctx, updated);
      return { ok: true, event: updated };
    },
  ),
  "mcp/venues/list": route(
    validEmpty,
    async (_input, ctx) => {
      const schema = await nativeSchema(ctx);
      if (schema) {
        const entries = await listNative(ctx, referenceTarget(schema, "venue"));
        const venues = entries.map(normalizeVenueRecord).filter(Boolean);
        return { ok: true, venues };
      }
      return { ok: true, venues: await listVenues(ctx) };
    },
    true,
  ),
  "mcp/venues/create": route(
    (input) => validVenueInput(input),
    async (input, ctx) => {
      const venue = venueInput(input);
      await putVenue(ctx, venue);
      return { ok: true, venue };
    },
  ),
  "mcp/venues/update": route(validVenuePatch, async ({ id, patch }, ctx) => {
    if (!Object.keys(patch).length) return { ok: false, error: "EMPTY_PATCH" };
    const previous = await getVenue(ctx, id);
    if (!previous) return { ok: false, error: "NOT_FOUND" };
    const venue = venueInput({ ...previous, ...patch }, previous);
    await putVenue(ctx, venue);
    return { ok: true, venue };
  }),
  "mcp/venues/delete": route(validId, async ({ id }, ctx) => {
    if (!(await getVenue(ctx, id))) return { ok: false, error: "NOT_FOUND" };
    if (await listEventsByVenueId(ctx, id))
      return { ok: false, error: "VENUE_IN_USE" };
    return { ok: true, deleted: await deleteVenue(ctx, id) };
  }),
  "mcp/settings/get": route(
    validEmpty,
    async (_input, ctx) => ({
      ok: true,
      defaultTimezone:
        (await ctx.settings.get<string>("defaultTimezone")) ?? "UTC",
      collections: await collectionSettings(ctx) ?? null,
    }),
    true,
  ),
  "mcp/settings/update": route(
    validSettingsUpdate,
    async ({ defaultTimezone, collections }, ctx) => {
      if (!isValidTimeZone(defaultTimezone))
        return { ok: false, error: "INVALID_TIMEZONE" };
      if(collections) {
        try { await saveCollectionBindings(ctx,collections); }
        catch(error) {return {ok:false,error:'INVALID_COLLECTIONS',details:error instanceof Error?error.message:'Review the collection schemas.'};}
      }
      await ctx.settings.set("defaultTimezone", defaultTimezone);
      return { ok: true, defaultTimezone };
    },
    true,
  ),
};
