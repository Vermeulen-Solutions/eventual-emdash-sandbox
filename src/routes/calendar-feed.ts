import { expandEventsInDateRange } from "../domain/recurrence";
import { formatCalendarFeed } from "../domain/icalendar";
import { eventLocation } from "../domain/venue";
import { listCalendarCancellations, listEvents, listVenuesById, type EventualContext } from "../storage";

const SUBSCRIPTION_WINDOW_DAYS = 366;

function addDays(date: string, count: number): string {
	const result = new Date(`${date}T00:00:00Z`);
	result.setUTCDate(result.getUTCDate() + count);
	return result.toISOString().slice(0, 10);
}

export async function handleCalendarFeed(ctx: EventualContext, host: string): Promise<string> {
	const from = new Date().toISOString().slice(0, 10);
	const through = addDays(from, SUBSCRIPTION_WINDOW_DAYS - 1);
	const storedEvents = await listEvents(ctx, { published: true, maxItems: 5000 });
	const occurrences = expandEventsInDateRange(storedEvents, from, through);
	const venues = await listVenuesById(ctx, occurrences.flatMap((event) => event.venueId ? [event.venueId] : []));
	const events = occurrences.map((event) => ({
		...event,
		location: eventLocation(event.venueId ? venues.get(event.venueId) : undefined, event.location),
	}));
	return formatCalendarFeed(events, await listCalendarCancellations(ctx), host);
}
