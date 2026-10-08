import { reject } from '../domain/messages';
import { expandEventsInDateRange } from "../domain/recurrence";
import { formatCalendarFeed } from "../domain/icalendar";
import { eventRecordToPublicEvent } from "../domain/event-expansion";
import {
  nativeSchema,
  readEventSource,
  resolveEventVenues,
  selectEventLocales,
  hydrateNativeAssets,
} from "../domain/native-source";
import {
  calendarHost,
  reconcileNativeCalendar,
} from "../domain/native-calendar";
import { categoryKey } from "../domain/category";
import { listCalendarCancellations, type EventualContext } from "../storage";
import { withInvocationBudget } from '../domain/invocation-budget';
export interface CalendarFeedOptions {
  locale?: string;
  strict?: boolean;
  category?: string;
  calendarName?: string;
}
export const filterAndDeduplicateEvents = (
  events: import("../domain/event").EventRecord[],
  options?: CalendarFeedOptions,
) => selectEventLocales(events, options?.locale, options?.strict);
export async function handleCalendarFeed(
  ctx: EventualContext,
  host: string,
  options?: CalendarFeedOptions,
): Promise<string> {
  ctx = withInvocationBudget(ctx);
  const from = new Date().toISOString().slice(0, 10);
  const end = new Date(from + "T00:00:00Z");
  end.setUTCDate(end.getUTCDate() + 365);
  const through = end.toISOString().slice(0, 10);
  const schema = await nativeSchema(ctx);
  const source = schema
    ? { native: true, schema, events: [] }
    : await readEventSource(ctx, through);
  const state = source.native
    ? await reconcileNativeCalendar(ctx)
    : { events: source.events, cancellations: [] };
  const selected = selectEventLocales(
    state.events,
    options?.locale,
    options?.strict,
  );
  const expanded = expandEventsInDateRange(selected, from, through);
  if (expanded.length > 10000)
    reject("Too many calendar occurrences.");
  const category = options?.category ? categoryKey(options.category) : "";
  const occurrences = category
    ? expanded.filter((event) =>
        event.categories.some((value) => categoryKey(value) === category),
      )
    : expanded;
  const venues =
    ("venues" in state && state.venues) ||
    (await resolveEventVenues(ctx, occurrences, source.schema));
  // Resolve canonical URLs only for selected base events; directory reads are memoized.
  const hydrated = source.native ? await hydrateNativeAssets(ctx, occurrences) : occurrences;
  const events = hydrated.map((event) => ({
    ...event,
    location: eventRecordToPublicEvent(event, venues).location,
  }));
  const legacy = ctx.storage?.calendar_cancellations
    ? await listCalendarCancellations(ctx)
    : [];
  const cancellations = [...state.cancellations, ...legacy].filter(
    (item) =>
      Date.parse(item.cancelledAt) > Date.now() - 366 * 86400000 &&
      (!category ||
        item.categories?.some((value) => categoryKey(value) === category)) &&
      (!item.feedCategory || item.feedCategory === category) &&
      (item.locale
        ? options?.strict && options.locale?.toLowerCase() === item.locale
        : !options?.strict ||
          !options.locale ||
          !item.locales ||
          item.locales.includes(options.locale.toLowerCase())),
  );
  return formatCalendarFeed(
    events,
    cancellations,
    ('host' in state && state.host) || await calendarHost(ctx, host),
    undefined,
    options?.calendarName,
  );
}
