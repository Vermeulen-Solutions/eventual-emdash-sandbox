import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPublicFeed, parsePublicFeed, parsePublicFeedCache, publicFeedCacheOptions, publicEventTimeBoundary, publicCalendarDateBoundary, type PublicEvent } from '../astro/feed';
import { publicFeedCache } from '../src/domain/public-cache';
import { handlePublicEvents } from '../src/routes/public-events';
import { createEventsCollectionBlueprint } from '../src/schema/blueprint';
import type { EventualContext } from '../src/storage';

const now = Date.parse('2026-03-28T23:59:55.000Z');
const schema = createEventsCollectionBlueprint({ eventCollection: 'activities', venueCollection: 'locations', organizerCollection: 'hosts' });
const cache = () => publicFeedCache(schema as any, now, false);
const feed = () => ({ ok: true as const, from: '2026-03-01', through: '2026-03-31', events: [], cache: cache() });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('Public feed cache evidence', () => {
  it('uses actual collection identities, including empty feeds, without extra RPCs', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const list = vi.fn(async () => ({ items: [], hasMore: false }));
    const get = vi.fn(async () => ({ events: 'activities', venues: 'locations', organizers: 'hosts' }));
    const listCollections = vi.fn(async () => [schema, { slug: 'locations', fields: [] }, { slug: 'hosts', fields: [] }]);
    const ctx = { site: { url: 'https://example.org' }, plugin: { id: 'eventual' }, settings: { get }, schema: { listCollections }, content: { list } } as unknown as EventualContext;
    const result = await handlePublicEvents({ publicUrls: false }, ctx);
    expect(result).toMatchObject({ ok: true, events: [], cache: {
      version: 1, dependencies: ['activities', 'locations', 'hosts', 'emdash:settings'],
      generatedAt: '2026-03-28T23:59:55.000Z', expiresAt: '2026-03-29T00:00:00.000Z',
    } });
    expect(get).toHaveBeenCalledTimes(1);
    expect(listCollections).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenCalledTimes(1);
    // Explicit ranges are pure occurrence projections, bounded only by the write fallback.
    const explicit = await handlePublicEvents({ from: '2026-03-01', through: '2026-03-31', publicUrls: false }, { ...ctx });
    expect(explicit).toMatchObject({ cache: { expiresAt: '2026-03-29T00:00:10.000Z' } });
  });

  it('preserves old helper results and shares validation with in-process dispatch', async () => {
    const data = feed();
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ success: true, data })));
    expect(await fetchPublicFeed('https://example.org', data.from, data.through)).toEqual(parsePublicFeed({ success: true, data }));
    const { cache: _cache, ...old } = data;
    expect(parsePublicFeed({ success: true, data: old })).toEqual(old);
    expect(parsePublicFeed({ success: true, data: { ...data, cache: { version: 2 } } })).toEqual(old);
    expect(() => parsePublicFeed({ success: true, data: { ok: false, error: 'INVALID_QUERY' } })).toThrow('INVALID_QUERY');
  });

  it('validates imageMedia on public events when present', () => {
    const validEvent = {
      id: 'event-1', title: 'Title', description: '', start: '2026-03-01T10:00:00Z',
      end: '2026-03-01T11:00:00Z', allDay: false, timezone: 'UTC', location: '',
      organizer: '', externalUrl: '', imageUrl: 'https://example.org/image.png',
      imageMedia: { src: 'https://example.org/file.jpg', width: 800, height: 600, alt: 'Alt' },
      categories: [], venue: null, directionsUrl: '',
    };
    const parsed = parsePublicFeed({ success: true, data: { ok: true, from: '2026-03-01', through: '2026-03-31', events: [validEvent] } });
    expect(parsed.events[0]?.imageMedia).toEqual(validEvent.imageMedia);

    expect(() => parsePublicFeed({ success: true, data: { ok: true, from: '2026-03-01', through: '2026-03-31', events: [{ ...validEvent, imageMedia: { src: '' } }] } })).toThrow();
    expect(() => parsePublicFeed({ success: true, data: { ok: true, from: '2026-03-01', through: '2026-03-31', events: [{ ...validEvent, imageMedia: { src: 'http://example.org', width: -10 } }] } })).toThrow();
  });

  it('does not claim native invalidation for legacy storage or failed queries', async () => {
    const query = vi.fn(async () => ({ items: [], hasMore: false }));
    const ctx = { site: { url: 'https://example.org' }, plugin: { id: 'eventual' },
      settings: { get: async (key: string) => key === 'legacyReads' ? true : undefined },
      schema: { listCollections: async () => [] }, content: {}, storage: { events: { query } },
    } as unknown as EventualContext;
    const result = await handlePublicEvents({ from: '2026-01-01', through: '2026-01-01' }, ctx);
    expect(result).toMatchObject({ ok: true, events: [] });
    expect(result).not.toHaveProperty('cache');
    expect(await handlePublicEvents({ from: 'invalid', through: '2026-01-01' }, ctx)).not.toHaveProperty('cache');
  });

  it.each([undefined, null, {}, { version: 2 }, { ...cache(), dependencies: [] },
    { ...cache(), dependencies: ['events,all', 'emdash:settings'] },
    { ...cache(), expiresAt: '2026-03-29T00:00:11.000Z' },
    { ...cache(), generatedAt: '2026-03-28' }, { ...cache(), expiresAt: 'bad' },
    { ...cache(), expiresAt: cache().generatedAt }])('fails closed for invalid metadata %j', value => {
    expect(parsePublicFeedCache(value)).toBeUndefined();
    expect(publicFeedCacheOptions([{ ok: true, cache: value as any }], { maxAge: 15, now })).toBe(false);
  });

  it('unions split dependencies and uses the earliest absolute expiry, host TTL and renderer boundary', () => {
    const second = { ...feed(), cache: { ...cache(), dependencies: ['other_events', 'emdash:settings'], expiresAt: '2026-03-29T00:00:04.000Z' } };
    expect(publicFeedCacheOptions([feed(), second], { maxAge: 100, now })).toEqual({ tags: ['activities', 'locations', 'hosts', 'emdash:settings', 'other_events'], maxAge: 9, swr: 0 });
    expect(publicFeedCacheOptions([feed(), second], { maxAge: 3, now })).toMatchObject({ maxAge: 3 });
    expect(publicFeedCacheOptions([feed()], { maxAge: 15, now, boundaries: ['2026-03-28T23:59:57.500Z'] })).toMatchObject({ maxAge: 2, swr: 0 });
    for (const options of [{ maxAge: NaN, now }, { maxAge: 15, now: now - 1 }, { maxAge: 15, now: now + 15000 }, { maxAge: 15, now, boundaries: ['bad'] }, { maxAge: 15, now, boundaries: ['2026-03-28T23:59:55.500Z'] }]) {
      expect(publicFeedCacheOptions([feed()], options)).toBe(false);
    }
    expect(publicFeedCacheOptions([], { maxAge: 15, now })).toBe(false);
    expect(publicFeedCacheOptions([feed(), { ok: true }], { maxAge: 15, now })).toBe(false);
    expect(publicFeedCacheOptions([{ ok: false } as any], { maxAge: 15, now })).toBe(false);
  });
});

describe('Renderer clock boundaries', () => {
  const event = { allDay: true, start: '2026-03-29', end: '2026-03-29', timezone: 'Europe/Paris' } as PublicEvent;
  it('uses inclusive all-day ends across the spring DST day (23 hours)', () => {
    expect(publicEventTimeBoundary([event], Date.parse('2026-03-28T22:00:00Z'))).toBe('2026-03-28T23:00:00.000Z');
    expect(publicEventTimeBoundary([event], Date.parse('2026-03-28T23:00:00Z'))).toBe('2026-03-29T22:00:00.000Z');
    expect(publicEventTimeBoundary([event], Date.parse('2026-03-29T22:00:00Z'))).toBeUndefined();
  });
  it('uses inclusive all-day ends across the fall DST day (25 hours)', () => {
    expect(publicEventTimeBoundary([{ ...event, start: '2026-10-25', end: '2026-10-25' }], Date.parse('2026-10-24T22:00:00Z'))).toBe('2026-10-25T23:00:00.000Z');
  });
  it('handles timed labels, local grouping midnight and both DST transitions', () => {
    expect(publicEventTimeBoundary([{ ...event, allDay: false, start: '2026-10-25T00:30:00Z', end: '2026-10-25T01:30:00Z' }], Date.parse('2026-10-25T01:00:00Z'))).toBe('2026-10-25T01:30:00.000Z');
    expect(publicCalendarDateBoundary('Europe/Paris', Date.parse('2026-03-28T23:00:00Z'))).toBe('2026-03-29T22:00:00.000Z');
    expect(publicCalendarDateBoundary('Europe/Paris', Date.parse('2026-10-24T22:00:00Z'))).toBe('2026-10-25T23:00:00.000Z');
    expect(() => publicCalendarDateBoundary('Invalid/Zone', now)).toThrow();
  });
});
