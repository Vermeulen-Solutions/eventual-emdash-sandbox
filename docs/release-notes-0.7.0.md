# Eventual 0.7.0

Status: published to the publisher PDS on 2026-09-27 from
`feature/eventual-occurrence-recurrence` at commit `9ce4deb`. The first status
check reported **Release 0.7.0: approved**, **Package details: needs review**,
and **Public listing: not available**. Release approval and package-listing
approval are separate; availability is not yet confirmed.

The publisher reported that 0.6.0 was accepted after a manual-review false
positive: the compatibility claim was flagged as impersonation. This resolved
the earlier publication hold. No site installation or update was performed.

## Included

- Saved recurring events now have a **Manage occurrence dates** view. It shows
  ten dates per page within a selectable 90-day window, with original and
  effective schedules and scheduled, changed, or cancelled states. Editors can
  Change, Cancel, and Restore an occurrence without entering its identity.
  Cancel and Restore require an explicit confirmation. Manual exception entry
  remains available.
- Added the read-only `eventual__listOccurrences` MCP tool, bringing the tool
  count to 16. Authorized agents can inspect published or draft events and
  retrieve the exact recurrence IDs for existing exception tools. Results
  include cancellations, moved dates, totals, and truncation metadata. The
  default window covers 90 inclusive dates; custom windows support up to 366
  inclusive dates and 100 results. One-off events have a null recurrence ID.
- Daily, weekly, and monthly recurrence now support an interval from 1 to 52.
  Missing intervals retain the previous behavior. Intervals use local calendar
  dates, Monday-based weeks, and calendar months, preserving wall-clock times
  across daylight-saving transitions.
- Weekly series can select multiple weekdays, including alternate-week
  schedules. Missing weekday selections retain the first event's weekday.
  The first event must match a selected day; earlier dates are never generated.
- Admin fields, MCP schemas, domain validation, previews, dashboard data, and
  public feeds share the same recurrence rules. Schedule edits continue to
  reject orphaned exceptions and create cancellation tombstones for removed
  published occurrences.

## Audit fixes

- Explicit monthly day-of-month rules are preserved across unrelated MCP
  updates. Previously a supplied day number was silently replaced by the first
  event's date. The editor now exposes the monthly day number, including rules
  such as day 31 with the existing last-day fallback in February.
- Moved occurrences are discoverable by their effective date even when their
  original date is outside the query window. Their original identity is kept
  and duplicate rows are avoided.
- Occurrence ranges enforce 366 inclusive dates; invalid calendar dates,
  invalid limits, duplicate weekdays, and unsuitable first dates are rejected.
- Admin exception creation enforces the existing 500-exception maximum.
- Host validation exposed the 2,000-node Block Kit response limit when the
  complete event form and exception actions were rendered together. Occurrence
  management and exception editing now use separate views. A test validates
  event details, occurrence management, and exception editing with 500 saved
  exceptions. The management view shows the first 25 saved exception entries;
  other dates remain accessible through the date window or MCP.

## Compatibility and scope

Existing one-off events, omitted recurrence options, public JSON shape,
iCalendar identities, all-day end-date conventions, and publication controls
retain their behavior. The existing upcoming-events dashboard widget consumes
the shared recurrence expansion and remains an editor overview.

No new dependencies, storage collections, indexes, capabilities, allowed
hosts, or visitor UI were added. Domain inspection and recurrence helpers,
MCP schemas/handlers, storage, admin rendering, and public formatting remain
separate. Changes are confined to this sandbox repository.

## Validation

Executed on Node v24.21.0 and npm v10.5.0 with the pinned
`@emdash-cms/plugin-cli` 0.12.0:

```powershell
npm run typecheck
npm test
npm run validate
npm exec emdash-plugin -- bundle --validate-only
npm run bundle
```

All passed. The final test run passed **70 tests in 9 files**. Coverage includes
legacy recurrence, calendar interval anchoring, multiple weekdays, DST gaps,
monthly missing days/fifth weekdays, all-day spans, moved and cancelled dates,
restore actions, orphaned exceptions, input limits, stable calendar identities
and cancellation storage, and host-validated admin/MCP interactions.

## Registry bundle measurements

Decompressed package measurements after substantial milestones:

| Milestone | backend.js bytes | Complete package bytes |
| --- | ---: | ---: |
| Occurrence inspection and editor | 91,322 | 136,794 |
| Recurrence intervals | 93,410 | 139,642 |
| Multiple weekdays | 94,615 | 143,525 |
| Final 0.7.0 package | **95,326** | **146,599** |

Final archive: `dist/eventual-0.7.0.tar.gz`.

| Final package entry | Bytes |
| --- | ---: |
| backend.js | 95,326 |
| manifest.json | 35,287 |
| README.md | 15,986 |
| Total decompressed package (3 files) | **146,599** |

The backend is 93.1 KiB, below the registry's 131,072-byte limit. The complete
package is 143.2 KiB, below its 262,144-byte limit. Both also pass this project's
stricter 110 KiB backend and 200 KiB package gates. Backend growth from 0.6.0
is 10,124 bytes; complete package growth is 17,079 bytes.

Compressed archive: **37,154 bytes**. SHA-256:

```text
3bfdaa073f0ea1e1a399cbfe38d7aeae6a2dd415b9c6c9cb26464197ad4b3597
```

Exact size/inspection output from `npm exec emdash-plugin -- bundle --validate-only`:

```text
i Bundle size: 143.2 KB across 3 files
√ Validation passed
```

`npm run bundle` also created `eventual-0.7.0.tar.gz` and reported its
compressed size as `36.3KB`.

Registry acceptance is based on decompressed package entries, not gzip size.

## Remaining limits

- Recurring series still require an inclusive end date. No yearly recurrence,
  COUNT, arbitrary RRULE, CSV/ICS import, or scheduled external calendar sync.
- Occurrence inspection is bounded to 366 inclusive dates and 100 MCP results;
  use smaller windows when results are truncated. The editor pages ten dates
  within each 90-day window.
- Existing exception records are limited to 500 per event. Recurrence changes
  that orphan exceptions must first resolve those exceptions.
- Visitor calendars and presentation remain the consuming Astro site's
  responsibility.

## Publication and later site update

Published using the documented direct CLI workflow:

```powershell
Set-Location C:\dev\eventual-em\eventual-emdash-sandbox
npm run publish -- --json
```

The CLI rebuilt and validated the package, uploaded its blob, and created a
new immutable release without overwriting an existing release. The published
archive checksum above supersedes the preparation archive checksum (archive
timestamps changed during the publish build; package-entry sizes are unchanged).

Release URI:

```text
at://did:plc:g2hei4vcwndrdl3gdbb6np6c/com.emdashcms.experimental.package.release/eventual:0.7.0
```

Release record CID: `bafyreiahrhax5aeno3kvzrxdnno2iacqjqvtb4dsdwct3inutfjedbshly`.

The publish command retained the existing package installation text. A dry run
of `npm exec emdash-plugin -- update-package --json` showed only the intended
installation-section addition (recurrence features and MCP tool enablement).
It was applied with `npm exec emdash-plugin -- update-package --yes --json`.

Recheck registry status before updating a site:

```powershell
npm exec emdash-plugin -- info vermeulen.solutions eventual --version 0.7.0
```

The later Puplinge Solidaire admin action is: **Registry →
@vermeulen.solutions/eventual → select 0.7.0 → Update**, then review and confirm
the update consent shown by EmDash. In **MCP settings**, enable
`eventual__listOccurrences` for the intended agents. The tool requires
`plugins:manage`, as do the existing Eventual MCP tools.
