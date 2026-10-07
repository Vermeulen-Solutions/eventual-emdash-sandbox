## Install and upgrade

0.12.1 recovers the native editor and fixes installation. Tested host: Node 24, EmDash/Admin/Block Kit 1.0.1, Astro 7.3.x (>=7.3.2), Vite 8.3.x, React 19.

Install BOTH the registry backend and the host tarball from the v0.12.1 GitHub release. Use eventual/install instead of the emdash/astro default integration import; retain database, runner, storage and other integrations. Registry hosts must not add a second source backend. The integration adds friendly fields and compatibility adapters. English/French controls follow admin language; editors need no JSON editing.

Follow docs/editor-upgrade.md in the host package. Existing collections require an offline, backed-up schema/reference upgrade; updating a blueprint is insufficient. The supplied CLI supports SQLite, not deployed D1 upgrades. Run the installation doctor and actual Astro check/build.

For new sites apply eventual/schema blueprints and configure locales. For legacy data preview administrator-only migrateToNative batches before executing. Existing locations must match events.venue and have indexed unique legacy_id and legacy_metadata fields. Legacy storage is retained; preview cannot predict generated IDs or other plugins' policies.

Installing events changes feed authority immediately, even when empty. Legacy writes are gated in native mode. Native export is not a full revision/database backup.

## Feeds and access

JSON: /_emdash/api/plugins/eventual/publicEvents. ICS: /_emdash/api/plugins/eventual/calendar. Locale, strict and category filters supported; fallback titles show language. Astro pages belong to the site; use eventual/astro helpers.

Migration/MCP requires plugins:manage; workspace/panel requires content:edit_any. Backend capabilities include content, revisions, schema read, policies, scoped draft patches and media. No schema-write privilege or outbound hosts. Core patch review and publication remain required.
