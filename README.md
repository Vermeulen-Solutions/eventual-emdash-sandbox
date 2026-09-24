# eventual

A general-purpose, sandboxed events plugin for [EmDash CMS](https://emdashcms.com).

## Features

- Block Kit admin pages for events, saved venues, and settings.
- Event list duplication starts a clearly marked unpublished draft, carrying
  event fields, dates, and recurrence forward while clearing occurrence
  exceptions for review before saving.
- Timed and inclusive all-day events with an IANA timezone, one-off location,
  organizer, links, image-library selection (with an optional external image
  URL fallback), categories, and publication state.
- Daily, weekly, and monthly recurrence with cancellation or modified-instance
  exceptions. One-off events stay non-recurring.
- The saved event editor shows a timezone-aware schedule summary and up to
  three sample dates for a recurring series.
- Plugin-owned EmDash storage for events and venues; assigned venues cannot be
  deleted.
- Event images can be selected from the EmDash media library. Public images
  are served only while linked to a published Eventual event, with an 8 MiB
  limit and raster-image MIME allowlist.
- Public, read-only JSON feed at
  `/_emdash/api/plugins/eventual/publicEvents?from=YYYY-MM-DD&through=YYYY-MM-DD`.
  It returns published event occurrences, venue/address details, directions
  links, and the feed accepts ranges up to 366 days and an optional exact
  `category` filter.
- Public iCalendar subscription at `/_emdash/api/plugins/eventual/calendar`.
  It expands published series into stable, dated event entries and retains
  cancellation tombstones when a published occurrence is removed.

The sandboxed plugin returns event data; it does not render a visitor calendar.
To attach an image, upload it from EmDash Media first, then find it by filename
in the event form. An Astro site can build its own list or month view by
consuming the public route.

This MVP focuses on reliable event management and public event feeds. Bulk
CSV/iCalendar imports and MCP event-management tools are not included.

Event dates use EmDash's date picker and each event has a searchable IANA
timezone selector. For timed events, enter the local clock time as `18:30` or
`6:30 PM`; Eventual normalizes either form before applying the selected
timezone. Block Kit currently has a date input but no dedicated time input, so
clock times remain text fields. Nonexistent local times during a
daylight-saving transition are rejected. Saved event forms show a schedule
preview with local start/end values and the selected timezone; all-day previews
identify the end date as inclusive.

## License

Eventual is licensed under the MIT License. See [LICENSE](./LICENSE).

## Public events API

The public `GET` route is mounted at
`/_emdash/api/plugins/eventual/publicEvents`. EmDash wraps the plugin result in
`{ "success": true, "data": ... }`. The `data` value has this shape:

```json
{
  "ok": true,
  "from": "2026-10-01",
  "through": "2026-10-31",
  "events": [
    {
      "id": "event-id",
      "updatedAt": "2026-10-01T10:20:30.000Z",
      "title": "Community meetup",
      "description": "",
      "start": "2026-10-10T16:00:00.000Z",
      "end": "2026-10-10T17:00:00.000Z",
      "allDay": false,
      "timezone": "Europe/Amsterdam",
      "location": "Community Hall",
      "organizer": "",
      "externalUrl": "",
      "imageUrl": "",
      "categories": ["community"],
      "venue": null,
      "directionsUrl": "https://www.google.com/maps/dir/?api=1&destination=Community+Hall"
    }
  ]
}
```

Timed `start` and `end` values are ISO instants; use `timezone` when showing
their local wall time. All-day values are inclusive date-only strings. A
recurring series is expanded into individual occurrences in the requested
range, with cancelled occurrences omitted and modified occurrences represented
by their overrides. Only published events are returned. A saved venue is
`null` when the event has no assigned venue. `directionsUrl` is included when
the event has a location; it works without a Google Maps API key.

`updatedAt` is the source event's last update timestamp. Occurrences expanded
from one series share the series timestamp.

`imageUrl` contains an externally hosted URL when one is configured, or a
same-origin Eventual image route for media-library selections. That public
route serves only images referenced by published events and supports JPEG,
PNG, GIF, WebP, and AVIF files up to 8 MiB.

Query parameters:

- `from`: inclusive `YYYY-MM-DD` start; defaults to today.
- `through`: inclusive `YYYY-MM-DD` end; defaults to 180 days after `from`.
- `category`: optional exact category match, case-insensitive.

Category labels are free-form and normalized when saved: surrounding spaces
are removed, repeated whitespace is collapsed, and duplicates are removed
case-insensitively while preserving the first label's casing for display.
Category filters apply the same spacing and case normalization. Existing stored
events need no migration; public responses normalize their labels when read.

### Public API errors and example

The inclusive range may contain at most 366 dates. Expected application errors
are returned under `data` as `{ "ok": false, "error": "..." }`; they still
arrive in EmDash's successful HTTP JSON envelope. For example:

```js
const url = new URL("/_emdash/api/plugins/eventual/publicEvents", window.location.origin);
url.searchParams.set("from", "2026-10-01");
url.searchParams.set("through", "2026-10-31");
url.searchParams.set("category", "community"); // optional

const response = await fetch(url);
if (!response.ok) throw new Error(`Event feed request failed (${response.status})`);
const { success, data } = await response.json();
if (!success || !data.ok) throw new Error(data.error ?? "Could not load events");

const list = document.querySelector("#events");
if (!list) throw new Error("Add an element with id=events to the page");
for (const event of data.events) {
  const when = event.allDay
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" })
        .format(new Date(`${event.start}T00:00:00Z`))
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: event.timezone,
      }).format(new Date(event.start));
  const item = document.createElement("li");
  item.textContent = `${event.title} — ${when}`;
  list.append(item);
}
```

### Calendar subscription

Add `/_emdash/api/plugins/eventual/calendar` to a calendar application that
supports iCalendar subscriptions. This is a raw `text/calendar` feed served by
the sandboxed plugin's documented raw-response route. It contains published
occurrences from today through the next 365 days (366 dates total), expanded
with Eventual's timezone and exception rules. It refreshes from EmDash on each
request; the route allows a five-minute cache. The feed expands occurrences
into individual entries rather than exporting RRULEs, so an event's local clock
time stays aligned through daylight-saving changes. Timed entries use UTC
instants and retain their source timezone in `X-EVENTUAL-TIMEZONE`; all-day
entries use date values and an exclusive iCalendar end date.

Each occurrence UID is stable for the event and its original scheduled date and
time. Editing an occurrence updates its revision; unpublishing, deleting, or
changing a schedule writes a minimal `STATUS:CANCELLED` tombstone for published
occurrences in the current subscription horizon. Tombstones are kept in
plugin-owned storage and returned with the feed so calendar clients can remove
entries they previously imported. Cancellation records contain no event title,
description, location, or URL. Re-publishing an occurrence removes its matching
tombstone. A changed recurring series is represented by the current occurrences
plus cancellations for old occurrence UIDs that no longer exist.

The feed has no date query parameters so its subscription URL stays fixed. Its
one-year rolling window means that future events farther than 365 days away are
not advertised until they enter the window. An Astro site's single-event `.ics`
download remains available separately and supports a specific event URL.

This browser-side example assumes the Astro page and EmDash API are served from
the same origin. The site owns the rendered UI and its loading, error, empty,
accessibility, and responsive states. EmDash's [sandboxed API route contract](https://docs.emdashcms.com/plugins/creating-plugins/api-routes/)
documents the route path and response envelope.

### Astro event browser example

[`examples/astro-events/`](examples/astro-events/) is a runnable Astro site
integration. It provides a custom event list and responsive locale-aware month
view, month navigation, category filter, busy-day disclosures, error/empty
states, keyboard-accessible controls, shareable event detail pages, and a
single-event iCalendar download. It uses
ordinary Astro code in the consuming site; it is not shipped as part of the
sandboxed plugin and does not add pages to EmDash.

Follow [`examples/astro-events/README.md`](examples/astro-events/README.md) to
run or adapt it. The example uses Astro's Node standalone adapter and requests
the public feed on each server-rendered page view, with `cache: "no-store"`.
Set `EVENTUAL_API_ORIGIN` to the EmDash site origin if the Astro server does not
share the CMS origin. The public route must be reachable from the Astro server
without a login; no browser CORS setup or credentials are needed. Static-only
output otherwise snapshots feed data at build time. See Astro's
[on-demand rendering guide](https://docs.astro.build/en/guides/on-demand-rendering/)
and [data fetching guide](https://docs.astro.build/en/guides/data-fetching/).

The example requests the selected month from the API and pads the visual month
grid to 35 or 42 dates according to the locale. The API allows up to 366
inclusive dates and expands recurrence into occurrences, omitting
cancelled instances and applying modified-instance overrides. The example
keeps labels centralized for localization, uses the occurrence's own IANA
timezone for timed display, and treats all-day end dates as inclusive. It
intentionally does not add FullCalendar.

The integration's `/events/{occurrence-id}` pages and `.ics` downloads are
implemented in the Astro site layer. Timed export values retain the occurrence
instants in UTC and include the event's IANA timezone metadata; inclusive
all-day ends are converted to iCalendar's exclusive end date. These are
single-event downloads. For ongoing calendar sync, use the plugin's separate
`/_emdash/api/plugins/eventual/calendar` subscription feed. That feed preserves
stable occurrence IDs and emits cancellation tombstones when published events
are unpublished, deleted, or rescheduled. See the
[subscription details](#calendar-subscription) and
[`examples/astro-events/README.md`](examples/astro-events/README.md).

## Develop

```sh
npm install
npm run validate
npm run typecheck
npm run test
npm run build
```

To test against a running EmDash site, run `npm run dev` in this
directory (rebuilds on save) and `npm install file:../path/to/this`
in the site. Then `import eventual from "eventual"` and pass
it into `emdash({ sandboxed: [eventual] })`.

`npm run test` builds the plugin and runs its tests through Worker Loader using
EmDash's production sandbox wrapper and host bridge.

## Publish

```sh
npm run login -- alice.example.com
npm run publish          # builds and uploads artifacts to your PDS
```

To publish from GitHub Actions, run `npm run release:setup`. The command
creates one shared workflow at the Git repository root.

## Version bumps

Bump `version` in `package.json` when you ship a release. The
scaffold's `emdash-plugin.jsonc` deliberately omits `version` —
the build pipeline reads it from `package.json` so there's a single
source of truth. **Bump major** for breaking changes, **bump minor**
for new routes or hooks, **bump patch** for fixes.

You MUST bump version whenever you change `capabilities`, `allowedHosts`,
or `storage` in the manifest. Installed users have consented to the
old trust contract; a change without a version bump would let new
behaviour slip past consent.
