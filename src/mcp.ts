import type { McpEventInput } from "./mcp-schemas";

import { normalizeCategories } from "./domain/category";
import { isDateOnly, isValidTimeZone } from "./domain/date-time";
import { eventToDraft, prepareEventData } from "./domain/event-data";
import type { EventDraft, EventException, EventRecord, EventRecurrence, VenueFields, VenueRecord } from "./domain/event";
import { exceptionIdsMatchRecurrence, expandEventsInDateRange } from "./domain/recurrence";
import { safeHttpUrl } from "./domain/venue";
import {
	deleteEvent,
	deleteVenue,
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

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validText(value: unknown, max: number, min = 0): value is string {
	return typeof value === "string" && value.length >= min && value.length <= max;
}

function validRecurrence(value: unknown): value is EventRecurrence {
	if (!isObject(value) || !isDateOnly(String(value.until ?? ""))) return false;
	if (value.frequency === "daily" || value.frequency === "weekly") return true;
	if (value.frequency !== "monthly" || !isObject(value.pattern)) return false;
	const pattern = value.pattern;
	if (pattern.type === "dayOfMonth") return Number.isInteger(pattern.dayOfMonth) && Number(pattern.dayOfMonth) >= 1 && Number(pattern.dayOfMonth) <= 31 && (pattern.missingDayBehavior === "skip" || pattern.missingDayBehavior === "lastDay");
	return pattern.type === "weekdayOfMonth" && ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].includes(String(pattern.weekday)) && ([1, 2, 3, 4, 5].includes(Number(pattern.position)) || pattern.position === "last");
}

function validEventInput(value: unknown, patch = false): boolean {
	if (!isObject(value)) return false;
	if (!patch && (!validText(value.title, 200, 1) || !validText(value.start, 32, 1) || !validText(value.end, 32, 1) || typeof value.allDay !== "boolean")) return false;
	if (patch && !Object.keys(value).length) return false;
	for (const [key, max] of Object.entries({ title: 200, description: 12000, start: 32, end: 32, timezone: 100, location: 500, organizer: 300, externalUrl: 2048, imageUrl: 2048, imageMediaId: 200, venueId: 200 })) {
		if (value[key] !== undefined && !validText(value[key], max, key === "title" ? 1 : 0)) return false;
	}
	if (value.allDay !== undefined && typeof value.allDay !== "boolean") return false;
	if (value.categories !== undefined && (!Array.isArray(value.categories) || value.categories.length > 30 || !value.categories.every((item) => validText(item, 100)))) return false;
	if (value.recurrence !== undefined && value.recurrence !== null && !validRecurrence(value.recurrence)) return false;
	return true;
}

function validVenueInput(value: unknown, patch = false): boolean {
	if (!isObject(value) || (patch && !Object.keys(value).length) || (!patch && !validText(value.name, 200, 1))) return false;
	for (const [key, max] of Object.entries({ name: 200, street: 300, street2: 300, locality: 150, region: 150, postalCode: 40, country: 100 })) {
		if (value[key] !== undefined && !validText(value[key], max, key === "name" ? 1 : 0)) return false;
	}
	return true;
}

function validEventPatch(value: unknown): boolean { return isObject(value) && validText(value.id, 200, 1) && validEventInput(value.patch, true); }
function validVenuePatch(value: unknown): boolean { return isObject(value) && validText(value.id, 200, 1) && validVenueInput(value.patch, true); }
function validId(value: unknown): boolean { return isObject(value) && validText(value.id, 200, 1); }
function validEmpty(value: unknown): boolean { return isObject(value) && !Object.keys(value).length; }
function validListEvents(value: unknown): boolean {
	return isObject(value) && (value.from === undefined || isDateOnly(String(value.from))) && (value.through === undefined || isDateOnly(String(value.through))) &&
		(value.includeDrafts === undefined || typeof value.includeDrafts === "boolean") && (value.limit === undefined || Number.isInteger(value.limit) && Number(value.limit) >= 1 && Number(value.limit) <= 100);
}
function validExceptionSet(value: unknown): boolean {
	if (!isObject(value) || !validText(value.eventId, 200, 1) || !validText(value.recurrenceId, 16) || (value.status !== "cancelled" && value.status !== "modified")) return false;
	if (value.overrides === undefined) return true;
	if (!isObject(value.overrides)) return false;
	for (const [key, max] of Object.entries({ title: 200, description: 12000, start: 32, end: 32, timezone: 100, location: 500, organizer: 300, externalUrl: 2048, imageUrl: 2048 })) {
		if (value.overrides[key] !== undefined && !validText(value.overrides[key], max, key === "title" ? 1 : 0)) return false;
	}
	if (value.overrides.allDay !== undefined && typeof value.overrides.allDay !== "boolean") return false;
	return value.overrides.categories === undefined || Array.isArray(value.overrides.categories) && value.overrides.categories.length <= 30 && value.overrides.categories.every((item) => validText(item, 100));
}
function validExceptionRemove(value: unknown): boolean { return isObject(value) && validText(value.eventId, 200, 1) && validText(value.recurrenceId, 16); }
function validSettingsUpdate(value: unknown): boolean { return isObject(value) && validText(value.defaultTimezone, 100, 1); }

function route(validate: (input: unknown) => boolean, run: (input: any, ctx: EventualContext) => Promise<unknown>) {
	return {
		permission: "plugins:manage" as const,
		handler: async (routeCtx: { input: unknown }, ctx: EventualContext) => {
			if (!validate(routeCtx.input)) return { ok: false, error: "VALIDATION_ERROR" };
			return run(routeCtx.input, ctx);
		},
	};
}

function draftFromFields(fields: McpEventInput, base?: EventRecord): EventDraft {
	const draft = base ? eventToDraft(base) : {
		title: "", description: "", start: "", end: "", allDay: false, timezone: "UTC", location: "", organizer: "",
		externalUrl: "", imageUrl: "", imageMediaId: "", categories: "", venueId: "", published: false,
		repeatFrequency: "none" as const, recurrenceUntil: "", monthlyPattern: "dayOfMonth" as const,
		missingDayBehavior: "skip" as const, monthlyWeekday: "monday" as const, monthlyPosition: 1 as const, exceptions: [],
	};
	const recurrence = fields.recurrence === null ? undefined : fields.recurrence ?? base?.recurrence;
	return {
		...draft,
		title: fields.title ?? draft.title,
		description: fields.description ?? draft.description,
		start: fields.start ?? draft.start,
		end: fields.end ?? draft.end,
		allDay: fields.allDay ?? draft.allDay,
		timezone: fields.timezone ?? draft.timezone,
		location: fields.location ?? draft.location,
		organizer: fields.organizer ?? draft.organizer,
		externalUrl: fields.externalUrl ?? draft.externalUrl,
		imageUrl: fields.imageUrl ?? draft.imageUrl,
		categories: fields.categories ? fields.categories.join(", ") : draft.categories,
		venueId: fields.venueId ?? draft.venueId,
		imageMediaId: fields.imageMediaId ?? draft.imageMediaId,
		repeatFrequency: recurrence?.frequency ?? "none",
		recurrenceUntil: recurrence?.until ?? "",
		monthlyPattern: recurrence?.frequency === "monthly" ? recurrence.pattern.type : "dayOfMonth",
		missingDayBehavior: recurrence?.frequency === "monthly" && recurrence.pattern.type === "dayOfMonth" ? recurrence.pattern.missingDayBehavior : "skip",
		monthlyWeekday: recurrence?.frequency === "monthly" && recurrence.pattern.type === "weekdayOfMonth" ? recurrence.pattern.weekday : "monday",
		monthlyPosition: recurrence?.frequency === "monthly" && recurrence.pattern.type === "weekdayOfMonth" ? recurrence.pattern.position : 1,
	};
}

function validationResult(error: string) { return { ok: false, error: "INVALID_EVENT", details: [error] }; }

async function saveEvent(ctx: EventualContext, fields: McpEventInput, previous?: EventRecord) {
	const draft = draftFromFields(fields, previous);
	const prepared = prepareEventData(draft);
	if (!prepared.data) return validationResult(prepared.error ?? "Check the event fields.");
	if (prepared.data.externalUrl && !safeHttpUrl(prepared.data.externalUrl)) return validationResult("External URL must use HTTP or HTTPS.");
	if (draft.imageMediaId && !(await isUsableEventImage(ctx, draft.imageMediaId))) return validationResult("Choose a ready JPEG, PNG, GIF, WebP, or AVIF media image under 8 MiB.");
	if (draft.venueId && !(await getVenue(ctx, draft.venueId))) return validationResult("The selected saved venue does not exist.");
	const now = new Date().toISOString();
	const event: EventRecord = {
		...prepared.data,
		id: previous?.id ?? crypto.randomUUID(),
		exceptions: previous?.exceptions ?? [],
		createdAt: previous?.createdAt ?? now,
		updatedAt: now,
	};
	if (!exceptionIdsMatchRecurrence(event)) return validationResult("Changing this schedule would invalidate occurrence exceptions. Remove or update those exceptions first.");
	await putEvent(ctx, event);
	return { ok: true, event };
}

function venueInput(fields: VenueFields, previous?: VenueRecord): VenueRecord {
	const now = new Date().toISOString();
	return {
		name: fields.name.trim(), street: fields.street?.trim() ?? "", street2: fields.street2?.trim() ?? "",
		locality: fields.locality?.trim() ?? "", region: fields.region?.trim() ?? "", postalCode: fields.postalCode?.trim() ?? "",
		country: fields.country?.trim() ?? "", id: previous?.id ?? crypto.randomUUID(), createdAt: previous?.createdAt ?? now, updatedAt: now,
	};
}

function addDays(value: string, count: number): string {
	const result = new Date(`${value}T00:00:00.000Z`);
	result.setUTCDate(result.getUTCDate() + count);
	return result.toISOString().slice(0, 10);
}

export const mcpRoutes = {
	"mcp/events/list": route(validListEvents, async (input, ctx) => {
		const today = new Date().toISOString().slice(0, 10);
		const from = input.from ?? today;
		const through = input.through ?? addDays(from, 180);
		if (from > through || Date.parse(`${through}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`) > 365 * 86400000) return { ok: false, error: "INVALID_DATE_RANGE" };
		const stored = await listEvents(ctx, { published: input.includeDrafts ? undefined : true, maxItems: 5000 });
		const occurrences = expandEventsInDateRange(stored, from, through).slice(0, input.limit ?? 50);
		const venues = await listVenuesById(ctx, occurrences.flatMap((event) => event.venueId ? [event.venueId] : []));
		return { ok: true, from, through, events: occurrences.map((event) => ({ ...event, venue: event.venueId ? venues.get(event.venueId) ?? null : null })) };
	}),
	"mcp/events/get": route(validId, async ({ id }, ctx) => {
		const event = await getEvent(ctx, id);
		if (!event) return { ok: false, error: "NOT_FOUND" };
		return { ok: true, event, venue: event.venueId ? await getVenue(ctx, event.venueId) : null };
	}),
	"mcp/events/create": route((input) => validEventInput(input), async (input, ctx) => saveEvent(ctx, input)),
	"mcp/events/update": route(validEventPatch, async ({ id, patch }, ctx) => {
		if (!Object.keys(patch).length) return { ok: false, error: "EMPTY_PATCH" };
		const previous = await getEvent(ctx, id);
		if (!previous) return { ok: false, error: "NOT_FOUND" };
		const current = eventToDraft(previous);
		const recurrence = patch.recurrence === undefined ? previous.recurrence : patch.recurrence;
		const fields = {
			title: patch.title ?? current.title,
			description: patch.description ?? current.description,
			start: patch.start ?? current.start,
			end: patch.end ?? current.end,
			allDay: patch.allDay ?? current.allDay,
			timezone: patch.timezone ?? current.timezone,
			location: patch.location ?? current.location,
			organizer: patch.organizer ?? current.organizer,
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
		const updated = { ...event, published: true, updatedAt: new Date().toISOString() };
		await putEvent(ctx, updated);
		return { ok: true, event: updated };
	}),
	"mcp/events/unpublish": route(validId, async ({ id }, ctx) => {
		const event = await getEvent(ctx, id);
		if (!event) return { ok: false, error: "NOT_FOUND" };
		const updated = { ...event, published: false, updatedAt: new Date().toISOString() };
		await putEvent(ctx, updated);
		return { ok: true, event: updated };
	}),
	"mcp/events/delete": route(validId, async ({ id }, ctx) => ({ ok: true, deleted: await deleteEvent(ctx, id) })),
	"mcp/events/exception/set": route(validExceptionSet, async (input, ctx) => {
		const event = await getEvent(ctx, input.eventId);
		if (!event) return { ok: false, error: "NOT_FOUND" };
		if (!event.recurrence) return { ok: false, error: "NOT_RECURRING" };
		const day = input.recurrenceId.slice(0, 10);
		const timedId = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
		if (!isDateOnly(day) || (event.allDay ? input.recurrenceId !== day : !timedId.test(input.recurrenceId))) return { ok: false, error: "INVALID_RECURRENCE_ID" };
		const scheduled = expandEventsInDateRange([{ ...event, exceptions: [] }], day, day);
		if (!scheduled.some((item) => item.id === `${event.id}#${input.recurrenceId}`)) return { ok: false, error: "OCCURRENCE_NOT_FOUND" };
		let exception: EventException;
		if (input.status === "cancelled") exception = { recurrenceId: input.recurrenceId, status: "cancelled" };
		else {
			if (!input.overrides || !Object.keys(input.overrides).length) return { ok: false, error: "OVERRIDES_REQUIRED" };
			const patch = input.overrides;
			const allDay = patch.allDay ?? event.allDay;
			const timezone = patch.timezone ?? event.timezone;
			const start = patch.start;
			const end = patch.end;
			if ((start === undefined) !== (end === undefined)) return { ok: false, error: "START_AND_END_REQUIRED" };
			if (allDay !== event.allDay && start === undefined) return { ok: false, error: "REPLACEMENT_SCHEDULE_REQUIRED" };
			const overrides: NonNullable<EventException["overrides"]> = { ...patch };
			if (start && end) {
				const normalized = normalizeEventDates({ start, end, allDay, timezone });
				if (!normalized.dates) return validationResult(normalized.errors.start ?? normalized.errors.end ?? normalized.errors.timezone ?? "Check the replacement schedule.");
				overrides.start = normalized.dates.start;
				overrides.end = normalized.dates.end;
			}
			if (patch.externalUrl !== undefined && patch.externalUrl && !safeHttpUrl(patch.externalUrl)) return validationResult("External URL must use HTTP or HTTPS.");
			if (patch.imageUrl !== undefined && patch.imageUrl && !safeHttpUrl(patch.imageUrl)) return validationResult("Image URL must use HTTP or HTTPS.");
			if (!isValidTimeZone(timezone)) return validationResult("Choose a valid IANA timezone.");
			if (patch.categories) overrides.categories = normalizeCategories(patch.categories);
			exception = { recurrenceId: input.recurrenceId, status: "modified", overrides };
		}
		const exceptions = [...event.exceptions.filter((item) => item.recurrenceId !== input.recurrenceId), exception].sort((a, b) => a.recurrenceId.localeCompare(b.recurrenceId));
		if (exceptions.length > 500) return { ok: false, error: "TOO_MANY_EXCEPTIONS" };
		const updated = { ...event, exceptions, updatedAt: new Date().toISOString() };
		await putEvent(ctx, updated);
		return { ok: true, event: updated };
	}),
	"mcp/events/exception/remove": route(validExceptionRemove, async ({ eventId, recurrenceId }, ctx) => {
		const event = await getEvent(ctx, eventId);
		if (!event) return { ok: false, error: "NOT_FOUND" };
		const exceptions = event.exceptions.filter((item) => item.recurrenceId !== recurrenceId);
		if (exceptions.length === event.exceptions.length) return { ok: false, error: "EXCEPTION_NOT_FOUND" };
		const updated = { ...event, exceptions, updatedAt: new Date().toISOString() };
		await putEvent(ctx, updated);
		return { ok: true, event: updated };
	}),
	"mcp/venues/list": route(validEmpty, async (_input, ctx) => ({ ok: true, venues: await listVenues(ctx) })),
	"mcp/venues/create": route((input) => validVenueInput(input), async (input, ctx) => {
		const venue = venueInput(input);
		await putVenue(ctx, venue);
		return { ok: true, venue };
	}),
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
		if (await listEventsByVenueId(ctx, id)) return { ok: false, error: "VENUE_IN_USE" };
		return { ok: true, deleted: await deleteVenue(ctx, id) };
	}),
	"mcp/settings/get": route(validEmpty, async (_input, ctx) => ({ ok: true, defaultTimezone: (await ctx.settings.get<string>("defaultTimezone")) ?? "UTC" })),
	"mcp/settings/update": route(validSettingsUpdate, async ({ defaultTimezone }, ctx) => {
		if (!isValidTimeZone(defaultTimezone)) return { ok: false, error: "INVALID_TIMEZONE" };
		await ctx.settings.set("defaultTimezone", defaultTimezone);
		return { ok: true, defaultTimezone };
	}),
};
