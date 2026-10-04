# eventual

A general-purpose, sandboxed events plugin for [EmDash CMS](https://emdashcms.com).

Version 0.11.0 requires EmDash 1.0.1 or newer. The minimum is declared in both
the npm peer dependency and the plugin release requirements.

## Features

- Block Kit admin pages for events, saved venues, and settings.
- Settings include a default 24-hour admin time display, with an option to use
  12-hour times instead. This affects Eventual's EmDash admin displays only;
  public feeds and the consuming site's frontend are unchanged.
- Paged Block Kit tables for event and venue lists. Event rows support editing,
  clickable title editing, duplication, and confirmed deletion; the event list can select up to 25
  events on the current page for one confirmed bulk deletion. Saving an event
  returns to the primary Events list.
- The Events page can filter by publication status and by upcoming or past start
  dates. Filters work with server-side pagination.
- Event and venue edits detect changes made by another editor while a form is
  open. The newer version is reloaded so it can be reviewed before editing again.
- Event list duplication starts a clearly marked unpublished draft, carrying
  event fields, dates, and recurrence forward while clearing occurrence
  exceptions for review before saving.
- Timed and inclusive all-day events with an IANA timezone, one-off location,
  organizer, links, image-library selection (with an optional external image
  URL fallback), categories, and publication state.
- Daily, weekly, and monthly recurrence with intervals from 1 through 52;
  weekly series can select multiple weekdays. Cancellation and modified-instance
  exceptions keep individual dates independent. One-off events stay non-recurring.
- The saved event editor shows a timezone-aware schedule summary and up to
  three sample dates for a recurring series.
- Select **Manage occurrence dates** in a saved recurring event to see ten
  occurrences at a time in a 90-day window, including cancellations and moved
  dates. Change, Cancel, and Restore
  actions select the exact original occurrence; editors can choose another
  window or enter an exception manually.
- A compact EmDash dashboard widget lists the next published events with local
  date/time, venue or location, an empty state, and a link to the Events page.
- The [Astro frontend example](./examples/astro-events/README.md) offers compact list, timeline,
  card grid, daily schedule, date strip, month calendar, and location views.
  It also includes event detail pages and individual iCalendar downloads. It
  stays in the consuming site and adds nothing to the sandbox backend bundle.
- MCP tools let authorized agents manage event series, publication, occurrence
  exceptions, saved venues, and the default timezone.
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
- Settings show the public JSON and iCalendar feed paths and link to the Astro
  integration example for adding visitor pages.

Public feeds and the dashboard select published events whose start is no later
than the requested window, retaining older recurring series. Event scans stop
with an explicit error if more than 10,000 records match; they never return a
silently truncated feed. Narrowing the visible date range cannot eliminate the
limit when more than 10,000 older recurring or historical records qualify.

## Reuse the Astro feed client

The source package exports `eventual/astro` with `fetchPublicFeed`, `FeedError`,
and the public event types. It also exports an unstyled
`eventual/astro/EventList.astro` component. Install this source checkout as a
local dependency in an Astro site, then import those entry points. See the
[`simple-list.astro` example](./examples/astro-events/src/pages/simple-list.astro).
The richer seven-view example also uses the shared feed client.

Registry installation installs the sandbox plugin in EmDash. The Astro files
must be added to the site separately; the registry does not install site source.

The sandboxed plugin returns event data; it does not render a visitor calendar.
To attach an image, upload it from EmDash Media first, then find it by filename
in the event form. An Astro site can build its own visitor views by consuming
the public route.

The plugin manages events and returns public feed data; the visitor calendar
remains in the consuming Astro site. Bulk CSV/iCalendar imports are not
included.

Event dates use EmDash's date picker and each event has a searchable IANA
timezone selector. For timed events, enter the local clock time as `18:30` or
`6:30 PM`; Eventual normalizes either form before applying the selected
timezone. Block Kit currently has a date input but no dedicated time input, so
clock times remain text fields. Nonexistent local times during a
daylight-saving transition are rejected. Saved event forms show a schedule
preview with local start/end values and the selected timezone; all-day previews
identify the end date as inclusive.

The Settings page defaults admin time displays to 24-hour time and can switch
them to 12-hour time. This preference is used by Eventual's admin event list
and dashboard widget. It does not change stored event values, public JSON or
iCalendar feeds, MCP responses, or any frontend code in the consuming site.

Descriptions are edited directly in the main event form as one multiline field.
Plain text works without any formatting knowledge. Editors who need formatting
can use lightweight Markdown: `**bold**`, `_italic_`, `## Heading`, `- list item`,
and `[link text](https://example.com)`. Blank lines separate paragraphs.

Eventual stores the description source unchanged and returns it through MCP and
the public JSON route. The visitor-facing Astro site decides how to render it;
render Markdown with raw HTML disabled and safe link handling. Existing imported
HTML is preserved unless an editor replaces it. The form identifies those legacy
descriptions so editors do not mistake HTML tags for the recommended format.

## License

Eventual is licensed under the MIT License. See [LICENSE](./LICENSE).

## MCP tools

The plugin exposes 22 MCP tools under the `eventual__` namespace: list and get
events; create, update, publish, unpublish, and delete events; set or remove a
recurrence occurrence exception; list, create, update, and delete saved venues;
inspect saved occurrences; read or update the default timezone; list, create and
update organizers; and preview, import and export transfer records. Create starts with an unpublished
event. Deletion preserves calendar cancellation tombstones, assigned venues
cannot be removed, and schedule edits that orphan saved exceptions are
rejected. Timed MCP values use local `YYYY-MM-DDTHH:mm` wall times with an IANA
timezone.

All MCP routes require the `plugins:manage` permission. An administrator must
enable the desired tools in the EmDash MCP settings before agents can call
them. Read tools are marked non-destructive; changes and exception operations
are marked destructive for host approval handling.

If your site is upgrading from 0.7.0, enable `eventual__listOccurrences` in
EmDash MCP settings to make the read-only tool available to agents. It accepts an event
`id`, optional `from`/`through` dates, and `limit` (1–100, default 50). It includes
drafts and cancelled dates. The default window starts today in UTC and contains
90 inclusive dates; the maximum requested range is 366 inclusive dates.
Results include `recurrenceId`, original and effective local start/end values,
timezone, state (`scheduled`, `cancelled`, or `modified`), `total`, and
`truncated`. One-off events have a null `recurrenceId`. Use the returned original
ID with the existing exception tools; limit or narrow the date range when
`truncated` is true. Moved occurrences are selected by their effective dates.

### Recurrence options

Recurrence keeps an inclusive `until` date. The optional `interval` is an
integer from 1 through 52; omission means 1. Weekly recurrence can also contain
a nonempty, unique `weekdays` array using lowercase weekday names. For example:

```json
{
  "frequency": "weekly",
  "interval": 2,
  "weekdays": ["tuesday", "thursday"],
  "until": "2026-12-31"
}
```

Weeks start Monday. The first event anchors its containing week and must fall
on a selected weekday. Without `weekdays`, weekly events keep the first event's
weekday. In the admin, leaving the weekday boxes empty selects that default.
Daily intervals use local calendar dates; monthly intervals count calendar
months from the first event. Local start time stays fixed through DST, and
nonexistent local occurrences are skipped. Existing monthly skip/last-day and
weekday-position policies still apply. The monthly day is retained when editing
through admin or MCP, including a series starting on February's last day with
a day-of-month rule of 31. Schedule edits that orphan exceptions are rejected;
remove or revise those exceptions before changing the rule.

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
      "description": "Join us for a **community meetup**.\n\n- Everyone is welcome\n- No registration required",
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

`description` contains the saved description source. New descriptions use plain
text or Markdown. Existing imported events may still contain HTML until they are
converted by an editor, so consuming sites should select their rendering path
deliberately and sanitize any rendered markup.

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
integration. It provides seven responsive views: a compact date-block list,
visual timeline, image card grid, collapsible daily schedule, horizontal date
strip, locale-aware month calendar, and events grouped by location. The views
share month navigation, category filtering, safe lightweight Markdown rendering,
error and empty states, keyboard-accessible controls, shareable event detail
pages, and a single-event iCalendar download. It uses
ordinary Astro code in the consuming site; it is not shipped as part of the
sandboxed plugin, does not add pages to EmDash, and does not count toward the
registry's backend or package size limits.

Follow [`examples/astro-events/README.md`](examples/astro-events/README.md) to
run or adapt it. The example uses Astro's Node standalone adapter and requests
the public feed on each server-rendered page view, with `cache: "no-store"`.
Set `EVENTUAL_API_ORIGIN` to the EmDash site origin if the Astro server does not
share the CMS origin. The public route must be reachable from the Astro server
without a login; no browser CORS setup or credentials are needed. Static-only
output otherwise snapshots feed data at build time. See Astro's
[on-demand rendering guide](https://docs.astro.build/en/guides/on-demand-rendering/)
and [data fetching guide](https://docs.astro.build/en/guides/data-fetching/).

The example requests the selected month from the API. Its month view also
requests the adjacent dates needed to pad the grid to 35 or 42 locale-aligned
dates, so events in those visible cells remain accurate. The API allows up to 366
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

## Event format, publication, and structured data

`locationType` is `physical`, `virtual`, or `hybrid`; meeting URLs must use HTTP
or HTTPS. Hybrid JSON-LD includes both available physical and virtual locations.
Calendar exports retain the meeting URL even when no physical location is set.

`published` controls public visibility. Unpublished saves use status `draft`.
Publishing a draft changes its status to `published`; publishing an already
cancelled, postponed, or rescheduled event preserves that lifecycle state.
Unpublishing resets status to `draft`, including when the event is later
republished. Status-only MCP updates do not publish an event.
Occurrence overrides support event format, meeting URL, and lifecycle status;
unpublished occurrences are drafts regardless of their stored overrides.
Calendar status is CANCELLED for cancelled events, TENTATIVE for postponed
events, and CONFIRMED for scheduled or rescheduled events. Rescheduled means
that the supplied dates are the confirmed replacement schedule.

Import `eventToJsonLd` and `serializeJsonLd` from `eventual/astro` or
`eventual/astro/schema`. Pass `{ siteUrl: "https://example.com" }` to resolve
relative image, event, and meeting URLs; unsafe or unresolvable URLs are omitted.
Use `serializeJsonLd(eventToJsonLd(event, options))` when embedding the result
in an HTML script element. It escapes `<` without changing parsed JSON values.
Schedule edits retain up to ten previous series schedules. Rescheduled events
expose `previousStartDate`; moved recurring occurrences use their original start.
Duplicates start without history. Full-series shifts do not infer a previous
date for each new occurrence.

Saved venues now expose optional `addressParts` alongside the existing formatted
address. JSON-LD maps each address component to PostalAddress and keeps legacy
formatted addresses as text. Saved organizers are optional: choose one in the
admin form or MCP, or continue using free text. Their names, website and contact
links are public. Clearing `organizerId` returns to the free text fallback.

JSON export/restore, CSV conversion, limited ICS conversion and draft-first,
atomic imports are documented in [data transfer](docs/data-transfer.md).
Host-side helpers are exported as `eventual/transfer` and add no parser to the
sandbox runtime. Deferred work is recorded in [tracked future work](docs/future-work.md).

CI checks locked dependencies, plugin types/tests, the actual installation archive,
and the Astro example including its built event page, under UTC and America/New_York.
Run `npm run bundle && npm run budget` to check working ceilings of 110 KiB per
file, 220 KiB total and 16 files, below the hard 128 KiB/256 KiB/20 limits.
`npm run test:tooling` covers host parsers and budget measurements. Performance
tests enforce batched reference lookups; `npm run profile` writes diagnostic call
counts, UTF-8 payload sizes and elapsed times to `reports/`. These mock timings are not a
measurement of production sandbox CPU.
