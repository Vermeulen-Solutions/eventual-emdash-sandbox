import type { StorageCollection } from "emdash";
import type { PluginContext } from "emdash/plugin";

import type { EventRecord, VenueRecord } from "./domain/event";
import { expandEventsInDateRange } from "./domain/recurrence";

export type EventualContext = PluginContext;

export const MAX_EVENT_SCAN = 10_000;

export class EventScanLimitError extends Error {
	constructor(readonly limit: number) {
		super(`More than ${limit} events matched the request. Narrow the query or contact the site administrator.`);
		this.name = "EventScanLimitError";
	}
}

export interface CalendarCancellation {
	id: string;
	eventId: string;
	start: string;
	end: string;
	allDay: boolean;
	timezone: string;
	cancelledAt: string;
}

function eventCollection(ctx: EventualContext): StorageCollection<EventRecord> {
	return ctx.storage.events as StorageCollection<EventRecord>;
}

function venueCollection(ctx: EventualContext): StorageCollection<VenueRecord> {
	return ctx.storage.venues as StorageCollection<VenueRecord>;
}

function cancellationCollection(ctx: EventualContext): StorageCollection<CalendarCancellation> {
	return ctx.storage.calendar_cancellations as StorageCollection<CalendarCancellation>;
}

export function getEvent(ctx: EventualContext, id: string): Promise<EventRecord | null> {
	return eventCollection(ctx).get(id);
}

export function getEventVersioned(ctx: EventualContext, id: string) {
	return eventCollection(ctx).getVersioned(id);
}

export function getEventsById(ctx: EventualContext, ids: string[]): Promise<Map<string, EventRecord>> {
	return ids.length ? eventCollection(ctx).getMany([...new Set(ids)]) : Promise.resolve(new Map());
}

export function putEvent(ctx: EventualContext, event: EventRecord): Promise<void> {
	return writeEventAndCancellations(ctx, event);
}

export async function putEventIfUnchanged(ctx: EventualContext, event: EventRecord, expectedUpdatedAt: string): Promise<boolean> {
	const collection = eventCollection(ctx);
	const previous = await collection.getVersioned(event.id);
	if (!previous || previous.value.updatedAt !== expectedUpdatedAt) return false;
	const result = await collection.compareAndSet(event.id, previous.revision, event);
	if (!result.applied) return false;
	const activeIds = await syncCalendarCancellations(ctx, previous.value, event);
	if (activeIds.length) await cancellationCollection(ctx).deleteMany(activeIds);
	return true;
}

async function writeEventAndCancellations(ctx: EventualContext, event: EventRecord): Promise<void> {
	const previous = await eventCollection(ctx).get(event.id);
	const activeIds = await syncCalendarCancellations(ctx, previous, event);
	await eventCollection(ctx).put(event.id, event);
	if (activeIds.length) await cancellationCollection(ctx).deleteMany(activeIds);
}

export async function deleteEvent(ctx: EventualContext, id: string): Promise<boolean> {
	const previous = await eventCollection(ctx).get(id);
	await syncCalendarCancellations(ctx, previous, null);
	return eventCollection(ctx).delete(id);
}

async function syncCalendarCancellations(
	ctx: EventualContext,
	previous: EventRecord | null,
	next: EventRecord | null,
): Promise<string[]> {
	const today = new Date().toISOString().slice(0, 10);
	const throughDate = new Date(`${today}T00:00:00Z`);
	throughDate.setUTCDate(throughDate.getUTCDate() + 365);
	const through = throughDate.toISOString().slice(0, 10);
	const previousOccurrences = previous?.published ? expandEventsInDateRange([previous], today, through) : [];
	const nextOccurrences = next?.published ? expandEventsInDateRange([next], today, through) : [];
	const nextIds = new Set(nextOccurrences.map((occurrence) => occurrence.id));
	const activeIds = [...nextIds];
	const removed = previousOccurrences.filter((occurrence) => !nextIds.has(occurrence.id));
	if (removed.length) {
		const cancelledAt = new Date().toISOString();
		await cancellationCollection(ctx).putMany(removed.map((occurrence) => ({
			id: occurrence.id,
			data: {
				id: occurrence.id,
				eventId: previous!.id,
				start: occurrence.start,
				end: occurrence.end,
				allDay: occurrence.allDay,
				timezone: occurrence.timezone,
				cancelledAt,
			},
		})));
	}
	return activeIds;
}

export async function listCalendarCancellations(ctx: EventualContext): Promise<CalendarCancellation[]> {
	const result: CalendarCancellation[] = [];
	let cursor: string | undefined;
	do {
		const page = await cancellationCollection(ctx).query({ limit: 100, cursor });
		result.push(...page.items.map((item) => item.data));
		cursor = page.cursor;
	} while (cursor);
	return result;
}

export function getVenue(ctx: EventualContext, id: string): Promise<VenueRecord | null> {
	return venueCollection(ctx).get(id);
}

export function putVenue(ctx: EventualContext, venue: VenueRecord): Promise<void> {
	return venueCollection(ctx).put(venue.id, venue);
}

export async function getVenueVersioned(ctx: EventualContext, id: string) {
	return venueCollection(ctx).getVersioned(id);
}

export async function putVenueIfUnchanged(ctx: EventualContext, venue: VenueRecord, expectedUpdatedAt: string): Promise<boolean> {
	const collection = venueCollection(ctx);
	const previous = await collection.getVersioned(venue.id);
	if (!previous || previous.value.updatedAt !== expectedUpdatedAt) return false;
	return (await collection.compareAndSet(venue.id, previous.revision, venue)).applied;
}

export function deleteVenue(ctx: EventualContext, id: string): Promise<boolean> {
	return venueCollection(ctx).delete(id);
}

export async function listEventsByVenueId(ctx: EventualContext, id: string): Promise<boolean> {
	return (await eventCollection(ctx).count({ venueId: id })) > 0;
}

export async function listEvents(
	ctx: EventualContext,
	options: { published?: boolean; through?: string; order?: "asc" | "desc"; maxItems?: number } = {},
): Promise<EventRecord[]> {
	const result: EventRecord[] = [];
	const maxItems = options.maxItems ?? MAX_EVENT_SCAN;
	if (!Number.isInteger(maxItems) || maxItems < 1 || maxItems > MAX_EVENT_SCAN) {
		throw new RangeError(`maxItems must be between 1 and ${MAX_EVENT_SCAN}`);
	}
	let cursor: string | undefined;
	// Timed events can fall on the following UTC date for a local date at the
	// end of the requested window. Keep a one-day cushion for that offset.
	const upperBound = options.through ? new Date(Date.parse(`${options.through}T00:00:00Z`) + 2 * 86_400_000).toISOString().slice(0, 10) : undefined;
	do {
		const page = await eventCollection(ctx).query({
			where: {
				...(options.published === undefined ? {} : { published: options.published }),
				...(upperBound ? { start: { lt: upperBound } } : {}),
			},
			orderBy: { start: options.order ?? "asc" },
			limit: Math.min(100, maxItems - result.length),
			cursor,
		});
		result.push(...page.items.map((item) => item.data));
		if (page.hasMore && !page.cursor) throw new Error("Event storage returned an incomplete page without a cursor.");
		cursor = page.hasMore ? page.cursor : undefined;
		if (cursor && result.length >= maxItems) throw new EventScanLimitError(maxItems);
	} while (cursor);
	return result;
}

export async function listVenues(ctx: EventualContext): Promise<VenueRecord[]> {
	const result: VenueRecord[] = [];
	let cursor: string | undefined;
	do {
		const page = await venueCollection(ctx).query({
			orderBy: { name: "asc" },
			limit: 100,
			cursor,
		});
		result.push(...page.items.map((item) => item.data));
		cursor = page.cursor;
	} while (cursor && result.length < 5000);
	return result;
}

export async function listVenuesById(
	ctx: EventualContext,
	ids: string[],
): Promise<Map<string, VenueRecord>> {
	if (!ids.length) return new Map();
	return venueCollection(ctx).getMany([...new Set(ids)]);
}
