import type { StorageCollection } from "emdash";
import type { PluginContext } from "emdash/plugin";

import type { EventRecord, VenueRecord } from "./domain/event";
import { expandEventsInDateRange } from "./domain/recurrence";

export type EventualContext = PluginContext;

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

export function getEventsById(ctx: EventualContext, ids: string[]): Promise<Map<string, EventRecord>> {
	return ids.length ? eventCollection(ctx).getMany([...new Set(ids)]) : Promise.resolve(new Map());
}

export function putEvent(ctx: EventualContext, event: EventRecord): Promise<void> {
	return writeEventAndCancellations(ctx, event);
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

export function deleteVenue(ctx: EventualContext, id: string): Promise<boolean> {
	return venueCollection(ctx).delete(id);
}

export async function listEvents(
	ctx: EventualContext,
	options: { published?: boolean; order?: "asc" | "desc"; maxItems?: number } = {},
): Promise<EventRecord[]> {
	const result: EventRecord[] = [];
	const maxItems = options.maxItems ?? 5000;
	let cursor: string | undefined;
	do {
		const page = await eventCollection(ctx).query({
			where: options.published === undefined ? undefined : { published: options.published },
			orderBy: { start: options.order ?? "asc" },
			limit: Math.min(100, maxItems - result.length),
			cursor,
		});
		result.push(...page.items.map((item) => item.data));
		cursor = page.cursor;
	} while (cursor && result.length < maxItems);
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
