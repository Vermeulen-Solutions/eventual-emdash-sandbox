import { expect, it } from 'vitest';
import { createPluginRuntimeTestHost } from '@emdash-cms/plugin-test';
import { validateBlockResponse, type BlockResponse } from '@emdash-cms/blocks/server';
import { EMPTY_EVENT_DRAFT, type EventRecord, type OrganizerRecord } from '../src/domain/event';
import { eventToDraft, prepareEventData, duplicateEventDraft } from '../src/domain/event-data';
import { withScheduleHistory } from '../src/domain/schedule-history';
import { expandRecurringEvent } from '../src/domain/recurrence';
import { eventToJsonLd } from '../astro/schema';
import { formatPublicEvent } from '../src/public-event';
import { exportBackup, restoreBackup, type ToolResult, type Invoke, type Backup } from '../transfer/index.mjs';

const stamp = '2026-10-01T00:00:00.000Z';
function event(id = 'source-1'): EventRecord {
  return { ...prepareEventData({ ...EMPTY_EVENT_DRAFT, title: 'Import me', allDay: true, start: '2026-10-10', end: '2026-10-10' }).data!, id, createdAt: stamp, updatedAt: stamp };
}

it('retains bounded schedule history, excludes unchanged edits and duplicate history', () => {
  let previous = event();
  for (let i = 11; i <= 25; i++) previous = withScheduleHistory(previous, { ...previous, start: `2026-10-${i}`, end: `2026-10-${i}`, updatedAt: stamp });
  expect(previous.scheduleHistory).toHaveLength(10);
  expect(previous.previousStartDate).toBe('2026-10-24');
  const same = withScheduleHistory(previous, { ...previous, title: 'Edited' });
  expect(same.scheduleHistory).toEqual(previous.scheduleHistory);
  expect(duplicateEventDraft(same)).not.toHaveProperty('scheduleHistory');
  expect(duplicateEventDraft(same)).not.toHaveProperty('previousStartDate');
  expect(eventToDraft(same).published).toBe(false);
});

it('uses an occurrence original start for moved dates without leaking series history', () => {
  const series = { ...event(), published: true, status: 'rescheduled' as const, previousStartDate: '2026-10-01', recurrence: { frequency: 'daily' as const, until: '2026-10-12' }, exceptions: [{ recurrenceId: '2026-10-11', status: 'modified' as const, overrides: { start: '2026-10-15', end: '2026-10-15', status: 'rescheduled' as const } }] };
  const occurrences = expandRecurringEvent(series, '2026-10-10', '2026-10-16');
  expect(occurrences.find(item => item.start === '2026-10-15')?.previousStartDate).toBe('2026-10-11');
  expect(occurrences.find(item => item.start === '2026-10-10')?.previousStartDate).toBeUndefined();
});

it('maps structured address and public organizer metadata, omitting empty fields', () => {
  const venue = { id: 'v', name: 'Hall', street: 'Main St', street2: 'Floor 2', locality: 'Geneva', region: '', postalCode: '1200', country: 'CH', createdAt: stamp, updatedAt: stamp };
  const organizer = { id: 'o', name: 'Association', website: 'https://example.com/', contactUrl: '', createdAt: stamp, updatedAt: stamp };
  const record = eventToJsonLd(formatPublicEvent({ ...event(), published: true, status: 'rescheduled', previousStartDate: '2026-10-09' }, venue, 'eventual', organizer));
  expect(record.location).toEqual({ '@type': 'Place', name: 'Hall', address: { '@type': 'PostalAddress', streetAddress: 'Main St, Floor 2', addressLocality: 'Geneva', postalCode: '1200', addressCountry: 'CH' } });
  expect(record.organizer).toEqual({ '@type': 'Organization', name: 'Association', url: 'https://example.com/' });
  expect(record.previousStartDate).toBe('2026-10-09');
});

it('manages organizers through valid admin blocks and guards concurrent edits', async () => {
  const h = await createPluginRuntimeTestHost();
  try {
    const invoke = (input: unknown) => h.transport.invokeRoute('admin', input) as Promise<BlockResponse>;
    const page = await invoke({ type: 'block_action', action_id: 'new-organizer' });
    expect(validateBlockResponse(page, {})).toEqual({ valid: true, errors: [] });
    const form = page.blocks.find(block => block.type === 'form')!;
    const saved = await invoke({ type: 'form_submit', action_id: 'save-organizer', block_id: form.block_id, values: { name: 'Association', website: 'https://example.com', contactUrl: 'https://example.com/contact' } });
    expect(saved.toast?.type).toBe('success');
    expect(validateBlockResponse(saved, {})).toEqual({ valid: true, errors: [] });
    const list = await h.transport.invokeRoute('mcp/organizers/list', {}) as { organizers: OrganizerRecord[] };
    const organizer = list.organizers[0]!;
    await expect(h.transport.invokeRoute('mcp/organizers/update', { id: organizer.id, expectedUpdatedAt: 'old', patch: { name: 'Lost edit' } })).resolves.toMatchObject({ ok: false });
    await expect(h.transport.invokeRoute('mcp/organizers/update', { id: organizer.id, expectedUpdatedAt: organizer.updatedAt, patch: { website: 'javascript:alert(1)' } })).resolves.toMatchObject({ ok: false });
    const created = await h.transport.invokeRoute('mcp/events/create', { title: 'Meet', start: '2026-10-10', end: '2026-10-10', allDay: true, organizerId: organizer.id, organizer: 'Fallback' }) as { event: EventRecord };
    const editor = await invoke({ type: 'block_action', action_id: 'edit-event', value: created.event.id });
    expect(validateBlockResponse(editor, {})).toEqual({ valid: true, errors: [] });
    expect(JSON.stringify(editor)).toContain(organizer.id);
    await h.transport.invokeRoute('mcp/events/publish', { id: created.event.id });
    const updated = await h.transport.invokeRoute('mcp/events/update', { id: created.event.id, patch: { start: '2026-10-11', end: '2026-10-11', status: 'rescheduled' } }) as { event: EventRecord };
    expect(updated.event.previousStartDate).toBe('2026-10-10');
    const feed = await h.transport.invokeRoute('publicEvents', { from: '2026-10-10', through: '2026-10-12' }, { method: 'GET' });
    expect(feed).toMatchObject({ events: [{ organizer: 'Association', organizerDetails: { id: organizer.id }, previousStartDate: '2026-10-10' }] });
    await expect(h.transport.invokeRoute('mcp/events/update', { id: created.event.id, patch: { organizerId: '' } })).resolves.toMatchObject({ ok: true });
  } finally { await h.dispose(); }
}, 15000);

it('previews without writes, reports bad rows, and deduplicates concurrent real imports atomically', async () => {
  const h = await createPluginRuntimeTestHost();
  try {
    const data = event();
    data.published = true;
    const input = { collection: 'events', source: 'stable-source', records: [{ sourceId: data.id, data }] };
    await expect(h.transport.invokeRoute('mcp/transfer/preview', input)).resolves.toMatchObject({ ok: true, rows: [{ status: 'ready' }] });
    expect(await h.inspect.storage.list('events')).toHaveLength(0);
    const results = await Promise.all([h.transport.invokeRoute('mcp/transfer/import', input), h.transport.invokeRoute('mcp/transfer/import', input)]) as Array<{ rows: Array<{ status: string; id: string }> }>;
    expect(results.map(result => result.rows[0]!.status).sort()).toEqual(['imported', 'skipped']);
    const stored = await h.inspect.storage.get<EventRecord>('events', results[0]!.rows[0]!.id);
    expect(stored).toMatchObject({ published: false, status: 'draft' });
    const invalid = { ...event('bad'), virtualUrl: 'javascript:alert(1)' };
    await expect(h.transport.invokeRoute('mcp/transfer/import', { ...input, records: [{ sourceId: 'bad', data: invalid }, { sourceId: data.id, data }] })).resolves.toMatchObject({ ok: false, rows: [{ status: 'error' }, { status: 'skipped' }] });
    await expect(h.transport.invokeRoute('mcp/transfer/import', { ...input, records: [{ sourceId: 'bad', data: { ...event('bad'), locationType: 'invalid' } }, { sourceId: data.id, data }] })).resolves.toMatchObject({ ok: false, rows: [{ status: 'error' }, { status: 'skipped' }] });
    await expect(h.transport.invokeRoute('mcp/transfer/export', { collection: 'events', limit: 1 })).resolves.toMatchObject({ ok: true, records: [{ data: { published: false } }] });
    const referenced = { ...event('ref'), venueId: 'missing' };
    await expect(h.transport.invokeRoute('mcp/transfer/preview', { ...input, records: [{ sourceId: 'ref', data: referenced }] })).resolves.toMatchObject({ rows: [{ status: 'ready', warnings: [expect.stringContaining('Missing venues')] }] });
    await expect(h.transport.invokeRoute('mcp/transfer/import', { ...input, records: [{ sourceId: 'ref', data: referenced }] })).resolves.toMatchObject({ ok: false, rows: [{ status: 'error' }] });
    const timed = { ...event('fold'), allDay: false, timezone: 'Europe/Paris', start: '2026-10-25T01:30:45.000Z', end: '2026-10-25T01:45:47.000Z' };
    const fold = await h.transport.invokeRoute('mcp/transfer/import', { ...input, records: [{ sourceId: timed.id, data: timed }] }) as { rows: Array<{ id: string }> };
    expect(await h.inspect.storage.get('events', fold.rows[0]!.id)).toMatchObject({ start: timed.start, end: timed.end });
  } finally { await h.dispose(); }
}, 15000);

it('exports and restores related records and recurrence exceptions across fresh hosts', async () => {
  const routes = { exportRecords: 'mcp/transfer/export', previewImport: 'mcp/transfer/preview', importRecords: 'mcp/transfer/import' };
  const first = await createPluginRuntimeTestHost();
  let backup: Backup;
  try {
    const venue = { id: 'v', name: 'Hall', street: 'Main St', street2: '', locality: 'Geneva', region: '', postalCode: '1200', country: 'CH', createdAt: stamp, updatedAt: stamp };
    const organizer = { id: 'o', name: 'Association', website: 'https://example.com/', contactUrl: '', createdAt: stamp, updatedAt: stamp };
    const series = { ...event('series'), venueId: 'v', organizerId: 'o', recurrence: { frequency: 'daily', until: '2026-10-12' }, exceptions: [{ recurrenceId: '2026-10-11', status: 'cancelled' }] };
    await first.fixtures.plugin.storage('venues', 'v', venue);
    await first.fixtures.plugin.storage('organizers', 'o', organizer);
    await first.fixtures.plugin.storage('events', 'series', series);
    const invoke: Invoke = async (name, input) => await first.transport.invokeRoute(routes[name], input) as ToolResult;
    backup = await exportBackup(invoke);
    expect(backup.collections.events[0]?.data).toMatchObject({ exceptions: [{ status: 'cancelled' }], venueId: 'v' });
  } finally { await first.dispose(); }
  const second = await createPluginRuntimeTestHost();
  try {
    const invoke: Invoke = async (name, input) => await second.transport.invokeRoute(routes[name], input) as ToolResult;
    const preview = await restoreBackup(invoke, backup);
    expect(preview.events[0]?.warnings).toHaveLength(2);
    const imported = await restoreBackup(invoke, backup, { write: true });
    expect(imported.events[0]?.status).toBe('imported');
    expect(await second.inspect.storage.get('events', 'series')).toMatchObject({ venueId: 'v', organizerId: 'o', published: false, exceptions: [{ recurrenceId: '2026-10-11', status: 'cancelled' }] });
    expect((await restoreBackup(invoke, backup, { write: true })).events[0]?.status).toBe('skipped');
  } finally { await second.dispose(); }
}, 20000);
