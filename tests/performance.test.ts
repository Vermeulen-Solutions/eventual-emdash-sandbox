import { expect, it } from 'vitest';
import { handlePublicEvents } from '../src/routes/public-events';
import type { EventualContext } from '../src/storage';
import { EMPTY_EVENT_DRAFT, type EventRecord } from '../src/domain/event';
import { prepareEventData } from '../src/domain/event-data';
import { mkdirSync, writeFileSync } from 'node:fs';

// Deterministic call budgets catch N+1 regressions. Elapsed time is diagnostic,
// not a CI assertion: this runs in a Node mock, not the production CPU meter.
for (const scenario of [{ name: '500 single events', count: 500, recurring: false }, { name: '100 daily series / 31 days', count: 100, recurring: true }]) {
  it(`profiles ${scenario.name} and batches references`, async () => {
    const data = prepareEventData({ ...EMPTY_EVENT_DRAFT, title: 'Performance fixture', start: '2026-10-01', end: '2026-10-01', allDay: true, published: true }).data!;
    const stored = Array.from({ length: scenario.count }, (_, i): EventRecord => ({ ...data, id: String(i), venueId: 'venue', organizerId: 'organizer', createdAt: '', updatedAt: '', ...(scenario.recurring ? { recurrence: { frequency: 'daily', until: '2026-10-31' } } : {}) }));
    const calls = { queries: 0, venues: 0, organizers: 0 };
    const ctx = { plugin: { id: 'eventual' }, storage: {
      events: { query: async ({ cursor, limit }: { cursor?: string; limit: number }) => {
        calls.queries++;
        const offset = Number(cursor ?? 0);
        const end = Math.min(offset + limit, stored.length);
        return { items: stored.slice(offset, end).map(data => ({ id: data.id, data })), hasMore: end < stored.length, ...(end < stored.length ? { cursor: String(end) } : {}) };
      } },
      venues: { getMany: async (ids: string[]) => { calls.venues++; expect(ids).toEqual(['venue']); return new Map(); } },
      organizers: { getMany: async (ids: string[]) => { calls.organizers++; expect(ids).toEqual(['organizer']); return new Map(); } },
    } } as unknown as EventualContext;
    const started = performance.now();
    const feed = await handlePublicEvents({ from: '2026-10-01', through: '2026-10-31' }, ctx);
    const elapsedMs = performance.now() - started;
    expect(feed.ok).toBe(true);
    expect(feed.events).toHaveLength(scenario.count * (scenario.recurring ? 31 : 1));
    expect(calls).toEqual({ queries: Math.ceil(scenario.count / 100), venues: 1, organizers: 1 });
    const report = { scenario: scenario.name, events: feed.events?.length, calls, payloadBytes: new TextEncoder().encode(JSON.stringify(feed)).length, elapsedMs: Math.round(elapsedMs * 100) / 100 };
    if (process.env.EVENTUAL_PROFILE_REPORT === '1') {
      mkdirSync('reports', { recursive: true });
      writeFileSync(`reports/performance-${scenario.recurring ? 'recurring' : 'single'}.json`, JSON.stringify(report, null, 2));
    }
    console.log(JSON.stringify(report));
  });
}
