import { reject } from './messages';
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
import { reserveRpcCalls } from './invocation-budget';

interface CalendarState {
  from?: string;
  locales?: string[];
  fingerprint: string;
  sequence: number;
  occurrences: CalendarCancellation[];
  cancellations: CalendarCancellation[];
}
const prefix = "state:eventual-calendar:";
const snapshotKey = 'state:eventual-calendar-snapshot';
interface CalendarSnapshot { version: 1; host: string; groups: Record<string, CalendarState> }
const hosts = new WeakMap<EventualContext, Promise<string>>();
export function calendarSiteHost(ctx: EventualContext, fallback = 'eventual.invalid'): string {
  try { return new URL(ctx.site.url).host; } catch { return fallback; }
}
export function calendarHost(
  ctx: EventualContext,
  fallback = "eventual.invalid",
): Promise<string> {
  const cached = hosts.get(ctx);
  if (cached) return cached;
  const promise = loadCalendarHost(ctx, fallback);
  hosts.set(ctx, promise);
  return promise;
}
async function loadCalendarHost(ctx: EventualContext, fallback: string): Promise<string> {
  const snapshot = await ctx.kv.get<CalendarSnapshot>(snapshotKey);
  if (snapshot?.version === 1 && snapshot.host) return snapshot.host;
  const current = await ctx.kv.get<string>("state:eventual-calendar-host");
  if (current) return current;
  const host = calendarSiteHost(ctx, fallback);
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
  host?: string;
}> {
  const now = new Date();
  const from = now.toISOString().slice(0, 10);
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() + 365);
  const through = end.toISOString().slice(0, 10);
  const previousSnapshot = await ctx.kv.getVersioned<CalendarSnapshot>(snapshotKey);
  if (previousSnapshot && previousSnapshot.value.version !== 1) reject('Unsupported calendar snapshot.');
  // Import existing sequence/cancellation state and host once. Retain old keys for rollback.
  const legacy = previousSnapshot ? [] : await ctx.kv.list('state:eventual-calendar');
  const oldLock = legacy.find(item => item.key === 'state:eventual-calendar-lock')?.value as {until: number} | undefined;
  if (oldLock && oldLock.until > Date.now()) reject('Calendar busy; retry.');
  let host = previousSnapshot?.value.host ?? legacy.find(item => item.key === 'state:eventual-calendar-host')?.value as string | undefined;
  if (!host) host = calendarSiteHost(ctx);
  hosts.set(ctx, Promise.resolve(host));
  const cached = new Map<string, CalendarState>(previousSnapshot
    ? Object.entries(previousSnapshot.value.groups)
    : legacy.filter(item => item.key.startsWith(prefix)).map(item => [decodeURIComponent(item.key.slice(prefix.length)), item.value as CalendarState]));
  if (cached.size > 10000) reject('Calendar state limit exceeded.');
  const next = new Map(cached);
  let changedSnapshot = !previousSnapshot;
  const release = reserveRpcCalls(ctx, 1);
  try {
    const source = await readEventSource(ctx);
    if (!source.native) return { events: source.events, cancellations: [] };
    source.events = await hydrateNativeAssets(ctx, source.events, false);
    const venues = await resolveEventVenues(ctx, source.events, source.schema);
    const groups = new Map<string, EventRecord[]>();
    for (const event of source.events) {
      const key = event.translationGroup ?? event.id;
      const rows = groups.get(key) ?? [];
      rows.push(event);
      groups.set(key, rows);
    }
    const keys = new Set([
      ...groups.keys(),
      ...cached.keys(),
    ]);
    const cancellations: CalendarCancellation[] = [];
    const events: EventRecord[] = [];
    let occurrenceCount = 0;
    for (const key of keys) {
      const rows = (groups.get(key) ?? []).sort((a, b) =>
        a.id.localeCompare(b.id),
      );
      const fingerprint = JSON.stringify(
        [ctx.site, source.schema?.urlPattern, source.schema?.routable, rows.map((row) => ({
          ...row,
          calendarSequence: undefined,
          venue: localizedVenue(venues, row),
        }))],
      );
      const cache = cached.get(key);
      if (cache?.fingerprint === fingerprint && cache.from === from) {
        occurrenceCount += cache.occurrences.length;
        if (occurrenceCount > 10000)
          reject("Calendar occurrence limit exceeded.");
        events.push(
          ...rows.map((row) => ({ ...row, calendarSequence: cache.sequence })),
        );
        cancellations.push(...cache.cancellations);
        if (cancellations.length > 10000)
          reject("Calendar cancellation limit exceeded.");
        continue;
      }
      const changed = cache?.fingerprint !== fingerprint;
      const sequence = cache
        ? cache.sequence + (changed ? 1 : 0)
        : rows.some((row) => row.calendarUid)
          ? Math.floor(now.getTime() / 1000)
          : 0;
      if (sequence > 2147483647)
        reject("Calendar sequence exhausted.");
      const occurrences = expandEventsInDateRange(
        rows.slice(0, 1),
        from,
        through,
      );
      if (occurrences.length > 1000)
        reject("Calendar occurrence limit exceeded.");
      occurrenceCount += occurrences.length;
      if (occurrenceCount > 10000)
        reject("Calendar occurrence limit exceeded.");
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
      const retained = (cache?.cancellations ?? []).filter(
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
      for (const old of cache?.occurrences ?? []) {
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
      for (const locale of cache?.locales ?? [])
        if (!locales.includes(locale))
          for (const old of cache?.occurrences ?? []) {
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
        reject("Cancellation history limit exceeded for this series.");
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
      next.set(key, value);
      changedSnapshot = true;
      events.push(
        ...rows.map((row) => ({ ...row, calendarSequence: sequence })),
      );
      cancellations.push(...unique);
      if (cancellations.length > 10000)
        reject("Calendar cancellation limit exceeded.");
    }
    const snapshot: CalendarSnapshot = {version: 1, host, groups: Object.fromEntries(next)};
    if (new TextEncoder().encode(JSON.stringify(snapshot)).length > 1024 * 1024)
      reject('Calendar snapshot exceeds 1 MiB.');
    release();
    if (changedSnapshot) {
      const saved = await ctx.kv.compareAndSet(snapshotKey, previousSnapshot?.revision ?? null, snapshot);
      if (!saved.applied) reject('Calendar state conflict; retry.');
    }
    return { events, cancellations, venues, host };
  } finally {
    // release is idempotent: failed reads must return the reserved allowance.
    release();
  }
}
