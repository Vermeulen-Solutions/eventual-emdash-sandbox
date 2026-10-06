# Eventual

Eventual is a sandboxed domain companion for native EmDash event collections. It provides schedule validation, recurrence expansion, multilingual JSON/iCalendar feeds, Astro helpers and resumable migration from Eventual's original plugin storage.

The local **0.12.0** modernization requires EmDash **1.0.1+**. It replaces the custom event editor with links to EmDash's collection editor. Drafts, revisions, scheduled publication, media selection and per-locale editing belong to core. Installation does not automatically create collections or migrate data.

## Native collections

Import `createEventsCollectionBlueprint` and `createVenuesCollectionBlueprint` from `eventual/schema`. They produce typed EmDash seed collections with supported select validation and scheduling. Pass `{ venueCollection: "locations" }` to reference existing locations.

- Title, Portable Text description, excerpt, location/organizer copy and occurrence_content are translatable.
- Schedule, venue reference, event lifecycle, categories, images and migration identity are shared. Core slugs remain per-locale metadata.
- Timed events use ISO start/end instants and an IANA timezone. All-day events use inclusive Gregorian start_date/end_date civil dates.
- Core publication status controls visibility; event_status separately describes cancellation, postponement or rescheduling.
- Shared exceptions contain schedule overrides. Localized occurrence_content contains editorial overrides.

Core synchronizes published shared fields. Pending revisions can differ from live values; secondary-locale editors can change schedules under normal core permissions. See [native setup and migration](./docs/native-modernization.md) for schema application and the complete contract.

## Migration and compatibility

The administrator-only MCP tool `migrateToNative` is also registered at `mcp/transfer/migrateToNative`. Preview with dryRun, then execute bounded batches using limit and returned nextCursor. Locale defaults to fr; the venue target follows the installed reference.

Migration never deletes or overwrites legacy records. Generated native IDs, unique indexed legacy_id fields and durable recovery tokens protect retries. Published source events/venues are explicitly published; drafts stay drafts. Completed items deliberately unpublished by editors stay unpublished; removed migrated items require explicit restoration.

Preview reports payloads and dependency errors, with honest warnings about server-generated IDs and other plugins' policies. Planned venue references are placeholders. Common Markdown becomes deterministic Portable Text; original descriptions and exceptions remain in legacy_metadata for recovery.

An installed events collection is authoritative even when empty. JSON and calendar feeds then use native content exclusively. Legacy event/venue/organizer MCP operations and imports return NATIVE_COLLECTIONS_ACTIVE; use EmDash content tools. Export and settings remain available. Without a native events schema, legacy feeds and MCP operations remain usable. The custom plugin editor is retired in both modes.

## Public feeds

```http
GET /_emdash/api/plugins/eventual/publicEvents?from=2026-11-01&through=2026-11-30&locale=fr&strict=true
GET /_emdash/api/plugins/eventual/calendar?locale=fr&strict=true&category=Music
```

JSON ranges are inclusive and limited to 366 days. Calendar covers today through 365 days ahead. Both select one published sibling per group. Exact locale matches win; otherwise non-strict mode includes a deterministic fallback title such as [EN] Board meeting. Strict mode omits untranslated active events. Language-region matching is exact.

Calendar UIDs use group/recurrence identity independent of locale. Migration preserves legacy UIDs, and the configured hostname is pinned in KV. Native logical SEQUENCE increases when published groups change. Committed-state reconciliation emits matching cancellations for removed occurrences/publications and removed strict-locale/category subscriptions. Retention is 366 days. Actual client subscription behavior requires client-specific acceptance testing.

Scans, expansion and calendar bytes are bounded; unavailable/excessive calendar work returns HTTP 503 instead of a partial feed. JSON uses EmDash's standard response envelope.

## Astro

Install the source package alongside the sandbox plugin:

```astro
---
import { fetchPublicFeed } from "eventual/astro";
import EventList from "eventual/astro/EventList.astro";
const { events } = await fetchPublicFeed(
  "https://your-site.example", "2026-11-01", "2026-11-30", "",
  { locale: "fr", strict: false },
);
---
<EventList events={events} locale="fr" emptyMessage="Aucun événement." />
```

expandEventOccurrences handles native ContentItems, Astro Live Collection entries and legacy records. JSON-LD helpers preserve native URLs, images, organizer details and rescheduling metadata, with safe script serialization. EventList uses explicit/page locale, then entry locale; machine-date parameters remain Gregorian ASCII for Arabic and Thai displays. Native public URLs take precedence over slug/ID fallbacks.

The [Astro visitor example](./examples/astro-events/README.md) supplies seven presentation layouts. Site routes and schemas remain site-owned.

## Permissions and development

Capabilities: content:read, content:write, content:publish, content:revisions:read, schema:read, hooks.content-policy:register, media:read and media:bytes:read. These support migration, validation, feed hydration or retained legacy media serving. There are no outbound hosts and no schema-write capability. Migration/MCP management requires plugins:manage; the companion page requires content:edit_any.

```sh
npm install
npm run validate
npm run typecheck
npm test
npm run test:tooling
npm run bundle
npm run budget
npm run test:package
```

Tests cover the production EmDash/D1 sandbox lifecycle, migration recovery, bilingual publication, media, an independent ICS parser and native timed-feed profiling. Custom-editor tests were retired with that runtime; native and compatibility routes have replacement coverage.

Licensed under [MIT](./LICENSE).
