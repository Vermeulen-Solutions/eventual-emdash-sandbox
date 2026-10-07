# Eventual 0.13.0 data transfer

**Breaking upgrade:** [Read the 0.13.0 guide](upgrade-0.13.0.md). Legacy imports below apply only before native authority is active. Native exports are native-content-v1 inspection exports, not full backups or legacy-import input. Explicit migration needs --legacy-compatibility schemas.

Import/export uses the authenticated MCP tools `exportRecords`, `previewImport`,
and `importRecords`, all restricted to `plugins:manage`. JSON parsing, CSV and ICS
conversion run on the host, outside the sandbox. No new outbound hosts or
capabilities are needed.

`eventual/transfer` exports `exportBackup`, `restoreBackup`, `transferRecords`,
`csvToRecords`, and `icsToRecords`. Supply an adapter that invokes those tool
names through your existing authenticated MCP client and unwraps their results:

```js
import { exportBackup, restoreBackup, csvToRecords, transferRecords } from 'eventual/transfer';
// invoke(name, input) returns the parsed Eventual tool result, not the MCP envelope.
const backup = await exportBackup(invoke);
const preview = await restoreBackup(invoke, backup); // no writes
const restored = await restoreBackup(invoke, backup, { write: true });
const converted = csvToRecords(csvText);
// Review converted.errors; every row still needs server validation.
const rows = await transferRecords(invoke, 'events', converted.records, { source: 'my-source' });
const imported = await transferRecords(invoke, 'events', converted.records, { source: 'my-source', write: true });
```

The converter can also run locally:

```sh
node scripts/convert-import.mjs csv events.csv converted.json
node scripts/convert-import.mjs ics calendar.ics converted.json
```

The output file contains `{ records, errors }` and is created exclusively; an
existing file is never overwritten. Conversion errors are numbered by CSV
record (the header is record 1) or VEVENT. Quoted CSV newlines do not change the
record number. Server errors are numbered within each batch and retain sourceId.

CSV headers: `sourceId,title,start,end,allDay` are required. Optional headers:
`description,timezone,location,locationType,virtualUrl,organizer,externalUrl,imageUrl,categories`.
Booleans are `true`/`false`; categories use semicolons or newlines. Timed dates
must include `Z` or an explicit offset. All-day ends are inclusive. Source IDs
must be stable: changing an ID or source namespace creates a new copy.

ICS conversion supports standalone VEVENTs with UTC schedules or `VALUE=DATE`.
It unfolds lines, decodes text escaping, and converts exclusive all-day DTEND
to Eventual's inclusive end. Unsupported RRULE, RDATE, EXDATE, RECURRENCE-ID,
DURATION, floating times, TZID values, and nested components produce errors;
they are never silently flattened. UTC conversion must happen before import
for other schedules. Imported lifecycle status is draft and requires review.

Each transfer request contains `{collection,source,mode,records}`; records are
`{sourceId,data}` objects from a JSON export or converter. sourceId must match
data.id. Maximum: 10 rows and 64 KiB of UTF-8 JSON per request. The host helper
batches by both size and count. Record schemas are validated on the server,
including schedules, recurrence membership, exceptions, history, and URLs.
Malformed envelopes fail the batch; malformed records report a row error while
other rows can succeed. Imports are resumable, not all-or-nothing transactions.

Copy mode hashes the source namespace, collection and source ID to a stable
storage ID. Related venue/organizer IDs use the same mapping. Restore mode keeps
exported IDs. Both modes atomically insert only absent IDs and skip existing
records without overwriting them, including simultaneous imports. Import venues
and organizers before events. Preview reports missing references as warnings;
the actual import rejects missing references. Preview is advisory and all
checks run again on import. Existing records that fail validation are errors,
not silent skips. A changed source record does not update a previous import.

All imported events are unpublished drafts, including occurrence statuses.
JSON export preserves schedules, recurrence, exceptions, history, venue and
organizer records. It is **not a complete site backup**: media bytes, settings,
calendar cancellation tombstones, permissions, and plugin installation state
are excluded. Records referencing media IDs are rejected on import; explicitly
remove those references or replace them with external image URLs. Existing
calendar subscriptions should use the host's complete backup/restore facility.
Exports are paginated; clients must follow every cursor. Pages larger than
64 KiB are retried with one row; oversized individual records need a host export.
Exports are not a transactional snapshot: pause editing for a consistent backup.

## Native collections and explicit prototype migration (0.13.0)

Eventual 0.13.0 uses the collections selected in settings, including custom event, venue/location and organizer names.

- **Single Native Authority:** Once native collections are authoritative on the host site, legacy import tools (`previewImport`, `importRecords`) return `NATIVE_COLLECTIONS_ACTIVE` to prevent accidental split-brain storage.
- **Migration Engine:** To move data from legacy Eventual storage into native collections, use the `migrateToNative` MCP tool or `POST /_emdash/api/plugins/eventual/mcp/transfer/migrateToNative`.
  - Supports `dryRun: true` to preview counts, mappings, and potential warnings with zero database writes.
  - Runs in bounded batches with `limit` (default 50) and cursor-based resumption via `nextCursor`.
  - Non-destructive: legacy records are never modified or removed.
  - Converts Markdown descriptions to schema-safe Portable Text while retaining source strings in `legacy_metadata`.
- For complete blueprint application and migration instructions, see [Native Modernization Guide](./native-modernization.md).

