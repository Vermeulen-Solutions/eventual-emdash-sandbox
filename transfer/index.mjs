/** Host-side helpers. None of this module is included in the sandbox bundle. */
const collections = ['venues', 'organizers', 'events'];
const now = () => new Date().toISOString();
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const baseEvent = (id, fields) => ({ id, title: '', description: '', start: '', end: '', allDay: false, timezone: 'UTC', location: '', organizer: '', externalUrl: '', imageUrl: '', categories: [], published: false, status: 'draft', exceptions: [], createdAt: now(), updatedAt: now(), ...fields });

/** RFC 4180 CSV, including quoted newlines and escaped quotes. */
export function parseCsv(text) {
  if (typeof text !== 'string' || text.length > 5_000_000) throw new Error('CSV must be text under 5 MB.');
  const rows = [];
  let row = [], cell = '', quoted = false, closed = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; }
      else cell += char;
    } else if (char === '"') {
      if (cell || closed) throw new Error('Unexpected quote in CSV.');
      quoted = true;
    } else if (char === ',' || char === '\n' || char === '\r') {
      row.push(cell); cell = ''; closed = false;
      if (char !== ',') { rows.push(row); row = []; if (char === '\r' && text[i + 1] === '\n') i++; }
    } else { if (closed) throw new Error('Unexpected text after CSV quote.'); cell += char; }
  }
  if (quoted) throw new Error('Unclosed CSV quote.');
  if (cell || row.length || closed) { row.push(cell); rows.push(row); }
  return rows;
}

export function csvToRecords(text) {
  const [headers, ...rows] = parseCsv(text);
  const allowed = ['sourceId', 'title', 'description', 'start', 'end', 'allDay', 'timezone', 'location', 'locationType', 'virtualUrl', 'organizer', 'externalUrl', 'imageUrl', 'categories'];
  if (!headers || new Set(headers).size !== headers.length || headers.some(key => !allowed.includes(key)) || !['sourceId', 'title', 'start', 'end', 'allDay'].every(key => headers.includes(key))) throw new Error('Use unique supported headers including sourceId,title,start,end,allDay.');
  const records = [], errors = [];
  for (const [index, cells] of rows.entries()) {
    if (cells.every(cell => cell === '')) continue;
    if (cells.length !== headers.length) { errors.push({ row: index + 2, error: 'Column count does not match headers.' }); continue; }
    const fields = Object.fromEntries(headers.map((header, column) => [header, cells[column]]));
    const sourceId = fields.sourceId;
    if (!sourceId || !['true', 'false'].includes(fields.allDay)) { errors.push({ row: index + 2, error: 'sourceId is required and allDay must be true or false.' }); continue; }
    delete fields.sourceId;
    fields.allDay = fields.allDay === 'true';
    fields.categories = (fields.categories ?? '').split(/[;\n]/).map(value => value.trim()).filter(Boolean);
    if ([fields.start, fields.end].some(value => !validDate(value.slice(0, 10))) || fields.allDay && (!validDate(fields.start) || !validDate(fields.end) || fields.end < fields.start)) { errors.push({ row: index + 2, error: 'Invalid calendar dates.' }); continue; }
    // Timed CSV values must contain an explicit offset; DST wall times need a deliberate choice.
    if (!fields.allDay && [fields.start, fields.end].some(value => !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value)))) { errors.push({ row: index + 2, error: 'Timed CSV dates require ISO timestamps with Z or an explicit offset.' }); continue; }
    if (!fields.allDay) { fields.start = new Date(fields.start).toISOString(); fields.end = new Date(fields.end).toISOString(); }
    records.push({ sourceId, data: baseEvent(sourceId, fields) });
  }
  return { records, errors };
}

function icalText(value) { return value.replace(/\\([nN,;\\])/g, (_, char) => char === 'n' || char === 'N' ? '\n' : char); }
function icalDate(value, dateOnly) {
  const date = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  if (!validDate(date)) throw new Error('Invalid calendar date.');
  if (dateOnly && /^\d{8}$/.test(value)) return date;
  if (!dateOnly && /^\d{8}T\d{6}Z$/.test(value)) return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}.000Z`;
  throw new Error('Only UTC timestamps and VALUE=DATE schedules are supported; floating and TZID times need conversion first.');
}

/** Deliberately accepts standalone events only; never silently drops recurrence. */
export function icsToRecords(text) {
  if (typeof text !== 'string' || text.length > 5_000_000) throw new Error('Calendar must be text under 5 MB.');
  if (!/^BEGIN:VCALENDAR\r?\n/.test(text) || !/\r?\nEND:VCALENDAR(?:\r?\n)?$/.test(text)) throw new Error('Expected a VCALENDAR document.');
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const records = [], errors = [];
  let event = null, row = 0, unsupported = '';
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { if (event) throw new Error('Nested VEVENT.'); event = new Map(); unsupported = ''; row++; continue; }
    if (line === 'END:VEVENT') {
      if (!event) throw new Error('Unexpected END:VEVENT.');
      try {
        if (unsupported) throw new Error(unsupported);
        const get = key => event.get(key);
        const uid = get('UID')?.value;
        if (!uid || !get('SUMMARY') || !get('DTSTART')) throw new Error('UID, SUMMARY, and DTSTART are required.');
        const allDay = get('DTSTART').params === 'VALUE=DATE';
        const start = icalDate(get('DTSTART').value, allDay);
        const endField = get('DTEND');
        if (!allDay && !endField) throw new Error('Timed events require DTEND.');
        if (endField && endField.params !== get('DTSTART').params) throw new Error('DTSTART and DTEND value types must match.');
        let end = endField ? icalDate(endField.value, allDay) : start;
        if (allDay && endField) {
          const date = new Date(`${end}T00:00:00Z`);
          if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== end || end <= start) throw new Error('All-day DTEND must be a valid exclusive date after DTSTART.');
          date.setUTCDate(date.getUTCDate() - 1); end = date.toISOString().slice(0, 10);
        }
        records.push({ sourceId: uid, data: baseEvent(uid, { title: icalText(get('SUMMARY').value), description: icalText(get('DESCRIPTION')?.value ?? ''), start, end, allDay, location: icalText(get('LOCATION')?.value ?? ''), externalUrl: get('URL')?.value ?? '' }) });
      } catch (error) { errors.push({ row, error: error.message }); }
      event = null; continue;
    }
    if (!event) continue;
    if (line.startsWith('END:')) { unsupported = 'Nested components require conversion first.'; continue; }
    const colon = line.indexOf(':');
    if (colon < 0) { unsupported = 'Malformed VEVENT property.'; continue; }
    const [key, ...params] = line.slice(0, colon).split(';');
    if (['RRULE', 'RDATE', 'EXDATE', 'RECURRENCE-ID', 'DURATION'].includes(key) || key === 'BEGIN') unsupported = 'Recurring events, DURATION, and nested components require conversion first.';
    if (['UID', 'SUMMARY', 'DESCRIPTION', 'DTSTART', 'DTEND', 'LOCATION', 'URL'].includes(key)) {
      if (event.has(key)) unsupported = `Duplicate ${key}.`;
      if ((key === 'DTSTART' || key === 'DTEND') && params.join(';') !== '' && params.join(';') !== 'VALUE=DATE') unsupported = 'Only UTC timestamps and VALUE=DATE are supported.';
      event.set(key, { params: params.join(';'), value: line.slice(colon + 1) });
    }
  }
  if (event) throw new Error('Unclosed VEVENT.');
  return { records, errors };
}

/** Invoke is an authenticated MCP adapter: (toolName, input) => the tool result. */
export async function exportBackup(invoke) {
  const backup = { format: 'eventual-data', version: 1, exportedAt: now(), collections: {} };
  for (const collection of collections) {
    const records = [], seen = new Set();
    let cursor;
    do {
      let result = await invoke('exportRecords', { collection, ...(cursor ? { cursor } : {}), limit: 5 });
      if (result.error === 'EXPORT_PAGE_TOO_LARGE') result = await invoke('exportRecords', { collection, ...(cursor ? { cursor } : {}), limit: 1 });
      if (!result.ok || !Array.isArray(result.records)) throw new Error(result.error ?? 'Invalid export response.');
      records.push(...result.records);
      cursor = result.nextCursor;
      if (cursor && seen.has(cursor)) throw new Error('Repeated export cursor.');
      if (cursor) seen.add(cursor);
    } while (cursor);
    backup.collections[collection] = records;
  }
  return backup;
}

export async function transferRecords(invoke, collection, records, { source, mode = 'copy', write = false } = {}) {
  if (!collections.includes(collection) || !source || !['copy', 'restore'].includes(mode)) throw new Error('Choose a collection, a stable source, and copy or restore mode.');
  const rows = [];
  let batch = [];
  const flush = async () => {
    if (!batch.length) return;
    const result = await invoke(write ? 'importRecords' : 'previewImport', { collection, source, mode, records: batch });
    if (!Array.isArray(result.rows)) throw new Error(result.error ?? 'Invalid import response.');
    rows.push(...result.rows); batch = [];
  };
  for (const record of records) {
    if (batch.length === 10 || new TextEncoder().encode(JSON.stringify({ collection, source, mode, records: [...batch, record] })).length > 65536) await flush();
    if (new TextEncoder().encode(JSON.stringify({ collection, source, mode, records: [record] })).length > 65536) throw new Error(`Record ${record.sourceId} exceeds 64 KiB.`);
    batch.push(record);
  }
  await flush();
  return rows;
}

export async function restoreBackup(invoke, backup, { source = 'backup', write = false } = {}) {
  if (backup?.format !== 'eventual-data' || backup.version !== 1 || !backup.collections || !collections.every(key => Array.isArray(backup.collections[key]))) throw new Error('Unsupported Eventual data export.');
  const result = {};
  for (const collection of collections) result[collection] = await transferRecords(invoke, collection, backup.collections[collection], { source, mode: 'restore', write });
  return result;
}
