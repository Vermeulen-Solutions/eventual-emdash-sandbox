# Eventual 1.0.0

## Compatibility

This release requires EmDash 1.0.1 or newer. Upgrade the EmDash host and its
sandbox runner before installing the Eventual release. The manifest declares
`env:emdash >=1.0.1`, and the local package declares the same peer minimum.
Event and venue records keep their existing storage format; no data migration
is required.

## Changes

- Event and venue admin lists use paged Block Kit tables. The event table has
  Edit, Duplicate, and confirmed Delete row actions, plus current-page bulk
  deletion for up to 25 selected events. Saving an event returns to the Events
  list. Recurring event details group occurrence controls in an accordion.
- Public JSON, calendar, MCP event lists, and the dashboard no longer return a
  silently truncated event scan. A scan above 10,000 matching records fails
  explicitly. Date-window feeds use the existing published/start index to
  exclude events starting after the requested window while keeping older
  recurring series.
- The public feed client and types are available from `eventual/astro`; the
  `eventual/astro/EventList.astro` component provides a small unstyled list.
  Registry installation does not add these files to an Astro site. Install the
  source package as a site dependency to use them.
- The admin route explicitly requires `plugins:manage`, matching the existing
  access policy for Eventual's MCP routes.

## Known limit

The published/start query still includes historical events that began before
the requested range, because a recurring series can remain active. Sites with
more than 10,000 such records receive an explicit feed error. A future storage
index that tracks each series' effective end would allow a narrower query.

## Verification

`npm run validate`, `npm run typecheck`, `npm test`, `npm run build`, and
`npm run bundle` pass. The Astro example's check, tests, and build pass, and
its simple list responds successfully against an EmDash 1.0.1 test site.
