# Beacon-inspired Eventual improvements

Status: proposed implementation plan, 2026-09-27. No runtime changes or release
are included in this planning task.

## Recommendation

Prepare a focused 0.7.0 release with better occurrence selection and recurrence
intervals, followed by multiple weekdays for weekly series if the size gates
pass. Keep the shared event rules in the sandboxed backend and the public
presentation in the consuming Astro site.

Beacon Events 0.7.0 was reviewed through its WordPress listing, SVN directory
listing, and published source. Borrow the workflow ideas; implement them with
documented EmDash APIs and Eventual's existing domain modules.

References:

- https://wordpress.org/plugins/beacon-events/
- https://plugins.svn.wordpress.org/beacon-events/trunk/
- https://docs.emdashcms.com/plugins/creating-plugins/publishing/
- https://docs.emdashcms.com/plugins/creating-plugins/storage/

## Existing behavior to build on

The current Eventual source already provides draft duplication, timezone-aware
schedule summaries, three recurrence samples, structured exception forms,
saved venues, directions links without an API key, a dashboard widget, 15 MCP
tools, and stable iCalendar occurrence UIDs with cancellation tombstones.
These are existing features, not new work proposed by this plan.

The useful gap is that exceptions still require entering the original date and
time, recurrence has no interval, and a weekly series follows only the first
event's weekday.

## Registry budget

Baseline read from the existing `dist/eventual-0.6.0.tar.gz`, without rebuilding:

| Archive entry | Bytes |
| --- | ---: |
| backend.js | 85,202 |
| manifest.json | 30,695 |
| README.md | 13,623 |
| Total decompressed package | 129,520 |

The pinned CLI implements these hard limits: 131,072 bytes per file, 262,144
bytes total decompressed, and at most 20 files. Current official publishing
documentation confirms the 128 KB / 256 KB / 20-file limits. Gzip size is not
the acceptance metric. Every bundled file, including the generated MCP schemas
in the manifest, counts.

Use stricter project gates: backend below 112,640 bytes (110 KiB), package below
204,800 bytes (200 KiB), and each other file below 131,072 bytes. Allocate at
most 20 KiB of backend growth and 35 KiB of package growth to this release;
these are implementation budgets, not predicted measurements.

Use the existing dependencies and compact schema approach. Share occurrence
enumeration and recurrence validation between admin, MCP, and public feeds.
Measure after each milestone with the documented command from the plugin root:

```powershell
npm exec emdash-plugin -- bundle --validate-only
```

Before release, run `npm run bundle`, inspect the tarball entries, sum their
decompressed sizes, and record the exact CLI output and byte counts. If an
addition exceeds a project gate, simplify it or defer the optional milestone.
Do not split executable code to evade the per-file limit.

## Milestone 1: choose and manage an occurrence

1. Add a shared, bounded occurrence inspection helper in the domain layer.
   Return the original recurrence ID and local scheduled time, the effective
   start/end after overrides, and scheduled/cancelled/modified state. Preserve
   cancelled rows for editor inspection; retain the existing public behavior.
2. In a saved recurring event's editor, show up to ten occurrences for the next
   90 days, with a small navigation action for another bounded window. Label
   times in the event timezone and show both original and replacement dates for
   moved occurrences. Label the list as reflecting the saved schedule.
3. Provide Change, Cancel, and Restore actions using the existing exception
   mutation paths. Prefill the original recurrence ID from the selected row;
   retain manual entry for dates outside the displayed window. Restoration
   removes the exception and clearly describes its effect.
4. Expose one read-only MCP tool, `listOccurrences`, taking event ID, optional
   date range, and a limit capped at 100. Reuse the same inspection helper and
   return exact recurrence IDs so agents can safely call the existing exception
   tools. Keep the permission at `plugins:manage` and use the documented MCP
   tool contract. Do not include this editor data in the public JSON response.
5. Ensure moved occurrences are discoverable by their effective date, preserve
   their original identity, and avoid duplicate rows. Enforce a maximum range
   of 366 inclusive dates and explicit result truncation metadata.

Acceptance: editors and agents can select a real occurrence, cancel/move it,
and restore it without guessing a date or time. Draft series can be inspected
by authorized users. Public feeds, publication rules, and tombstones retain
their existing semantics.

Backend growth allocation: 6 KiB, including the MCP tool and Block Kit controls.

## Milestone 2: recurrence intervals

1. Add optional `interval` to daily, weekly, and monthly recurrence; missing
   values mean 1 so stored events and existing MCP callers keep working.
2. Accept integers from 1 through 52. Expose a conditional Every N field and
   plain language summaries such as Every 2 weeks through 31 December.
3. Anchor daily intervals to the first local date, weekly intervals to the
   Monday-containing week of that date, and monthly intervals to its calendar
   month. Do not derive intervals from elapsed milliseconds across DST.
4. Preserve monthly day/weekday-position patterns and existing missing-day
   policies. Keep the inclusive end date mandatory to bound the series.
5. Update domain validation, draft conversion, MCP schema and runtime validation,
   admin fields, previews, exception membership checks, and every consumer of
   recurrence through shared helpers. Continue rejecting edits that orphan
   saved exceptions. Continue cancelling removed published UIDs through the
   existing storage write path.

Acceptance: Every 2 weeks and Every 3 months produce consistent results in the
editor, MCP, dashboard, JSON, and iCalendar feeds. Existing events remain
identical when interval is absent or 1. Unrelated edits preserve recurrence.

Backend growth allocation: 6 KiB.

## Milestone 3: multiple weekdays for weekly events

Implement after the first two milestones pass their size gates.

1. Add optional `weekdays` to weekly recurrence. Missing values retain the first
   event's weekday. An explicit list must be nonempty, valid, unique, and
   canonicalized. The first event must match one selected weekday.
2. Provide native Block Kit multi-selection supported by the pinned SDK, with
   accessible labels. Verify the contract before choosing the control; use a
   simpler supported field if necessary.
3. Apply the interval to calendar weeks, then select weekdays inside those
   weeks. State Monday as the week boundary in the editor/API documentation.
   Do not generate occurrences before the first event.
4. Preserve an independent recurrence ID for each selected day. Schedule edits
   continue to reject orphaned exceptions and produce calendar cancellations
   for removed published occurrences.

Acceptance: Tuesday/Thursday training sessions and alternate-week schedules can
be represented as one series, including correct DST and exception behavior.

Backend growth allocation: 3 KiB. Reserve the remaining 5 KiB for shared
validation, error messages, and unforeseen integration costs.

## Architecture and regression coverage

- Domain modules: recurrence membership, bounded inspection, date conversions,
  and human-readable recurrence summaries; no storage or Block Kit imports.
- Storage: keep existing plugin collections and indexed queries. No occurrence
  cache or materialized collection is needed for these bounded windows.
- MCP schemas and handlers: thin input contracts and orchestration around the
  shared domain/storage functions. Check both schema and runtime validation.
- Admin: Block Kit rendering and interactions using shared helpers.
- Public formatting/routes: retain the current JSON contract, UTC timed values,
  inclusive all-day dates, stable IDs, and iCalendar exclusive all-day DTEND.

Focused tests should cover backwards-compatible records, interval anchoring,
Monday/Sunday week boundaries, multiple weekdays, DST transitions, nonexistent
local times, monthly missing dates and fifth weekdays, all-day spans, moved
occurrences crossing query windows, cancelled inspection rows, restore actions,
orphaned exceptions, stable calendar UIDs/tombstones, input limits and explicit
truncation, and host-validated Block Kit/MCP interactions.

Run the established commands before release:

```powershell
npm run typecheck
npm test
npm run validate
npm run bundle
```

Use a new feature branch for implementation, preserve existing local work, and
make logical commits for inspection/editor work and recurrence extensions. The
new read-only MCP tool introduces a route, so plan a minor version, 0.7.0. It
requires tool enablement in EmDash and may cause update consent. Keep current
capabilities, allowed hosts, and storage declarations for the planned scope.
Treat publication as a separate release step after validation and resolution
of the existing 0.6.0 registry update issue; never overwrite the 0.6.0 release.

## Deferred work

- CSV/ICS imports and scheduled Google Calendar sync: valuable future work,
  but needs source-scoped stable IDs, retry/idempotence policies, field ownership,
  import reports, and robust RFC parsing. Start any future import design with
  draft-only import, a preview, and visible warnings for unsupported recurrence.
  Never draft missing entries from a failed or incomplete feed response. Network
  sync also needs documented scheduling support and a deliberate trust-contract
  change. Do not add an unrestricted URL fetcher to this release.
- Annual recurrence, COUNT, full RRULE input, and a separate skip-date mechanism:
  defer until needed. Existing cancellation exceptions cover single excluded
  dates while preserving calendar notifications.
- Materialized occurrence storage: adds rebuild, rolling-horizon, consistency,
  and storage-contract obligations. Consider only after measuring a real query
  bottleneck.
- Online/hybrid attendance fields: the current external URL already supports
  useful links. Add distinct public meeting metadata only with a demonstrated
  use case and clear publication semantics.
- Google Calendar links, schema.org Event metadata, category colours, and
  venue/category landing pages: suitable future improvements in the Astro
  integration example, outside the registry backend bundle. They do not justify
  a custom visitor UI inside the plugin.

All implementation described here is confined to the sandbox plugin repository.
Other site repositories and the older `C:\dev\eventual` reference are outside
the write scope.
