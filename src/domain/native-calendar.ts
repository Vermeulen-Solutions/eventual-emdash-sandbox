import type { EventRecord } from "./event";
import {
  readEventSource,
  resolveEventVenues,
  hydrateNativeAssets,
} from "./native-source";
import { localizedVenue, type NormalizedVenue } from "./venue-adapter";
import { expandEventsInDateRange } from "./recurrence";
import { eventUid } from "./icalendar";
import { categoryKey } from "./category";
import type { CalendarCancellation, EventualContext } from "../storage";

interface CalendarState {
  from?: string;
  locales?: string[];
  fingerprint: string;
  sequence: number;
  occurrences: CalendarCancellation[];
  cancellations: CalendarCancellation[];
}
const prefix = "state:eventual-calendar:";
export async function calendarHost(
  ctx: EventualContext,
  fallback = "eventual.invalid",
): Promise<string> {
  const current = await ctx.kv.get<string>("state:eventual-calendar-host");
  if (current) return current;
  let host = fallback;
  try {
    host = new URL(ctx.site.url).host;
  } catch {}
  const result = await ctx.kv.compareAndSet(
    "state:eventual-calendar-host",
    null,
    host,
  );
  return result.applied
    ? host
    : (await ctx.kv.get<string>("state:eventual-calendar-host"))!;
}
export async function reconcileNativeCalendar(ctx: EventualContext): Promise<{
  events: EventRecord[];
  cancellations: CalendarCancellation[];
  venues?: Map<string, NormalizedVenue>;
}> {
  const now = new Date();
  const from = now.toISOString().slice(0, 10);
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() + 365);
  const through = end.toISOString().slice(0, 10);
  const host = await calendarHost(ctx);
  const lockKey = "state:eventual-calendar-lock";
  const lock = await ctx.kv.getVersioned<{ until: number }>(lockKey);
  if (lock && lock.value.until > Date.now())
    throw new Error("Calendar reconciliation is busy; retry.");
  const acquired = await ctx.kv.compareAndSet(lockKey, lock?.revision ?? null, {
    until: Date.now() + 300000,
  });
  if (!acquired.applied)
    throw new Error("Calendar reconciliation changed; retry.");
  const lease = await ctx.kv.getVersioned(lockKey);
  try {
    const source = await readEventSource(ctx);
    if (!source.native) return { events: source.events, cancellations: [] };
    source.events = await hydrateNativeAssets(ctx, source.events);
    const venues = await resolveEventVenues(ctx, source.events, source.schema);
    const groups = new Map<string, EventRecord[]>();
    for (const event of source.events) {
      const key = event.translationGroup ?? event.id;
      const rows = groups.get(key) ?? [];
      rows.push(event);
      groups.set(key, rows);
    }
    const stored = await ctx.kv.list(prefix);
    const cached = new Map(
      stored.map((item) => [item.key, item.value as CalendarState]),
    );
    if (stored.length > 10000)
      throw new Error("Calendar state limit exceeded.");
    const keys = new Set([
      ...groups.keys(),
      ...stored.map((item) =>
        decodeURIComponent(item.key.slice(prefix.length)),
      ),
    ]);
    const cancellations: CalendarCancellation[] = [];
    const events: EventRecord[] = [];
    let occurrenceCount = 0;
    for (const key of keys) {
      const stateKey = prefix + encodeURIComponent(key);
      const rows = (groups.get(key) ?? []).sort((a, b) =>
        a.id.localeCompare(b.id),
      );
      const fingerprint = JSON.stringify(
        rows.map((row) => ({
          ...row,
          calendarSequence: undefined,
          venue: localizedVenue(venues, row),
        })),
      );
      const cache = cached.get(stateKey);
      if (cache?.fingerprint === fingerprint && cache.from === from) {
        occurrenceCount += cache.occurrences.length;
        if (occurrenceCount > 10000)
          throw new Error("Calendar occurrence limit exceeded.");
        events.push(
          ...rows.map((row) => ({ ...row, calendarSequence: cache.sequence })),
        );
        cancellations.push(...cache.cancellations);
        if (cancellations.length > 10000)
          throw new Error("Calendar cancellation limit exceeded.");
        continue;
      }
      const previous = await ctx.kv.getVersioned<CalendarState>(stateKey);
      const changed = previous?.value.fingerprint !== fingerprint;
      const sequence = previous
        ? previous.value.sequence + (changed ? 1 : 0)
        : rows.some((row) => row.calendarUid)
          ? Math.floor(now.getTime() / 1000)
          : 0;
      if (sequence > 2147483647)
        throw new Error("Calendar sequence exhausted.");
      const occurrences = expandEventsInDateRange(
        rows.slice(0, 1),
        from,
        through,
      );
      if (occurrences.length > 1000)
        throw new Error("Calendar occurrence limit exceeded.");
      occurrenceCount += occurrences.length;
      if (occurrenceCount > 10000)
        throw new Error("Calendar occurrence limit exceeded.");
      const active = new Set(occurrences.map((item) => eventUid(item, host)));
      const activeCategories = new Map(
        occurrences.map((item) => [
          eventUid(item, host),
          item.categories.map(categoryKey),
        ]),
      );
      const locales = [
        ...new Set(
          rows.flatMap((row) => (row.locale ? [row.locale.toLowerCase()] : [])),
        ),
      ];
      const retained = (previous?.value.cancellations ?? []).filter(
        (item) =>
          Date.parse(item.cancelledAt) > now.getTime() - 366 * 86400000 &&
          (item.feedCategory
            ? !activeCategories
                .get(eventUid(item, host))
                ?.includes(item.feedCategory)
            : item.locale
              ? !locales.includes(item.locale)
              : !active.has(eventUid(item, host))),
      );
      for (const old of previous?.value.occurrences ?? []) {
        if (!active.has(eventUid(old, host)) && old.end.slice(0, 10) >= from)
          retained.push({
            ...old,
            cancelledAt: now.toISOString(),
            calendarSequence: sequence,
          });
        if (active.has(eventUid(old, host)))
          for (const category of old.categories ?? [])
            if (
              !activeCategories
                .get(eventUid(old, host))
                ?.includes(categoryKey(category))
            )
              retained.push({
                ...old,
                feedCategory: categoryKey(category),
                cancelledAt: now.toISOString(),
                calendarSequence: sequence,
              });
      }
      for (const locale of previous?.value.locales ?? [])
        if (!locales.includes(locale))
          for (const old of previous?.value.occurrences ?? []) {
            if (active.has(eventUid(old, host)))
              retained.push({
                ...old,
                locale,
                cancelledAt: now.toISOString(),
                calendarSequence: sequence,
              });
          }
      const unique = [
        ...new Map(
          retained.map((item) => [
            eventUid(item, host) +
              ":" +
              (item.locale ?? "") +
              ":" +
              (item.feedCategory ?? ""),
            item,
          ]),
        ).values(),
      ];
      if (unique.length > 1000)
        throw new Error("Cancellation history limit exceeded for this series.");
      const snapshot = occurrences.map((item) => ({
        id: item.id,
        eventId: item.id,
        start: item.start,
        end: item.end,
        allDay: item.allDay,
        timezone: item.timezone,
        translationGroup: item.translationGroup,
        calendarUid: item.calendarUid,
        calendarSequence: sequence,
        cancelledAt: now.toISOString(),
        categories: item.categories,
        locales,
      }));
      const value = {
        from,
        locales,
        fingerprint,
        sequence,
        occurrences: snapshot,
        cancellations: unique,
      };
      const saved = await ctx.kv.compareAndSet(
        stateKey,
        previous?.revision ?? null,
        value,
      );
      if (!saved.applied) throw new Error("Calendar state conflict; retry.");
      events.push(
        ...rows.map((row) => ({ ...row, calendarSequence: sequence })),
      );
      cancellations.push(...unique);
      if (cancellations.length > 10000)
        throw new Error("Calendar cancellation limit exceeded.");
    }
    return { events, cancellations, venues };
  } finally {
    if (lease) await ctx.kv.compareAndDelete(lockKey, lease.revision);
  }
}
