import { afterEach, expect, it } from 'vitest';
import { createPluginRuntimeTestHost, type PluginRuntimeTestHost } from '@emdash-cms/plugin-test';
import { createEventsCollectionBlueprint, createVenuesCollectionBlueprint, createOrganizersCollectionBlueprint } from '../src/schema/blueprint';
import { parsePublicFeed, publicFeedCacheOptions } from '../astro/feed';

let host: PluginRuntimeTestHost | undefined;
afterEach(async () => { await host?.dispose(); host = undefined; });
it('carries native dependencies through real Worker Loader/PluginBridge, including publication and draft isolation', async () => {
  host = await createPluginRuntimeTestHost({ site: { url: 'https://synthetic.example', locale: 'en' } });
  const options = { eventCollection: 'activities', venueCollection: 'locations', organizerCollection: 'hosts', bindRelations: false };
  for (const blueprint of [createEventsCollectionBlueprint(options), { ...createVenuesCollectionBlueprint(options), slug: 'locations' }, { ...createOrganizersCollectionBlueprint(options), slug: 'hosts' }]) await host.fixtures.collection(blueprint as any);
  await host.fixtures.plugin.setting('collections', { events: 'activities', venues: 'locations', organizers: 'hosts' });
  const url = 'https://synthetic.example/_emdash/api/plugins/eventual/publicEvents?from=2026-01-01&through=2026-12-31&publicUrls=false';
  const read = async () => {
    const response = await host!.actions.routes.request('publicEvents', { method: 'GET', url });
    expect(response.status).toBe(200);
    return parsePublicFeed(await response.json());
  };
  const empty = await read();
  expect(empty.events).toEqual([]);
  expect(empty.cache?.dependencies).toEqual(['activities', 'locations', 'hosts', 'emdash:settings']);
  expect(publicFeedCacheOptions([empty], { maxAge: 3600 })).toMatchObject({ swr: 0 });
  const created = await host.actions.content.create('activities', { data: { title: 'Private draft', start: '2026-11-15T10:00:00Z', end: '2026-11-15T11:00:00Z', all_day: false, timezone: 'UTC' } });
  if (!created.success) throw Error(JSON.stringify(created.error));
  const id = created.data.item.id;
  expect((await read()).events).toEqual([]);
  expect((await host.actions.content.publish('activities', id)).success).toBe(true);
  expect((await read()).events[0]?.title).toBe('Private draft');
  expect((await host.actions.content.update('activities', id, { data: { title: 'Unpublished change' } })).success).toBe(true);
  expect((await read()).events[0]?.title).toBe('Private draft');
  expect((await host.actions.content.unpublish('activities', id)).success).toBe(true);
  expect((await read()).events).toEqual([]);
  expect((await host.actions.content.publish('activities', id)).success).toBe(true);
  expect((await host.actions.content.trash('activities', id)).success).toBe(true);
  expect((await read()).events).toEqual([]);
  expect((await host.actions.content.restore('activities', id)).success).toBe(true);
  expect((await read()).events).toEqual([]); // Trash restoration deliberately returns a draft.
  expect((await host.actions.content.publish('activities', id)).success).toBe(true);
  expect((await read()).events[0]?.title).toBe('Unpublished change');
  // Scheduler visibility still uses the published-only projection; future draft
  // schedules never enter either the events or dependency evidence.
  const due = Date.now() + 60_000;
  const scheduled = await host.actions.content.create('activities', { data: { title: 'Scheduled draft', start: '2026-11-16T10:00:00Z', end: '2026-11-16T11:00:00Z', all_day: false, timezone: 'UTC' } });
  if (!scheduled.success) throw Error(JSON.stringify(scheduled.error));
  expect((await host.actions.content.schedule('activities', scheduled.data.item.id, new Date(due).toISOString())).success).toBe(true);
  expect((await read()).events.some(event => event.title === 'Scheduled draft')).toBe(false);
  host.scheduled.setTime(new Date(due + 1000));
  await host.scheduled.run();
  expect((await read()).events.some(event => event.title === 'Scheduled draft')).toBe(true);
}, 60_000);
