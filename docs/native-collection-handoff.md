# Native collection implementation handoff

Eventual 0.13.0 follows the user's architectural decision: EmDash content types own events, venues and organizers. Eventual is a sandboxed schedule/domain companion. See [0.13.0 release notes](release-notes-0.13.0.md) and the [breaking upgrade guide](upgrade-0.13.0.md). Do not reinstate the private-storage editor or require the historical frontend companion to make this architecture work.

## Implemented data-source contract

`src/domain/collections.ts` stores one `collections` setting containing `{events,venues,organizers}`. Existing conventional schemas are discovered when no explicit choice exists. Explicit selections are validated and fail closed if a collection disappears. An empty selected native event collection remains authoritative; it does not revive private events. Administrator settings select existing collections; they do not create schemas or move content.

`saveCollectionBindings` validates the event blueprint's required field types, Portable Text description, shared schedule flags, localized announcement/occurrence-copy flags and exact directory reference targets. Directories need a string name or title. A directory cannot be set to none while its event reference exists. EmDash's host-attested admin role protects the settings screen; MCP settings use plugins:manage. Editor-level users cannot change those bindings.

Selected event slugs drive native feed reads, public URL/media lookup, MCP inspection, native export, duplication, migration and lifecycle hooks. Venue/organizer target resolution comes from the validated event schema. Save/publish hooks return early for unrelated collections. Dependency deletion/unpublication guards scan the configured event source.

The native settings form contains only the three collection selectors. The old defaultTimezone setting does not alter a native collection's field default, so that misleading control was removed. The legacy/MCP setting remains compatible; per-event timezone is edited through core/the schedule panel. Collection forms can save without submitting defaultTimezone.

## Native editor and panel

The announcement is created/edited in core, including title, Portable Text, images, locale rows and publication. `src/admin.ts` is companion navigation/settings only. `src/native-admin.ts` lists native entries, links directly to configured content types and creates clean native draft copies. Unused private-form modules were removed; legacy data and compatibility MCP/transfer support remain.

`src/native/saved-panel.ts` bridges the global saved-entry panel to `computeSchedulePanel` and the compact renderer. The host-attested entry collection/id is authoritative. The handler reads the latest persisted draft revision; it ignores client draft snapshots. Only schedule/domain fields are written through ctx.content.update; series title/description/excerpt are excluded. A version token rejects stale forms, and a second preflight precedes writes. Core owns publication; schedule saves create/update drafts and do not leak into public feeds.

The panel supports dates, daily/weekly/monthly recurrence, native venue/organizer selection, 90-day occurrence inspection and cancel/restore/reschedule/localized-copy operations. Runtime validation retains the 500-exception limit. French/English controls preserve user-entered strings, IDs and selected directory labels. Existing Block Kit styling is retained. Admin URLs work on fresh sites whose site URL is empty by using the current request origin.

Occurrence sections now have unique keys based on recurrence IDs. The earlier repeated eventual-verbatim key caused React to report duplicate children. Localization recognizes their verbatim prefix so an occurrence's data is preserved. Do not revert to identical row keys; the browser console gate and runtime panel assertion now catch this.

## Optional schema setup

`scripts/export-native-schema.mjs` generates a schema-only seed. It supports configurable event/venue/organizer slugs, configured default locale, directory reuse flags and exclusive output creation. It does not contact a database, overwrite files, add content or install frontend patches. It removes historical eventual-editor widget hints from generated fields. The source package exposes the command as eventual-schema; no second package is required merely to provide this tool.

`docs/collection-setup.md` includes the exact local SQLite CLI procedure, existing-directory instructions and a copyable core MCP agent prompt. Remote D1 sites must use their supported schema deployment or core MCP tools rather than a local SQLite command. Existing schemas require deliberate additive upgrades; settings do not rewrite them.

IMPORTANT: Do not casually add validation.targetCollection to the column-backed fields. EmDash's seed importer can automatically bind those fields to relations. The existing bound-schema compatibility path then requires venue_id/organizer_id backing selections. Default generated schemas use options.collection and the sandbox panel's picker. Native generic fields may therefore show an entry-ID control; editors select entries in Dates, venue & repeat. Test the actual seed importer, not just fixtures, after changing references.

## Documentation and packaging

README, registry installation/changelog and modernization notes describe native collection ownership, optional setup and EmDash >=1.2.0 <2.0.0. Prior private-form and mandatory two-package proposals are explicitly superseded. Historical 1.0.1 companion exports remain guarded compatibility facilities, not the 1.2 setup path. Package/manifest descriptions were changed locally; no external registry entry was updated.

Release preparation requires native-collection browser evidence with an architecture marker and current package fingerprint. Old standalone browser reports cannot satisfy that gate. Bundle hard limits are unchanged. Do not raise limits to hide regressions. The current backend is close to the working file budget; consolidate code when adding features.

## Constraints that remain

- Core's stock generic form still exposes required schedule/reference/JSON fields. Prototype identity/history fields have been removed from default schemas. This sandbox does not provide a hidden-field renderer. Use the panel; never claim every technical field is hidden.
- A new event must be saved before the saved-entry panel exists. Save unsaved announcement edits before panel operations, and reload after changes. No capability for arbitrary configured unsaved draft scopes is declared.
- The global panel may appear on other collections, where it performs no event mutations. Its collection guard must remain.
- Preflight tokens are not an atomic concurrent-write lock. ctx.content.update has no expected-revision predicate; simultaneous writes between preflight and commit remain an upstream API limitation.
- Directory choices are bounded; very large directories may need server-side search/pagination refinement.
- Core UI labels/static sidebar titles are governed by EmDash. Plugin controls have French/English support; this does not install a translation service or enable site locales.
- EmDash 1.2's `packages/blocks/src/blocks/form.tsx` renders a literal form inside the core editor's form. Its click handler prevents native submission, but React still logs nested-form diagnostics in development. Its `elements/combobox.tsx` also omits a key on Combobox.Item. There is no supported sandbox block property to change the form tag or portal these controls. Do not invent one or add a mandatory frontend patch. Browser acceptance records these exact upstream diagnostics separately, fails every other console/page error, and verifies panel saves do not navigate or submit the outer editor. A future core renderer fix should use a non-form container in an editor context and proper item keys; retain a real form on standalone admin pages.
- Actual LinguaDash use, deployed remote D1 schema changes, and Apple/Google/Outlook subscription behavior require acceptance on those environments. Do not certify them from local tests.
- Legacy manual translations are retained but explicit migration currently rejects them rather than silently losing native locale rows. Resolve/create those rows deliberately before migration.

## Verification workflow

Run npm run typecheck; npm test; npm run test:tooling; npm run test:package; npm run test:editor; npm run bundle; npm run budget. Run npm test under the additional New York process timezone before release preparation. tests/collection-bindings.test.ts verifies custom activities/locations/hosts sources, settings authorization, invalid schema targets, dependency protection, missing-collection fail-closed behavior and non-destructive custom-target migration. tests/migration.test.ts verifies native draft/Portable Text preservation, publication and stale forms. Tooling tests verify schema reuse and output safety. The packed consumer uses EmDash 1.2.0 and sandbox-workerd 0.9.3; Astro checks include four locales, JSON-LD and machine-date URLs. Browser tests use real migrations, generated schemas and the packed sandbox, with no frontend companion.

Read the current reports/native-* logs and reports/editor-installation.json for actual results; do not treat an earlier claim of passing tests as current evidence after edits. The plugin remains unpublished.

## Acceptance baseline before schema simplification (7 October 2026)

- TypeScript and manifest validation passed. The complete suite passed 178 tests in 23 files under both Europe/Paris and America/New_York process timezones. Tooling passed all 19 tests; whitespace checks passed.
- The installed, packed Astro consumer passed native/Live adapter, Portable Text, JSON-LD, machine-date URL and localized-date checks in en, fr, ar and th. It uses stock EmDash 1.2.0 with sandbox-workerd 0.9.3, without a frontend companion.
- Both real-browser workflows passed. The French workflow selects activities/locations/hosts, verifies bold Portable Text, saves dates, selects the venue and organizer, saves/reloads weekly Monday recurrence, cancels/restores one occurrence, publishes through core, and checks JSON/ICS output. The English workflow verifies configured content-type links and mobile layout. The checks reject unexpected console/page errors and retain the explicit upstream renderer diagnostics described above.
- Before publication the JSON feed is empty. After publishing test content it contains four occurrences with the selected venue/organizer and preserved rich-text marks. Strict English filtering is empty; fallback English titles use [FR]. French/English ICS UIDs match. Publication in this test means an isolated local content fixture, not a package release or production publication.
- Desktop/mobile frontend screenshots cover the packed EventList example, not a complete site theme. French accents render correctly after adding UTF-8 metadata to the test example. No website stylesheet was changed. Its isolated browser path is /component-preview; /fr is not valid for the default locale in this host's i18n configuration.
- The registry installation payload has three files, with backend.js at 130405 bytes and total uncompressed payload at 182248 bytes. Both working and registry hard budgets pass. Backend headroom is small: 155 bytes against the working budget, 667 against the hard limit. Consolidate before adding runtime features; do not raise the registry limits.

Screenshots are in images/registry-0.13.0/native-*.png. The manifest now uses native-editor/settings/workspace images rather than the superseded private-form images. reports/editor-installation.json records the source-package fingerprint, native architecture, database path, console evidence and frontend scope. reports/release-preparation.json records locally prepared artifacts and hashes. None of this authorizes publication; keep publication on hold.

## Local preview left running

The tested stock EmDash 1.2 preview is running at http://127.0.0.1:4321. This is an isolated acceptance database under reports, containing the published French Rencontre des voisins fixture, a venue and an organizer. It is not a production site or an automatic migration of an older preview database. Existing databases and legacy storage were not deleted.

Open /_emdash/api/auth/dev-bypass?redirect=%2F_emdash%2Fadmin%2Fcontent%2Factivities in this development preview to sign in and reach native events. Settings are at /_emdash/admin/plugins/eventual/settings. Configured slugs are activities, locations and hosts. The fixture has four Monday occurrences, preserved bold Portable Text, École communale as venue and Association de quartier as organizer. /component-preview is an isolated Astro helper demonstration; its content is separate from the live event fixture.

reports/native-preview.json contains the actual process ID, workspace, database and package hash. Its stdout/stderr logs are reports/native-preview-stdout.log and reports/native-preview-stderr.log. Verify those paths before stopping or replacing this process; do not kill unrelated Node processes. Only this preview's database should be used for local experiment writes. The baseline package fingerprints above are superseded by schema simplification; use reports/native-preview.json and the latest acceptance report for current fingerprints. No commit, push, tag, registry update or external publication was performed.

## Schema simplification after editor feedback

The default event blueprint removes `legacy_id`, `legacy_metadata`, `calendar_uid`, `organizer_details`, `image_url`, `schedule_history`, `previous_start_date`, `excerpt`, `location` and `organizer`. Directory blueprints omit both legacy fields. Rich descriptions, native images, saved directory references and derived translation-group calendar identity remain. Short summaries and series display-name/location overrides are optional custom-schema features, not required for the plugin. Native revisions retain schedule history; the clean schema does not generate `previousStartDate` JSON-LD metadata unless an explicit compatible field exists. Do not claim that historical metadata was automatically derived from revisions.

Categories change from JSON to comma-separated native text. `readCategories` validates and normalizes both text and older JSON arrays for feed/recurrence consumers. Both schedule renderers remove their category control; `apply-details` writes references only, so venue/organizer saves cannot erase categories. The rescheduling hook checks the installed schema before writing optional history or previous-start columns. It still derives the rescheduled business status.

Prototype migration is explicit: `legacyCompatibility:true` on blueprint factories or `--legacy-compatibility` on the exporter restores the old migration fields and category JSON type. Existing migration tests use that schema deliberately. Default/new-site tests cover absent technical metadata, native text categories, category/Portable Text preservation during venue saves, and rescheduling without unknown-column writes. The legacy migration engine and compatibility reads are retained; they are not normal editor UI.

Essential stored fields: timed/civil start/end, all_day, timezone, recurrence and exceptions. Venue/organizer references support the directory pickers. `occurrence_content` is required by the current localized per-date announcement feature; it is not a field people should hand-edit. Online/hybrid type and URL, registration URL, event business status, image and categories are user-facing optional features. Stock EmDash 1.2 still renders every declared field. No mandatory core patch or unsupported visibility metadata was added. Simplifying the schema reduces clutter but does not create a hidden Advanced section or eliminate all duplicate schedule controls.

The existing live preview database was backed up to reports/native-preview-before-schema-cleanup.db before removing empty fields through core's authenticated schema API. Existing event IDs, titles, Portable Text and category values were checked against the backup. This is only the named local acceptance preview; no production schema or package registry was changed.

### Verification after schema simplification

All 181 tests passed in 23 files under both Europe/Paris and America/New_York; all 20 tooling tests passed. TypeScript, manifest validation, whitespace, packed Astro consumer and both stock-native browser workflows passed. The browser test checks the comma-separated category value survives venue/organizer saves, verifies removed field IDs are absent, preserves bold Portable Text, and exercises recurrence, cancel/restore, publication, strict/fallback feeds and cross-locale UIDs. Unexpected browser errors remain zero; documented stock-renderer diagnostics remain. The fresh editor screenshots were inspected. The existing live preview was separately reloaded and its directory selections visually confirmed.

Local release preparation succeeded without publishing. backend.js is 130505 bytes; total installation payload is 182768 bytes across 3 files. This leaves 55 bytes under the working file budget and 567 under the registry hard limit. Future runtime work must consolidate before adding features. Registry archive SHA-256: 2f8226832a031d45714c33d01c3ee64f394fcdefeb2d68c9fac012d5377e3eec; optional source package SHA-256: 9f3892c73b580888b590dae41646ef252c467f7e129599de3c1226f53af91026. Current preview PID: 27636, using its existing database. reports/native-preview.json remains the authoritative preview record; reports/editor-installation.json and reports/release-preparation.json hold current acceptance/artifact evidence.
