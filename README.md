# Eventual

Eventual is a domain companion plugin for [EmDash CMS](https://emdashcms.com). It pairs with native EmDash event collections to provide recurrence expansion, schedule validation, multilingual public feeds, RFC 5545 iCalendar feeds, and Astro frontend helpers.

Starting with **v0.12.0**, Eventual transitions from plugin-isolated storage to **native EmDash collections**, enabling row-per-locale translations, native drafts, revisions, scheduled publishing, and Portable Text descriptions.

---

## Key Features

- **Native Multilingual Collections:** Leverages EmDash core collections (`events`, `venues` or `locations`) with row-per-locale translation siblings and automatic synchronization of shared schedule invariants (`translatable: false`).
- **Recurrence & Occurrences:** Daily, weekly, monthly, and yearly recurrence rules with schedule exceptions (moved, cancelled, or rescheduled occurrences) and per-locale editorial overrides (`occurrence_content`).
- **Portable Text & Rich Text:** Full Portable Text support for event descriptions and occurrence-level notes, with backward-compatible conversion from legacy Markdown.
- **Multilingual Public Feeds:** High-performance JSON feed (`publicEvents`) and iCalendar subscription (`calendar`) with locale filtering (`locale=fr`), fallback titles for untranslated events, and strict locale modes.
- **RFC 5545 Compliant iCalendar:** Rolling 365-day calendar feeds with inclusive-to-exclusive all-day date handling, logical monotonic `SEQUENCE` tracking, and `STATUS:CANCELLED` tombstones.
- **Astro Component Suite:** Lightweight helpers and zero-client-JS Astro components (`eventual/astro`) with seven responsive visitor views (calendar, list, grid, timeline, daily schedule, date strip, locations).
- **Resumable Migration Tooling:** Built-in `migrateToNative` MCP tool and API endpoint for non-destructive, batch-wise migration from legacy plugin storage with dry-run previews and lease-based locking.
- **Agent Ready (MCP):** Rich Model Context Protocol tools for AI agent interaction, administration, and migrations.

---

## Architecture & Native Collections

Eventual relies on EmDash **1.0.1+** native collections. The plugin does not maintain an isolated custom editor for event content; instead, it provides schema blueprints, invariant hooks, and a companion admin dashboard that links directly to EmDash's core collection editor.

### Invariant Schedule Synchronization

In native multilingual mode:
- **Translatable fields (per-locale):** Title, Portable Text description, excerpt, localized location copy, and `occurrence_content`.
- **Shared invariant fields (synchronized across languages):** Schedule (`start`, `end`, `all_day`, `timezone`), recurrence pattern, shared schedule `exceptions`, venue reference, event lifecycle status, categories, images, and migration identity.
- **Lifecycle & Publishing:** EmDash core publication status controls visibility. The `event_status` field separately tracks cancellation, postponement, or rescheduling.
- **All-day Civil Dates:** All-day events store inclusive ISO civil dates (`YYYY-MM-DD`). In iCalendar feeds, end dates are automatically converted to RFC 5545 exclusive `DTEND` dates.

For full schema details and operational guidelines, see the [Native Modernization Guide](./docs/native-modernization.md).

---

## Installation & Setup

### 1. Install via Plugin Registry

Install Eventual from the **EmDash Admin → Plugins** marketplace, or install using the CLI:

```sh
npx emdash-plugin install @vermeulen.solutions/eventual
```

### 2. Apply Collection Blueprints

Eventual exports typed collection blueprints to seed the required EmDash collections. In your site setup or migration script:

```ts
import {
  createEventsCollectionBlueprint,
  createVenuesCollectionBlueprint,
} from 'eventual/schema';

// Creates the "events" collection schema
const eventsCollection = createEventsCollectionBlueprint({
  venueCollection: 'venues', // or "locations"
});

// Creates the "venues" collection schema
const venuesCollection = createVenuesCollectionBlueprint();
```

See [Registry Installation Guide](./docs/registry-installation.md) for step-by-step instructions.

---

## Migrating from Legacy Storage

Sites upgrading from earlier Eventual releases (`< 0.12.0`) can migrate existing events, venues, and organizers non-destructively:

1. **Dry-Run Preview:** Inspect payloads, counts, and potential warnings with zero database writes:
   ```json
   {
     "dryRun": true,
     "limit": 50,
     "defaultLocale": "en"
   }
   ```
2. **Batch Execution:** Run migration batches using `limit` and the returned `nextCursor`.
3. **Safety Guarantees:**
   - Legacy records are **never deleted or overwritten**.
   - Unique indexed `legacy_id` fields and durable recovery tokens prevent duplicate imports.
   - Published legacy events are published in the native collection; drafts remain drafts.
   - Markdown descriptions are deterministically converted to Portable Text with raw text preserved in `legacy_metadata`.

Run migration via the `migrateToNative` MCP tool or `POST /_emdash/api/plugins/eventual/mcp/transfer/migrateToNative`.

> [!NOTE]
> Once the native `events` collection exists in your site, Eventual activates **Single Native Authority**: public feeds and calendar routes query native collections exclusively, and legacy CRUD operations return `NATIVE_COLLECTIONS_ACTIVE`.

---

## Public APIs

### 1. Public Events JSON Route

```http
GET /_emdash/api/plugins/eventual/publicEvents?from=2026-11-01&through=2026-11-30&locale=fr&strict=false&category=Music
```

#### Query Parameters

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `from` | string | Today | Inclusive start date (`YYYY-MM-DD`). Max range is 366 days. |
| `through` | string | `from` + 180d | Inclusive end date (`YYYY-MM-DD`). |
| `locale` | string | Site default | Target locale code (e.g., `fr`, `en-US`). |
| `strict` | boolean | `false` | When `true`, omits events lacking a translation in the requested locale. When `false`, falls back to available sibling with prefix (e.g. `[EN]`). |
| `category` | string | None | Case-insensitive category filter. |

#### Response Format

```json
{
  "success": true,
  "data": {
    "ok": true,
    "from": "2026-11-01",
    "through": "2026-11-30",
    "locale": "fr",
    "events": [
      {
        "id": "event-123",
        "title": "Conférence annuelle",
        "description": [...],
        "start": "2026-11-15T09:00:00.000Z",
        "end": "2026-11-15T17:00:00.000Z",
        "allDay": false,
        "timezone": "Europe/Paris",
        "location": "Salle Principale",
        "locationType": "physical",
        "status": "published",
        "eventStatus": "scheduled",
        "venue": {
          "id": "venue-1",
          "name": "Salle Principale",
          "address": "12 Rue de Rivoli, Paris"
        }
      }
    ]
  }
}
```

### 2. Public iCalendar Subscription

```http
GET /_emdash/api/plugins/eventual/calendar?locale=fr&strict=true&category=Music
```

- **RFC 5545 Compliant:** Serves valid `text/calendar` over a rolling 365-day window.
- **Multilingual Support:** Subscribes to events in the specified locale.
- **Monotonic SEQUENCE Tracking:** Emits increasing integer sequence numbers when published schedules change.
- **Cancellation Tombstones:** Retains `STATUS:CANCELLED` records for 366 days to ensure subscriber calendars remove cancelled or unpublished events.

---

## Astro Integration

Install the package alongside your Astro site:

```sh
npm install eventual
```

### Querying Feeds & Rendering Events

```astro
---
// src/pages/events.astro
import { fetchPublicFeed } from "eventual/astro";
import EventList from "eventual/astro/EventList.astro";

const { events } = await fetchPublicFeed(
  "https://your-site.example",
  "2026-11-01",
  "2026-11-30",
  undefined,
  { locale: "fr", strict: false }
);
---

<html>
  <head>
    <title>Événements à venir</title>
  </head>
  <body>
    <h1>Événements</h1>
    <EventList events={events} locale="fr" emptyMessage="Aucun événement prévu." />
  </body>
</html>
```

The package also exports `expandEventOccurrences` and JSON-LD structured data generators. See the runnable [Astro Visitor Example](./examples/astro-events/README.md) for seven complete presentation templates.

---

## AI & MCP Agent Tools

Eventual registers Model Context Protocol (MCP) tools for AI agent automation (requires `plugins:manage` permission):

- **Migration & Transfer:**
  - `migrateToNative`: Resumable, dry-run-capable migration of legacy events, venues, and organizers into native EmDash collections.
  - `exportRecords`: Paginated backup export of legacy data.
  - `previewImport` & `importRecords`: Insert-only legacy data restore tools.
- **Settings:**
  - `getDefaultTimezone` / `updateDefaultTimezone`: Manage legacy fallback timezone settings.
- **Legacy Compatibility Mode:**
  - When native collections are **not** installed, legacy CRUD tools (`listEvents`, `createEvent`, `updateEvent`, `publishEvent`, `deleteEvent`, `listVenues`, etc.) remain active.
  - Once native collections are installed, legacy write tools safely guard against accidental split-brain storage by returning `NATIVE_COLLECTIONS_ACTIVE`.

---

## Capabilities & Trust Contract

Eventual requests minimal capabilities within the EmDash sandbox:

- `content:read`, `content:write`, `content:publish`, `content:revisions:read`: Required for native collection reading, validation, publication, and migration.
- `schema:read`: Detects active collection schemas (`events`, `venues`/`locations`).
- `hooks.content-policy:register`: Synchronizes invariant schedule fields across translation siblings and validates dates before save.
- `media:read`, `media:bytes:read`: Displays cover images and serves legacy media assets.
- `allowedHosts: []`: **Zero outbound network access**; all data remains strictly on your host.

Administration requires `content:edit_any` for the companion dashboard and `plugins:manage` for MCP tools and migration.

---

## Development & Testing

```sh
npm install            # Install dependencies
npm run validate       # Validate plugin manifest and schema contracts
npm run typecheck      # Type check TypeScript source
npm test               # Run Vitest test suite
npm run test:tooling   # Run migration, AST, and helper tests
npm run bundle         # Build distribution bundle
npm run budget         # Verify bundle size constraints
npm run test:package   # Run integration tests against packed tarball
```

---

## Documentation

- [Native Modernization Guide](./docs/native-modernization.md) — Comprehensive schema, invariant sync, and migration documentation.
- [Registry Installation Guide](./docs/registry-installation.md) — Plugin marketplace installation and initial setup.
- [Registry Changelog](./docs/registry-changelog.md) — Public changelog for registry releases.
- [Release Notes 0.12.0](./docs/release-notes-0.12.0.md) — Detailed 0.12.0 release overview and migration advisory.
- [Astro Visitor Example](./examples/astro-events/README.md) — 7-view zero-JS visitor showcase.

---

## License

Licensed under the [MIT License](./LICENSE).
