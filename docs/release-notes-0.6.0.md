# Eventual 0.6.0

## Included

- Restored 15 schema-backed MCP tools for event series, publishing, occurrence
  exceptions, saved venues, and the default timezone. All tools require
  `plugins:manage`; agents must also be enabled in EmDash MCP settings.
- Added the `upcoming-events` dashboard widget with published events from the
  next 90 days, timezone-aware date/time, venue or location, an empty state,
  and a link to the Events admin page.
- Event schedule changes now reject recurrence rules that would orphan saved
  occurrence exceptions. The admin and MCP paths retain exceptions safely.
- Venue deletion checks the indexed `venueId` field and rejects assigned
  venues. MCP event image selections are checked against ready media records.
- Added MCP operation/validation, recurrence exception, dashboard state, and
  timezone-aware one-off coverage.

Existing JSON, iCalendar, and public image routes remain in the plugin. The
visitor calendar remains the consuming Astro site's responsibility.

## Registry bundle measurement

Measured with `npm run bundle` and `emdash-plugin bundle` on Node v24.21.0 and
npm v10.5.0:

- `backend.js`: 85,202 bytes (83.2 KiB), below the 128 KB limit.
- Complete registry bundle: 129,520 bytes (126.5 KiB) across 3 files, below
  the 256 KB limit.
- Compressed tarball: 33,183 bytes (32.4 KB).

CLI output: `Bundle size: 126.5 KB across 3 files`; `Validation passed`.
