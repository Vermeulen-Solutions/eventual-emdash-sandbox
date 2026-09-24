import { expandEventsInDateRange } from "../domain/recurrence";
import { isDateOnly } from "../domain/date-time";
import { categoryKey } from "../domain/category";
import { formatPublicEvent } from "../public-event";
import { listEvents, listVenuesById, type EventualContext } from "../storage";

const MAX_PUBLIC_EVENT_RANGE_DAYS = 366;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function addDays(date: string, count: number): string {
	const result = new Date(`${date}T00:00:00Z`);
	result.setUTCDate(result.getUTCDate() + count);
	return result.toISOString().slice(0, 10);
}

export async function handlePublicEvents(input: unknown, ctx: EventualContext) {
	if (!isRecord(input) || ["from", "through", "category"].some((key) => input[key] !== undefined && typeof input[key] !== "string")) {
		return { ok: false, error: "INVALID_QUERY" };
	}
	const today = new Date().toISOString().slice(0, 10);
	const from = (input.from as string | undefined) ?? today;
	const through = (input.through as string | undefined) ?? addDays(from, 180);
	if (!isDateOnly(from) || !isDateOnly(through) || from > through) {
		return { ok: false, error: "INVALID_DATE_RANGE" };
	}
	const span = (Date.parse(`${through}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
	if (span + 1 > MAX_PUBLIC_EVENT_RANGE_DAYS) {
		return { ok: false, error: "DATE_RANGE_TOO_LARGE", maxDays: MAX_PUBLIC_EVENT_RANGE_DAYS };
	}

	const storedEvents = await listEvents(ctx, { published: true, maxItems: 5000 });
	const expanded = expandEventsInDateRange(storedEvents, from, through);
	const category = input.category ? categoryKey(input.category as string) : "";
	const visible = category
		? expanded.filter((event) => event.categories.some((item) => categoryKey(item) === category))
		: expanded;
	const venues = await listVenuesById(ctx, visible.flatMap((event) => event.venueId ? [event.venueId] : []));

	return {
		ok: true,
		from,
		through,
		events: visible.map((event) => formatPublicEvent(
			event,
			event.venueId ? venues.get(event.venueId) : undefined,
			ctx.plugin.id,
		)),
	};
}
