import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPluginRuntimeTestHost, type PluginRuntimeTestHost } from '@emdash-cms/plugin-test';
import { handlePublicEvents } from '../src/routes/public-events';
import { createEventsCollectionBlueprint, createVenuesCollectionBlueprint } from '../src/schema/blueprint';
import type { EventualContext } from '../src/storage';

const range = { from: '2026-01-01', through: '2026-12-31' };
const eventRow = (index: number) => ({
  id: 'event-' + index, slug: 'event-' + index, type: 'events', locale: 'fr', status: 'published',
  translationGroup: 'group-' + index,
  data: { title: 'Rencontre ' + index, description: [{ _type: 'block', children: [{ _type: 'span', text: 'Annonce', marks: [] }] }],
    start: `2026-03-${String(index + 1).padStart(2, '0')}T10:00:00Z`,
    end: `2026-03-${String(index + 1).padStart(2, '0')}T11:00:00Z`,
    all_day: false, timezone: 'UTC', venue: 'hall', organizer: 'Club',
    featured_image: { id: 'image' }, categories: ['Club'] },
});
function tracedContext(count = 8) {
  const calls: string[] = [];
  const trace = (name: string, fn: (...args: any[]) => any) => (...args: any[]) => { calls.push(name); return fn(...args); };
  const ctx = {
    plugin: { id: 'eventual' }, site: { url: 'https://club.example', locale: 'fr' },
    settings: { get: trace('settings.get', async () => undefined) },
    schema: { listCollections: trace('schema.listCollections', async () => [createEventsCollectionBlueprint(), createVenuesCollectionBlueprint()]) },
    content: {
      list: trace('content.list', async (collection: string) => ({ hasMore: false, items: collection === 'events'
        ? Array.from({ length: count }, (_, index) => eventRow(index))
        : [{ id: 'hall', locale: 'fr', status: 'published', data: { name: 'Salle', street: 'Rue du club' } }] })),
      getPublicUrl: trace('content.getPublicUrl', async (_collection: string, id: string) => 'https://club.example/events/' + id),
    },
    media: { get: vi.fn(), readBytes: vi.fn() },
  } as unknown as EventualContext;
  return { ctx, calls };
}

describe('publicEvents canonical URL budget', () => {
  it.each(['fr', 'en'])('returns the complete annual %s feed in four RPCs with URL hydration disabled', async locale => {
    for (const publicUrls of [false, 'false']) {
      const { ctx, calls } = tracedContext();
      const result = await handlePublicEvents({ ...range, locale, publicUrls }, ctx);
      expect(result.ok).toBe(true);
      expect(result.events).toHaveLength(8);
      expect(result.events?.[0]).toMatchObject({ slug: 'event-0', title: locale === 'fr' ? 'Rencontre 0' : '[FR] Rencontre 0',
        locale: 'fr', organizer: 'Club', venue: { name: 'Salle' }, categories: ['Club'],
        descriptionBlocks: expect.any(Array), imageUrl: expect.stringContaining('publicEventImage?eventId=event-0') });
      expect(calls).toEqual(['settings.get', 'schema.listCollections', 'content.list', 'content.list']);
      expect(ctx.media!.get).not.toHaveBeenCalled();
      expect(ctx.media!.readBytes).not.toHaveBeenCalled();
    }
  });

  it.each([undefined, true, 'true'])('retains canonical URL hydration for publicUrls=%s', async publicUrls => {
    const { ctx, calls } = tracedContext(1);
    const result = await handlePublicEvents({ ...range, publicUrls }, ctx);
    expect(result.events?.[0]?.publicUrl).toBe('https://club.example/events/event-0');
    expect(calls).toHaveLength(5);
    const without = await handlePublicEvents({ ...range, publicUrls: false }, tracedContext(1).ctx);
    const withoutUrl = (events: typeof result.events) => events?.map(({ publicUrl: _url, ...event }) => event);
    expect(withoutUrl(without.events)).toEqual(withoutUrl(result.events));
  });

  it('fails without returning partial events when default hydration exceeds ten calls', async () => {
    const { ctx, calls } = tracedContext();
    const result = await handlePublicEvents(range, ctx);
    expect(result).toMatchObject({ ok: false, error: 'SANDBOX_BUDGET_EXCEEDED' });
    expect(result.events).toBeUndefined();
    expect(calls).toHaveLength(10);
    expect(calls.filter(name => name === 'content.getPublicUrl')).toHaveLength(6);
  });

  it.each([undefined, false, 'false', true, 'true'])('preserves strict locale selection for strict=%s', async strict => {
    const { ctx } = tracedContext();
    const result = await handlePublicEvents({ ...range, locale: 'en', publicUrls: false, strict }, ctx);
    expect(result.ok).toBe(true);
    expect(result.events).toHaveLength(strict === true || strict === 'true' ? 0 : 8);
  });

  it.each([null, '', '0', 'FALSE', 0, [], {}, ['false']])('rejects invalid publicUrls=%j before any RPC', async publicUrls => {
    const { ctx, calls } = tracedContext();
    expect(await handlePublicEvents({ ...range, publicUrls }, ctx)).toEqual({ ok: false, error: 'INVALID_QUERY' });
    expect(calls).toEqual([]);
  });
});

let host: PluginRuntimeTestHost | undefined;
afterEach(async () => { await host?.dispose(); host = undefined; });
describe('publicEvents HTTP response contract', { timeout: 60_000 }, () => {
  it('returns uncached ROUTE_ERROR on exhaustion and normal JSON success for the URL opt-out', async () => {
    host = await createPluginRuntimeTestHost({ site: { url: 'https://club.example', locale: 'fr' },
      i18n: { defaultLocale: 'fr', locales: ['fr', 'en'] } });
    await host.fixtures.collection(createEventsCollectionBlueprint() as any);
    await host.fixtures.collection(createVenuesCollectionBlueprint() as any);
    await host.fixtures.content('venues', { id: 'hall', status: 'published', locale: 'fr', data: { name: 'Salle' } });
    for (let index = 0; index < 8; index++) {
      const row = eventRow(index);
      // This transport test does not need a ready media fixture.
      const { featured_image: _image, organizer: _organizer, ...data } = row.data;
      await host.fixtures.content('events', { id: row.id, slug: row.slug, locale: row.locale, status: 'published', data });
    }
    const url = 'https://club.example/_emdash/api/plugins/eventual/publicEvents?' + new URLSearchParams(range);
    const failed = await host.actions.routes.request('publicEvents', { method: 'GET', url });
    expect(failed.status).toBe(400);
    expect(failed.headers.get('cache-control')).toBe('private, no-store');
    expect(await failed.json()).toMatchObject({ success: false, error: { code: 'ROUTE_ERROR', message: 'The sandbox RPC budget is exceeded.' } });
    for (const locale of ['fr', 'en']) {
      const success = await host.actions.routes.request('publicEvents', { method: 'GET', url: url + '&publicUrls=false&locale=' + locale });
      expect(success.status).toBe(200);
      expect(success.headers.get('cache-control')).toBe('public, max-age=60');
      const envelope = await success.json() as any;
      expect(envelope).toMatchObject({ success: true, data: { ok: true } });
      expect(envelope.data.events).toHaveLength(8);
      expect(envelope.data).not.toHaveProperty('__emdashPluginResponse');
    }
  });
});
