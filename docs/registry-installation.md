## Install and upgrade

Requires EmDash 1.0.1+ and a sandbox runner. Eventual 0.12.0 links to core's editor; the custom editor is retired. Installation does not create schemas or migrate records.

Review capabilities. Apply eventual/schema blueprints through the site's schema workflow, configure locales, then preview and execute administrator-only migrateToNative batches. Existing locations need unique indexed legacy_id and legacy_metadata JSON fields and must match events.venue. See the native-modernization guide.

Legacy storage is retained. Published events/venues are explicitly published; drafts stay drafts. Generated IDs and durable recovery protect retries. Preview cannot predict IDs or other plugins' policies. Completed native records are not overwritten or republished.

Installing events changes authority immediately, including while empty. Native sites use core content tools; legacy CRUD/imports are gated. Export and settings remain available. Sites without events retain legacy feeds/MCP, but have no custom plugin editor.

## Feeds and Astro

JSON: /_emdash/api/plugins/eventual/publicEvents. Calendar: /_emdash/api/plugins/eventual/calendar. Both support locale, strict and category filters. Untranslated fallback titles carry a language prefix unless strict mode is enabled. UIDs survive translation/migration; removed publication/occurrences and removed strict-locale/category subscriptions receive matching cancellations.

Install the source package for eventual/astro, EventList and JSON-LD helpers. The sandbox plugin does not provision public pages. The Astro example offers seven visitor layouts.

## Permissions

Capabilities support content read/write/publication, revision/schema read, content policies and media read/bytes read. No schema-write privilege or outbound hosts are requested. Migration/MCP requires plugins:manage; the companion page requires content:edit_any. Migration never deletes legacy storage.
