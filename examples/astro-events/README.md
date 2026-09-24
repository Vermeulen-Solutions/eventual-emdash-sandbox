# Eventual Astro event browser

This is a site-owned Astro example for a sandboxed Eventual installation. It
renders a public event list and a responsive month view from Eventual's JSON
route. Event titles link to site-owned detail pages, which include a
single-event iCalendar download. The EmDash plugin itself stores and returns
data; it does not add visitor pages or a calendar to an Astro site.

## Run it locally

Requirements: Node.js 22.12 or newer. This example uses the npm package manager.

```sh
npm install
cp .env.example .env
npm run dev
```

On PowerShell, use `Copy-Item .env.example .env` instead of `cp`. Set
`EVENTUAL_API_ORIGIN` in `.env` to the origin of the EmDash site that has
Eventual installed, for example `http://127.0.0.1:4322`. Keep the URL's scheme,
host, and port only; the example adds the public API path. The route must be
reachable without an EmDash login. It is a public read-only route, so the
Astro server does not forward cookies or credentials.

The example is SSR rendered with Astro's Node standalone adapter, so changes
made in EmDash appear on the next page request without rebuilding the site.
Deploy the generated `dist/server/entry.mjs` with Node or use the adapter's
standalone output. Static-only hosting requires a separately designed fetch
strategy and may otherwise freeze the feed at build time.

`EVENTUAL_LOCALE` controls visitor-facing labels, date formatting, and the
calendar week start. English, Dutch, and French labels are included; other
locales use English text while retaining locale-sensitive date and week
formatting. `EVENTUAL_DISPLAY_TIMEZONE` selects which timezone determines the
default current month. Each timed event still displays in the event's own IANA
timezone.

## Interaction and accessibility

- The API is queried for the exact selected month. The visual grid pads that
  range with adjacent dates to make complete locale-aligned weeks.
- List and month views, month navigation, retry, and category filtering work
  as ordinary links and GET forms without browser JavaScript.
- The category filter accepts a free-form label for categories not present in
  the current month; browser suggestions show labels used by the visible month.
- On wide screens the month view is a locale-aligned week grid. On narrow
  screens it becomes a chronological day agenda.
- Each date's native disclosure shows every event on that day; busy dates do
  not clip events. Its accessible name includes the date and event count. The
  full list view always exposes all event details.
- Native links and disclosures are keyboard operable, focus is visible, the
  localized skip link moves focus to the page's main content, the page has
  landmarks, headings and time elements are semantic, and errors/empty states
  are announced. The server renders complete pages, so
  the browser uses its regular document-loading indicator rather than a
  client-side loading panel.
- All-day end dates are inclusive. Timed start/end instants are formatted in
  the event's named timezone. Multi-day occurrences appear on each local date
  they span.
- Event detail pages are served at `/events/{occurrence-id}`. Their `from` and
  `through` query values identify the occurrence's own local date range, so a
  shared link resolves to the same occurrence in a series.
- The `.ics` download uses a stable occurrence ID, UTC instants for timed
  events, and an exclusive end date for inclusive all-day events. It records
  the event's IANA timezone in an `X-EVENTUAL-TIMEZONE` calendar property.
  `LAST-MODIFIED` and `SEQUENCE` are based on the source event's `updatedAt`,
  so a refreshed download keeps the same UID and carries a newer revision.
  This is a download, not a live subscription. The separate plugin-owned
  iCalendar subscription feed carries cancellation tombstones for published
  event occurrences.
- The event description is rendered as text. External event/directions links
  accept HTTP(S) only. External images must use HTTPS; relative EmDash media
  links use the configured CMS origin. Eventual supplies directions links but
  does not provide map embeds.

Text labels live in `src/lib/messages.ts` so a site can add translations without
editing layout code. The example does not use FullCalendar.

## Commands

```sh
npm run check
npm test
npm run build
```

`npm run check` runs Astro's diagnostics and TypeScript checks, `npm test` runs
focused route-adapter, calendar, detail-link, date-range, and iCalendar tests,
and `npm run build` verifies the SSR site output. The plugin package has its
own validation and test commands in the repository root.
