import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, csvToRecords, icsToRecords, exportBackup, transferRecords, restoreBackup } from '../transfer/index.mjs';

test('CSV quoted multiline data, commas, BOM and strict headers', () => {
  assert.deepEqual(parseCsv('\uFEFFa,b\r\n"hello,\nworld","a""b"\r\n'), [['a', 'b'], ['hello,\nworld', 'a"b']]);
  for (const input of ['"bad', 'a"b', '"a"b']) assert.throws(() => parseCsv(input));
  assert.throws(() => csvToRecords('title,title\nA,B'));
  const result = csvToRecords('sourceId,title,start,end,allDay\nx,Party,2026-10-10,2026-10-10,true\ny,Timed,2026-10-10T12:00,2026-10-10T13:00,false');
  assert.equal(result.records.length, 1); assert.equal(result.errors[0].row, 3);
  assert.equal(result.records[0].data.published, false);
});
test('ICS folding, escaping and exclusive all-day end; no silent recurrence loss', () => {
  const wrap = text => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${text}\r\nEND:VCALENDAR\r\n`;
  const result = icsToRecords(wrap('BEGIN:VEVENT\r\nUID:x\r\nSUMMARY:Party\\, in\r\n  town\r\nDTSTART;VALUE=DATE:20261010\r\nDTEND;VALUE=DATE:20261012\r\nEND:VEVENT'));
  assert.equal(result.records[0].data.title, 'Party, in town');
  assert.equal(result.records[0].data.end, '2026-10-11');
  for (const schedule of ['DTSTART:20261010T120000Z\r\nDTEND:20261010T130000Z\r\nRRULE:FREQ=DAILY', 'DTSTART;TZID=Europe/Paris:20261010T120000', 'DTSTART:20261010T120000', 'DTSTART;VALUE=DATE:20261010\r\nDTEND;VALUE=DATE:20260231']) {
    const invalid = icsToRecords(wrap(`BEGIN:VEVENT\r\nUID:x\r\nSUMMARY:X\r\n${schedule}\r\nEND:VEVENT`));
    assert.equal(invalid.records.length, 0); assert.equal(invalid.errors.length, 1);
  }
});
test('backup follows cursors, retries page size and restores references first', async () => {
  const calls = [];
  const backup = await exportBackup(async (name, input) => {
    calls.push(input);
    if (input.collection === 'events' && input.limit === 5) return { ok: false, error: 'EXPORT_PAGE_TOO_LARGE' };
    return { ok: true, records: [{ sourceId: input.cursor ?? input.collection, data: {} }], ...(input.collection === 'events' && !input.cursor ? { nextCursor: 'next' } : {}) };
  });
  assert.equal(backup.collections.events.length, 2);
  const imported = [];
  await restoreBackup(async (name, input) => { imported.push([name, input]); return { rows: [] }; }, backup);
  assert.deepEqual(imported.map(([, input]) => input.collection), ['venues', 'organizers', 'events']);
  assert.ok(imported.every(([name, input]) => name === 'previewImport' && input.mode === 'restore'));
});
test('transfer batches by count and byte size, defaults to preview', async () => {
  const batches = [];
  await transferRecords(async (name, input) => { batches.push([name, input]); return { rows: [] }; }, 'events', Array.from({ length: 21 }, (_, i) => ({ sourceId: String(i), data: {} })), { source: 'csv' });
  assert.deepEqual(batches.map(([, input]) => input.records.length), [10, 10, 1]);
  assert.ok(batches.every(([name]) => name === 'previewImport'));
  await assert.rejects(transferRecords(async () => ({}), 'events', [{ sourceId: 'x', data: 'x'.repeat(65536) }], { source: 'csv' }), /exceeds/);
});
