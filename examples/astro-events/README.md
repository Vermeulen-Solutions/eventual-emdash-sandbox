# Astro visitor showcase

<p align="center">
  <img src="../../images/registry-0.11.0/05-public-events.jpg" alt="Astro event browser with seven views" width="90%" />
</p>

This optional, site-owned example renders Eventual feeds. It supplies list, timeline, cards, daily schedule, date strip, month and location views (`/events?view=month`), plus event details, JSON-LD and calendar actions. Navigation, filters and disclosures use HTML rather than client JavaScript.

<p align="center">
  <img src="../../images/registry-0.13.4/public-event-detail-fr-desktop.png" alt="Event details with calendar actions" width="90%" />
</p>

## Run it

Use Node 24+ and a reachable EmDash site with published Eventual events. Build the parent plugin first; the example depends on `file:../..`.

```sh
# From the repository root:
npm ci
npm run build
cd examples/astro-events
npm ci
cp .env.example .env
npm run dev
```

In PowerShell, use `Copy-Item .env.example .env`. Edit the environment values:

```env
EVENTUAL_API_ORIGIN=http://127.0.0.1:4322
EVENTUAL_LOCALE=fr
EVENTUAL_DISPLAY_TIMEZONE=Europe/Paris
```

Open the URL Astro prints; its default port is 4321 and `/` redirects to `/events`.

## Integration assumptions

The feed helper and subscription links currently use plugin ID **eventual**. Registry installations have generated IDs and need an adapter: see the [developer guide](../../docs/native-modernization.md#astro-integration). A remote API origin must be reachable by the SSR server; subscription links must also be reachable by visitors' calendar apps.

EVENTUAL_LOCALE controls interface labels, date formatting and week layout (English, Dutch and French labels). The current example requests do **not** pass locale/strict to the feed. To select translated event content, add those options to each fetchPublicFeed call. Display time zone does not rewrite stored event schedules.

Every request fetches the feed; host caching may still apply. The browser shows an unavailable state with HTTP 502 when fetching fails, rather than substituting stale rows. There are no RSVP/registration workflows in this example.

## Checks

```sh
npm run check
npm test
npm run test:page
npm run build
npm run preview
```

For editing and installation, use the [main README](../../README.md); this showcase is optional website code.
