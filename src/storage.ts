import { reject } from './domain/messages';
import type { StorageCollection } from "emdash";
import type { PluginContext } from "emdash/plugin";

import type { EventRecord, VenueRecord, OrganizerRecord } from "./domain/event";
import { withScheduleHistory } from './domain/schedule-history';
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
	translationGroup?: string;
	calendarUid?: string;
	calendarSequence?: number;
	locale?: string;
	locales?: string[];
	categories?: string[];
	feedCategory?: string;
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

export function putEvent(ctx: EventualContext, event: EventRecord): Promise<EventRecord> {
	return writeEventAndCancellations(ctx, event);
}

export function nextUpdatedAt(previous?: string): string {
	return new Date(Math.max(Date.now(), Date.parse(previous ?? '') + 1 || 0)).toISOString();
}

export async function putEventIfUnchanged(ctx: EventualContext, event: EventRecord, expectedUpdatedAt: string): Promise<boolean> {
	const collection = eventCollection(ctx);
	const previous = await collection.getVersioned(event.id);
	if (!previous || previous.value.updatedAt !== expectedUpdatedAt) return false;
	event = { ...event, updatedAt: nextUpdatedAt(previous.value.updatedAt) };
	event = withScheduleHistory(previous.value, event);
	const result = await collection.compareAndSet(event.id, previous.revision, event);
	if (!result.applied) return false;
	const activeIds = await syncCalendarCancellations(ctx, previous.value, event);
	for(let i=0;i<activeIds.length;i+=100) await cancellationCollection(ctx).deleteMany(activeIds.slice(i,i+100));
	return true;
}

async function writeEventAndCancellations(ctx: EventualContext, event: EventRecord): Promise<EventRecord> {
	const previous = await eventCollection(ctx).get(event.id);
	event = withScheduleHistory(previous, event);
	const activeIds = await syncCalendarCancellations(ctx, previous, event);
	await eventCollection(ctx).put(event.id, event);
	for(let i=0;i<activeIds.length;i+=100) await cancellationCollection(ctx).deleteMany(activeIds.slice(i,i+100));
	return event;
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
	const localeKey = (locale: string, id: string) => 'locale:' + locale.toLowerCase() + ':' + id;
	const activeIds = [...nextIds, ...nextOccurrences.flatMap(item=>Object.keys(next?.translations ?? {}).map(locale=>localeKey(locale,item.id)))];
	const removed = previousOccurrences.filter((occurrence) => !nextIds.has(occurrence.id));
	const removedLocales = Object.keys(previous?.translations ?? {}).filter(locale=>!Object.hasOwn(next?.translations ?? {},locale));
	const localized = next ? previousOccurrences.flatMap(item=>removedLocales.map(locale=>({item,locale}))) : [];
	const cancelledAt = new Date().toISOString();
	const tombstones: {id: string; data: CalendarCancellation}[] = localized.map(({item,locale}) => ({id:localeKey(locale,item.id),data:{id:item.id,eventId:previous!.id,start:item.start,end:item.end,allDay:item.allDay,timezone:item.timezone,cancelledAt,locale:locale.toLowerCase(),categories:item.categories,calendarUid:previous!.calendarUid,translationGroup:previous!.translationGroup,calendarSequence:next?.calendarSequence}}));
	if (removed.length) {
		tombstones.push(...removed.map((occurrence) => ({
			id: occurrence.id,
			data: {
				id: occurrence.id,
				eventId: previous!.id,
				start: occurrence.start,
				end: occurrence.end,
				allDay: occurrence.allDay,
				timezone: occurrence.timezone,
				cancelledAt,
				translationGroup: occurrence.translationGroup ?? previous!.translationGroup,
				calendarUid: previous!.calendarUid,
				calendarSequence: next?.calendarSequence ?? (previous!.calendarSequence ?? Math.floor(Date.parse(previous!.updatedAt)/1000)) + 1,
				categories: occurrence.categories,
				locales: occurrence.locale ? [occurrence.locale.toLowerCase(), ...Object.keys(previous!.translations ?? {}).map(locale=>locale.toLowerCase())] : undefined,
			},
		})));
	}
	if (tombstones.length) await cancellationCollection(ctx).putMany(tombstones);
	return activeIds;
}

export async function listCalendarCancellations(ctx: EventualContext): Promise<CalendarCancellation[]> {
	const result: CalendarCancellation[] = [];
	let cursor: string | undefined;
	do {
		const page = await cancellationCollection(ctx).query({ limit: 100, cursor });
		result.push(...page.items.map((item) => item.data));
		if (page.hasMore && (!page.cursor || page.cursor===cursor)) reject('Incomplete cancellation cursor.');
		if (result.length > MAX_EVENT_SCAN) throw new EventScanLimitError(MAX_EVENT_SCAN);
		cursor = page.hasMore ? page.cursor : undefined;
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
	venue = {...venue,updatedAt:nextUpdatedAt(previous.value.updatedAt)};
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
	const seen = new Set<string>();
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
		if (page.hasMore && !page.cursor) reject("Event storage returned an incomplete page without a cursor.");
		if (page.hasMore && seen.has(page.cursor!)) reject('Event storage returned a repeated cursor.');
		if (page.cursor) seen.add(page.cursor);
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
		if (page.hasMore && (!page.cursor || page.cursor===cursor)) reject('Incomplete venue cursor.');
		if (result.length > 5000) throw new EventScanLimitError(5000);
		cursor = page.hasMore ? page.cursor : undefined;
	} while (cursor);
	return result;
}

export async function listVenuesById(
	ctx: EventualContext,
	ids: string[],
): Promise<Map<string, VenueRecord>> {
	if (!ids.length) return new Map();
	return venueCollection(ctx).getMany([...new Set(ids)]);
}

export function organizerCollection(ctx: EventualContext): StorageCollection<OrganizerRecord> {
  return ctx.storage.organizers as StorageCollection<OrganizerRecord>;
}

export async function listOrganizers(ctx: EventualContext): Promise<OrganizerRecord[]> {
  const items: OrganizerRecord[] = [];
  let cursor: string | undefined;
  do {
    const page = await organizerCollection(ctx).query({ orderBy: { name: 'asc' }, limit: 100, cursor });
    items.push(...page.items.map(item => item.data));
    if (page.hasMore && (!page.cursor || items.length >= 5000)) reject('Organizer list exceeds the supported scan limit or has an incomplete page.');
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return items;
}

export function listOrganizersById(ctx: EventualContext, ids: string[]): Promise<Map<string, OrganizerRecord>> {
  return ids.length ? organizerCollection(ctx).getMany([...new Set(ids)]) : Promise.resolve(new Map());
}
