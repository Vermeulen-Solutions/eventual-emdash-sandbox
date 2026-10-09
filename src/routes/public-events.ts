import { expandEventsInDateRange } from "../domain/recurrence";
import { isDateOnly } from "../domain/date-time";
import { categoryKey } from "../domain/category";
import { formatPublicEvent } from "../public-event";
import { EventScanLimitError, listVenuesById, listOrganizersById, type EventualContext } from "../storage";
import { readEventSource, resolveEventVenues, selectEventLocales, hydrateNativeAssets } from '../domain/native-source';
import { eventRecordToPublicEvent } from '../domain/event-expansion';
import { withInvocationBudget, SandboxBudgetError } from '../domain/invocation-budget';

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
  try { return await readPublicEvents(input, withInvocationBudget(ctx)); }
  catch (error) { if (error instanceof SandboxBudgetError) return {ok:false,error:'SANDBOX_BUDGET_EXCEEDED',details:error.message,events:undefined}; throw error; }
}
async function readPublicEvents(input: unknown, ctx: EventualContext) {
	const invalidQuery = { ok: false as const, error: "INVALID_QUERY" };
	if (!isRecord(input) || ["from", "through", "category", "locale"].some((key) => input[key] !== undefined && typeof input[key] !== "string") || [input.strict, input.publicUrls].some((value) => !([undefined, true, false, 'true', 'false'] as unknown[]).includes(value))) {
		return invalidQuery;
	}
	try { if (input.locale) Intl.getCanonicalLocales(input.locale as string); } catch { return invalidQuery; }
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

	let storedEvents;
	let source;
	try {
		source = await readEventSource(ctx,through);
		storedEvents = selectEventLocales(source.events,input.locale as string|undefined,([true, 'true'] as unknown[]).includes(input.strict));
	} catch (error) {
		if (error instanceof EventScanLimitError) return { ok: false, error: "EVENT_LIMIT_EXCEEDED", maxEvents: error.limit };
		throw error;
	}
	const expanded = expandEventsInDateRange(storedEvents, from, through);
	const category = input.category ? categoryKey(input.category as string) : "";
	const visible = category
		? expanded.filter((event) => event.categories.some((item) => categoryKey(item) === category))
		: expanded;
	if (visible.length>10000) return {ok:false,error:'OCCURRENCE_LIMIT_EXCEEDED'};
	if (source!.native) {
		const venues=await resolveEventVenues(ctx,visible,source!.schema);
		const hydrated=await hydrateNativeAssets(ctx,visible,([undefined, true, 'true'] as unknown[]).includes(input.publicUrls));
		return {ok:true,from,through,events:hydrated.map(event=>eventRecordToPublicEvent(event,venues,ctx.site.url,ctx.plugin.id))};
	}
	const [venues, organizers] = await Promise.all([
		listVenuesById(ctx, visible.flatMap(event => event.venueId ? [event.venueId] : [])),
		listOrganizersById(ctx, visible.flatMap(event => event.organizerId ? [event.organizerId] : [])),
	]);

	return {
		ok: true,
		from,
		through,
		events: visible.map((event) => formatPublicEvent(
			event,
			event.venueId ? venues.get(event.venueId) : undefined,
			ctx.plugin.id,
			event.organizerId ? organizers.get(event.organizerId) : undefined,
		)),
	};
}
