# Eventual 0.9.0

Status: prepared and validated on 2026-09-29; **not published**.

## Compatibility

This release requires EmDash 1.0.1 or newer. The Block Kit dependency and the
manifest release requirement are pinned to that minimum. Event, venue, and
cancellation records keep their existing storage format; no data migration is
required. Public JSON and iCalendar remain read-only feed interfaces, and MCP
remains an agent-facing interface. None of these changes adds visitor-facing
UI.

## Admin and Block Kit updates

- Event and venue lists use paged Block Kit tables.
- Event rows provide Edit, Duplicate, and confirmed Delete actions. Event
  titles are also clickable, and saving an event returns to the Events list.
- The event list supports selecting and deleting up to 25 events from the
  current page after confirmation.
- Recurring event controls are grouped in an accordion. Event forms retain
  submitted values after validation errors and provide timezone search and
  schedule previews.
- The Events settings page adds an Admin time display setting. The default is
  24-hour formatting, with an optional 12-hour format. This changes Eventual's
  EmDash admin displays only; it does not change stored dates or public
  frontend output.

## Public feeds and limits

- Public JSON, calendar, MCP event lists, and the dashboard now fail explicitly
  when a matching scan exceeds 10,000 records instead of silently truncating
  results.
- Date-window feeds use the existing published/start index while retaining
  historical recurring series that may still produce occurrences.
- The public feed client and types are available from `eventual/astro`, and
  `eventual/astro/EventList.astro` provides a small unstyled Astro list.

## Known limits

- Historical recurring records can still be included when a requested window
  begins after the series start. A future index that tracks each series' end
  would allow narrower scans.
- The current EmDash table renderer right-aligns columns containing element
  buttons, so clickable event titles inherit that alignment until the host
  renderer changes.

## Verification

The plugin validation, typecheck, test suite, build, and bundle checks pass.
The suite currently contains 85 tests in 11 files. The Astro example and the
EmDash test site have also been checked against EmDash 1.0.1.

The prepared bundle contains `backend.js` at 113,497 bytes against the
131,072-byte backend limit, and 169,124 decompressed bytes across the complete
package against the 262,144-byte package limit. The compressed archive is
44,119 bytes. The bundle validator reports all three measurements as valid.

Before publication, make the release metadata consistent: the working package
and current bundle identify themselves as `1.0.0`, while these notes describe
the requested `0.9.0` release. The package version, archive name, registry
release record, and publication must use one version.
