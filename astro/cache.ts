import { PUBLIC_FEED_CACHE_CEILING_MS, type PublicFeedCache } from '../src/domain/public-cache';
import { calendarDateKey, isDateOnly, isValidTimeZone, localDateTimeToInstant } from '../src/domain/date-time';
import type { PublicEvent, PublicFeed } from './feed';

export type { PublicFeedCache };

function instant(value: unknown): number {
  if (typeof value !== 'string') return NaN;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value ? time : NaN;
}

/** Unknown/old metadata still renders, but cannot authorize cache storage. */
export function parsePublicFeedCache(value: unknown): PublicFeedCache | undefined {
  if (!value || typeof value !== 'object') return;
  const cache = value as PublicFeedCache;
  const generated = instant(cache.generatedAt), expires = instant(cache.expiresAt);
  if (cache.version !== 1 || !Array.isArray(cache.dependencies) || cache.dependencies.length < 2 || cache.dependencies.length > 4
    || !cache.dependencies.every(tag => typeof tag === 'string' && /^(?:[a-z][a-z0-9_]{0,62}|emdash:settings)$/.test(tag))
    || !cache.dependencies.includes('emdash:settings')
    || !cache.dependencies.some(tag => tag !== 'emdash:settings')
    || !Number.isFinite(generated) || !Number.isFinite(expires)
    || expires <= generated || expires - generated > PUBLIC_FEED_CACHE_CEILING_MS) return;
  return { version: 1, dependencies: [...new Set(cache.dependencies)], generatedAt: cache.generatedAt, expiresAt: cache.expiresAt };
}

/** Explicit host TTL required. A failed split, stale metadata or invalid boundary disables storage. */
export function publicFeedCacheOptions(
  feeds: readonly Pick<PublicFeed, 'ok' | 'cache'>[],
  options: { maxAge: number; now?: number; boundaries?: readonly string[] },
): false | { tags: string[]; maxAge: number; swr: 0 } {
  const now = options.now ?? Date.now();
  if (!feeds.length || !Number.isFinite(now) || !Number.isFinite(options.maxAge) || options.maxAge < 1) return false;
  let remaining = options.maxAge * 1000;
  const tags = new Set<string>();
  for (const feed of feeds) {
    const cache = feed.ok === true ? parsePublicFeedCache(feed.cache) : undefined;
    if (!cache || instant(cache.generatedAt) > now) return false;
    remaining = Math.min(remaining, instant(cache.expiresAt) - now);
    for (const tag of cache.dependencies) tags.add(tag);
  }
  for (const boundary of options.boundaries ?? []) {
    const time = instant(boundary);
    if (!Number.isFinite(time)) return false;
    remaining = Math.min(remaining, time - now);
  }
  const maxAge = Math.floor(remaining / 1000);
  return maxAge >= 1 ? { tags: [...tags], maxAge, swr: 0 } : false;
}

/** Optional renderer boundary for upcoming/ongoing/ended labels. All-day end is inclusive. */
export function publicEventTimeBoundary(events: readonly PublicEvent[], now = Date.now()): string | undefined {
  if (!Number.isFinite(now)) throw new Error('Invalid clock');
  let next = Infinity;
  for (const event of events) {
    let boundaries: number[];
    if (event.allDay) {
      if (!isDateOnly(event.start) || !isDateOnly(event.end)) throw new Error('Invalid all-day dates');
      const end = new Date(event.end + 'T00:00:00Z');
      end.setUTCDate(end.getUTCDate() + 1);
      boundaries = [event.start, end.toISOString().slice(0, 10)].map(day => {
        const result = localDateTimeToInstant(day + 'T00:00', event.timezone);
        if (!result.value) throw new Error('Cannot resolve all-day timezone boundary');
        return Date.parse(result.value);
      });
    } else boundaries = [Date.parse(event.start), Date.parse(event.end)];
    if (!boundaries.every(Number.isFinite)) throw new Error('Invalid event time boundary');
    for (const boundary of boundaries) if (boundary > now) next = Math.min(next, boundary);
  }
  return Number.isFinite(next) ? new Date(next).toISOString() : undefined;
}

/** Next local date change for renderers that group or filter by today's date. */
export function publicCalendarDateBoundary(timezone: string, now = Date.now()): string {
  if (!isValidTimeZone(timezone) || !Number.isFinite(now)) throw new Error('Invalid timezone or clock');
  const day = calendarDateKey(new Date(now).toISOString(), false, timezone);
  const date = new Date(day + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + 1);
  const result = localDateTimeToInstant(date.toISOString().slice(0, 10) + 'T00:00', timezone);
  if (!result.value) throw new Error('Cannot resolve timezone midnight');
  return result.value;
}
