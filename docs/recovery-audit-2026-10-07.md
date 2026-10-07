# Eventual 0.12.0 recovery audit and implementation handoff

Follow-up: [release-refinements-2026-10-07.md](release-refinements-2026-10-07.md) supersedes this report's remaining installation/presentation work and earlier verification counts. In particular, core patch review now has a scoped human/French presentation adapter; it still uses the core receipt flow.

Date: 7 October 2026. Repository: `C:\dev\eventual-em\eventual-emdash-sandbox`.

This report supersedes the earlier statement that WP0–WP10 were all complete and verified. The recovery implemented useful features, but several central workflows were only tested through mocks and did not satisfy the real EmDash contracts. This audit repaired the defects described below, simplified routine editing, and verified the application in the actual local host. The native collection architecture is retained.

Read [editor-upgrade.md](editor-upgrade.md) for installation, migration and rollback. Read [modernization-verification.md](modernization-verification.md) for the final measured checks. The earlier [modernization handoff](modernization-agent-handoff.md) is historical; its statements about remaining source files and unapplied local schemas are no longer current.

## 1. Scope and changes to the workspace

The working tree already contained the recovery agent's uncommitted implementation. It was audited and improved in place, without resetting that work. No commit, push, registry publication or remote-site deployment was performed. Package/source version remains 0.12.0; this is an unreleased repair working tree, not a new registry release. The old untracked root `eventual-0.12.0.tgz` was preserved and is **not** the repaired artifact. New package-consumer tarballs are under ignored `reports/packed-consumer-*`; the rebuilt sandbox archive is in `dist`.

The local Astro host at `C:\dev\eventual-em\eventual-emdash-test-site` was configured with the frontend companion and compatibility transform. Its actual SQLite database was upgraded after a rollback preview and consistent backup. Browser editing/publication tests used a separate backed-up audit database under `reports/recovery-site`, not the original site's content.

## 2. Defects found and repaired

| Area | Actual defect | Implemented correction |
| --- | --- | --- |
| Panel initial load | Assumed `panel_load` included a draft snapshot; existing recurring events could appear non-recurring | Reads the saved item and its actual `draftRevisionId` when the host does not supply a snapshot |
| Draft identity | Unit fixtures invented a different UI identity contract | Uses host-attested `route.ui.entry`, including numeric core version; rejects body-forged identity |
| Occurrence copy | Wrote an object map, but validation/expansion expected an array | Uses `{recurrenceId, overrides}[]` throughout and tests it through core save, publication and feeds |
| Occurrence identifiers | Tests used compact UTC strings instead of real local recurrence IDs | Validates membership using `scheduledOccurrence`; timed IDs are local `YYYY-MM-DDTHH:mm`, all-day IDs are civil dates |
| Recurrence form | Newly chosen patterns did not reveal the right controls; monthly weekday controls were missing | Conditional daily/weekly/monthly date/monthly weekday controls; Monday-first weekly choices; strict compiler validation |
| Form submission | Block Kit embedded forms inside the event form; panel buttons could submit/reload the entire editor | Scoped, version-specific Vite compatibility transform; actual browser confirms one surrounding form and no nested plugin forms |
| Form state | Server responses could leave an occurrence form holding a previous date's values | Reset Block Kit form values when new server field definitions arrive |
| Rescheduling | Required editors to construct ISO instants | Separate local date/time controls, common time zones plus any valid custom IANA zone; reject nonexistent DST wall times |
| Occurrence inspector | Window began at the series origin; dates/statuses lacked useful context | Upcoming 90-day default, selectable window, ten rows/page, localized display dates, original/effective distinction and full selected-date range/zone |
| Venue references | Core relation-bound fields are storage-less; plugin reads did not hydrate their edges | Schema-derived targets; canonical column-backed IDs; offline live/draft/revision backfill; native readers/panel/migration use the authoritative column |
| Venue/organizer localization | Shared IDs resolved only the selected row's language | Resolve published translation siblings for each event's locale; keep the shared reference ID and calendar UID unchanged |
| Directory limits | First-page-only reads and potentially oversized option payloads | Defensive pagination; name search with at most 80 matches/list; preserve current selections and show locale/publication status |
| Duplication | Used a nested native-create payload and copied metadata/date-specific history | Flat data plus third-argument locale options, editable-field allowlist and deep clone; new core draft with fresh identity, no old exceptions/copy/history |
| Dependency guards | Scanned only 100 events, missed scheduled variants, and could fail open | All-page scan; pending scheduled revisions, including scheduled changes to published rows; schema targets and translated dependencies; fail closed |
| Schedule history | Could compare with revision zero rather than the actual editable draft; unchanged full-form values interfered | Actual draft pointer, committed live comparison, unchanged stale copy retention and correct rescheduled business status |
| Public descriptions | Occurrence descriptions could retain series `descriptionBlocks` or leak an array into a string property | Replace/clear blocks consistently with occurrence text; retain rich unchanged copy while editing another field |
| Organizer precedence | Native organizer resolution was absent; explicit empty occurrence override could regain snapshot content | Resolve live organizer data; localized copy wins, then event display override, resolved organizer, snapshot; explicit occurrence clear suppresses fallback |
| Calendar change detection | Organizer edits were omitted from the fingerprint | Hydrate organizer data before native calendar comparison; translated venue data also participates |
| Fallback language labeling | Occurrence title overrides could remove the fallback language prefix | Prefix overridden occurrence titles as well as the series title without mutating stored copy; strict mode still omits the untranslated series |
| MCP native reads | Pagination, venue hydration, custom directory targets and native authority were inconsistent | Paginate before expansion/limits; hydrate get results; use schema targets; an empty/erroring native directory never resurrects legacy data |
| Native export | Lost core locale/group/publication metadata and could exceed route budget | Versioned native-content export with core metadata, schema-selected targets, cursor checks and 65,536-byte response guard |
| Image compatibility | Migrated/native mode made old plugin image aliases return 404 unconditionally | Resolve only published native records by current/legacy ID and serve their selected current media; an unpublished event returns 404 |
| Editor clutter | Core rendered internal JSON/IDs/history and irrelevant primitive fields | Supported native field widgets hide managed internals, fold optional text fields and label attendance/business status clearly |
| Misleading settings | Editor settings could mutate collection routing independently of schema | Remove the obsolete settings form; schema remains the target authority; no collection-setting writes from the editor/workspace |

## 3. What nontechnical editors now see

The main event form contains the title, native Portable Text description, core media picker, readable attendance/business status and optional detail disclosures. There are no routine inputs for recurrence JSON, exception JSON, migration IDs, legacy metadata, calendar identity, organizer snapshots or schedule history.

The **Dates, venue & repeat** panel provides:

1. All-day or timed local dates, end dates, time zone selection and validation.
2. Daily/weekly/monthly recurrence, with only relevant pattern controls visible.
3. Saved venue/organizer selectors, name search, visible locale and unpublished warnings, and ordinary comma-separated categories.
4. An upcoming 90-day occurrence list and a selected-date manager for cancellation, restoration, rescheduling and localized announcement copy.

Announcement controls distinguish “inherit the series value” from “use a different value,” including an explicit empty location/organizer. Restoring an occurrence restores its schedule without deleting that locale's announcement. Editing another copy field preserves existing rich description blocks; changing description text converts the entered plain text to Portable Text blocks. This small occurrence-description form is a plain-text editor, not a second native rich-text toolbar. The main announcement remains native Portable Text.

Panel actions propose changes through the host's signed draft receipt/review mechanism. They do not publish or write content directly. The wording now says the change is ready for review. EmDash may autosave after the editor accepts a patch; publication is explicit. Core's review dialog still displays stored values, including reference IDs. This is a host UI limitation, not permission to bypass review.

The companion workspace has edit/create/directory links, paginated native event rows, safe duplication and working JSON/ICS links. For a published source, duplication copies its committed live data, not an unpublished pending revision. A core draft source copies its saved draft data. It does not duplicate unsaved browser changes or translation siblings.

## 4. Reference storage: preserve this implementation decision

This is the most important architectural correction in the audit.

In installed EmDash 1.0.1, a reference field bound to a relation is backed by `_emdash_content_references`, with pending selections in revision `_references`. The ordinary plugin content item did not hydrate that relation into `data.venue`. A picker appearing to work was not evidence that feeds or migration would see its selection.

Fresh Eventual blueprints therefore default to column-backed reference fields. The optional relation-bound blueprint includes shared `venue_id`/`organizer_id` aliases for domain use. On an existing bound schema, the upgrade adds and populates those aliases. Target selection comes from the installed event schema, with `validation.targetCollection` taking precedence over `options.collection`, not plugin settings. The panel, event adapter, migration, publication checks and dependency guards use the same rule.

The offline upgrade preserves three independent versions of a selection:

- Committed/live selection comes from the relation edges.
- Pending selection comes from that draft revision's `_references` snapshot.
- Historical selection comes from available historical snapshot data.

It chooses a consistent canonical entry ID across event languages. A rerun never overwrites a populated alias or an explicit empty selection. Missing/ambiguous references cause a transactional failure. Old edges and original fields remain intact as historical data; later canonical-column edits do **not** update those old graph edges. Any separate application using the old graph must be adapted deliberately. Never re-enable the old bound picker or delete original fields/edges as casual cleanup.

For public output, the saved shared ID remains stable while a published venue/organizer translation can supply the event language's name and editorial address details. If that translation is missing/unpublished, use the published referenced row. Unpublished referenced rows cannot satisfy publication validation.

## 5. The applied local upgrade and preservation evidence

Actual target: `C:\dev\eventual-em\eventual-emdash-test-site\data.db`.

Consistent backup: `C:\dev\eventual-em\eventual-emdash-test-site\data.db-before-eventual-editor-20261007.bak`. The site's `data.db-*` ignore rule covers this backup. It contains site data and must not be committed or sent elsewhere.

Preview and application both reported seven event rows and six reference revisions backfilled, with no warnings. The preservation comparison then checked all seven event rows and all nine revision records: every old event field and every old revision value/metadata field was preserved apart from the deliberately added reference aliases. Ninety other existing tables, including legacy plugin content and relation edges, retained their contents. SchemaRegistry updates its own schema tables and derived media-index status/work queues as part of this upgrade; those expected derived records are not “unchanged content.”

Evidence files are `reports/recovery-original-schema-preview.json`, `reports/recovery-original-schema-applied.json`, and `reports/recovery-original-preservation.json`. These are local ignored reports. Browser mutation evidence is from the separate audit database, not the original target.

The upgrade tool defaults to a rollback preview, requires a fresh backup path for CLI apply, verifies the installed core version and runs the mutation in a transaction. Its test creates a real core-migrated SQLite database and checks different live/pending/historical references, translated rows, idempotency, explicit clearing and rollback on an ambiguous reference.

## 6. Calendar, Astro, permissions and migration contracts

The earlier repaired calendar contracts remain in place: shared translation identity, migrated subscriber identity, deterministic recurrence identity, integer monotonic SEQUENCE, committed-publication snapshots, matching cancellation UIDs, UTF-8 octet folding, escaping, all-day exclusive DTEND and locale/strict/category subscriptions. Independent parsing and production-runtime regressions remain in the test suite. This audit does not claim an actual Apple/Google/Outlook subscription test.

Native content stays authoritative when its schema exists, including when empty. Native read failures must not fall back to retained legacy rows. Core publication state controls visibility; `event_status` describes the event itself. Shared fields are synchronized by core on committed publication; `translatable: false` is not a ban on editing through a secondary-language row. Drafts may differ from live data.

Native/LiveCollection and legacy adapters remain available, with native metadata and rich Portable Text blocks exposed to Astro consumers. Packed consumer tests cover native/Live adapters, all-day/timed data, JSON-LD escaping/metadata and localized display in en/fr/ar/th. The standalone Astro example continues to build and pass its own tests.

Declared backend capabilities support content read/write/publication, revision and schema read, content policy hooks, scoped editor draft read/patch and media metadata/bytes. There is no schema-write capability and no outbound host permission. The frontend-only companion declares no backend routes/hooks/storage/capabilities. Migration and Eventual MCP/transfer routes require `plugins:manage`; workspace/panel require `content:edit_any`. Duplicate writes additionally require the host-attested signed-in user.

Legacy storage and its useful read/migration compatibility were retained. Four dead private-storage UI modules were deleted: `src/admin.ts`, `src/occurrence-admin.ts`, `src/description-admin.ts`, `src/organizer-admin.ts`. Git history retains them. Do not restore their imports into native mode. Do not delete legacy tables, migration ledgers or calendar state as part of source cleanup.

Migration remains non-destructive and resumable; the new reference selection fix also applies to migration payloads. Its preview reports work and known mappings, but cannot promise generated IDs, external hook outcomes or atomic whole-site execution. Native legacy mutation tools/import remain blocked. EmDash 1.0.1's plugin update interface does not provide the same hooks/CAS guarantees as ordinary core editing, so calling it directly is not a safe native mutation “parity” fix.

Native export is explicitly `native-content-v1`. It includes saved content plus locale, translation group, status, slug, dates and revision pointers. It does **not** include all revision bodies, media bytes, schema, users, options, graph edges and private plugin state required for a complete restore. Use a full EmDash/site backup for disaster recovery. Do not feed this native export into the legacy importer.

## 7. Dependency and packaging changes

The npm audit initially reported ten high-severity dependency findings, largely in the development/Cloudflare toolchain. Compatible patch updates moved source-map-js to 1.2.2 and root overrides pin sharp 0.35.5 and undici 7.29.1 for the affected 7.29.0 dependency. The final plugin-workspace audit reports zero vulnerabilities. Overrides were validated with the test/build/package checks; they do not update another site's independently installed dependency tree.

The source distribution exports `eventual/admin` and `eventual/admin/compat`, includes the upgrade script/runbook and declares optional React and Kysely peers. The backend remains a standard sandbox artifact. The packed consumer imports the frontend companion as well as rendering Astro pages. README and registry setup now explain the extra host integration and no longer advertise the nonexistent publisher-CLI install command or retired Agent Access form.

The backend is close to the existing 110 KiB target. Keep checking the actual archive, including generated manifest and README. Do not raise limits casually or merge future large UI features into the sandbox without measuring.

## 8. Remaining platform/release work, with explicit boundaries

The local repairs and installed local editor/schema are complete once the final verification table passes. The following are separate external acceptance/platform/release work, not evidence that they already happened:

1. **Registry-only frontend delivery:** current sandbox installation cannot register React field renderers or patch a host renderer. Supply/install the matching source frontend companion, or implement an upstream supported sandbox field-renderer mechanism. Do not claim registry installation alone produces the screenshots in this audit.
2. **Existing D1 relation-bound upgrades:** the supplied CLI is offline SQLite, not a D1 tool. Implement an equivalent backed-up host migration through the site's Cloudflare deployment workflow before claiming an existing D1 installation is upgraded. Fresh unbound D1 schemas do not need an old relation-edge backfill.
3. **Native write/import parity:** retain the explicit block until core offers or the host implements ordinary action validation, lifecycle hooks, actor authorization and atomic optimistic concurrency. Add production-runtime create/update/publish/delete/exception and conflict tests before exposing it. A mocked ctx.content.update success is insufficient.
4. **Real subscriber acceptance:** use actual client subscriptions to test migrated UIDs, old oversized SEQUENCE recovery, locale switches, cancellation/restoration and DST. Parser tests are not client acceptance. Coordinate migration before deleting an old production feed.
5. **Real translation-plugin acceptance:** verify the deployed LinguaDash/editor workflow against that site's schema and locales. Core translation tests prove core inheritance, not that a third-party AI translation integration has been exercised.
6. **Upstream renderer fixes:** replace the scoped compatibility transform only after confirming both embedded submission and form state refresh on the replacement version. Core review still exposes stored IDs; solve its display upstream rather than bypassing receipts.
7. **Transaction-wide dependency policy:** hooks check dependencies before mutation but do not lock a simultaneous event publication and venue deletion as one atomic operation. A strict cross-request guarantee requires host/core transactional policy. Large-site performance must also be measured with that site's content; scans are bounded and directory responses are bounded, but no broad hosted-site load test was run.
8. **Release:** review the working tree, pick/bump the intended repair version, align native companion/runtime versions, build/check artifacts, review capabilities and registry sections, publish/attach the actual release and perform site-specific deployments. No old root tarball or prior registry CID represents this working tree. Preserve backups and reconcile content before any rollback or legacy purge.

Do not restart the architecture or restore the legacy private editor. Preserve core publication separation, shared-field semantics, canonical reference IDs, validated recurrence IDs and the non-destructive migration contract. If a new defect appears, reproduce it through the relevant real boundary—host receipt, core content action, SQLite upgrade or packed Astro consumer—before changing the implementation.
