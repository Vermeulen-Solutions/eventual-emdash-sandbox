# Native setup and migration

These instructions describe the local 0.12.0 implementation. They do not apply a schema, migrate data or publish a release automatically.

## Apply a reviewed schema

From this repository, with Node's TypeScript stripping available:

```sh
node scripts/export-native-schema.mjs --output eventual.seed.json
npx emdash seed eventual.seed.json --validate
```

Review the seed. For an existing locations collection, use `--venue-collection locations`; the exporter emits only events and never replaces locations. Add shared `legacy_id` (string, unique, indexed) and `legacy_metadata` (JSON) fields to locations. Its required fields must be satisfiable by the name/address mapper, or pre-create compatible locations and supply `venueMapping`.

Apply the definitions through EmDash's schema editor/MCP tools or `applySeed` in the site's database workflow. For local SQLite, the CLI supports `npx emdash seed eventual.seed.json --database <actual-site-database> --no-content --on-conflict update`. Confirm the database path: the CLI defaults to `./data.db`. Cloudflare/D1 sites must use their own EmDash schema workflow. Eventual has no `schema:write` capability.

Adding events changes public authority immediately, including while empty. Plan schema application and migration together. Configure site locales first. Public routes come from the collection's `urlPattern`; Eventual does not provision Astro pages.

## Field contract

| Purpose | Native representation |
| --- | --- |
| Timed schedule | ISO `start`/`end`, IANA `timezone`, `all_day: false` |
| All-day schedule | Inclusive YYYY-MM-DD `start_date`/`end_date`, `all_day: true` |
| Publication | Core status, separate from event business status |
| Business status | `event_status`: published, cancelled, postponed, rescheduled |
| Recurrence | Structured JSON daily/weekly/monthly rule with finite until |
| Shared occurrence changes | `exceptions` JSON schedule overrides |
| Localized occurrence copy | `occurrence_content` JSON editorial overrides |
| Venue | Native ID in the schema's referenced collection |
| Image | Native `featured_image` media value or HTTP(S) `image_url` |
| Migration identity | Shared calendar_uid, unique indexed legacy_id, legacy_metadata |

New translations may contain only editorial fields: core inherits shared fields after beforeSave. Save validation uses the latest editable revision. Publication/scheduling policies validate the full schedule and require referenced venues to be published. Non-event collections are unaffected. Native identity fields cannot change after creation.

Localized occurrence copy can become unmatched when a shared schedule changes. Those overrides remain stored for restoration and are ignored during expansion until their recurrence IDs match again. Explicit edits to occurrence_content must use currently scheduled IDs. New drafts without dates defer full schedule validation until publication, allowing core translation inheritance to complete.

Sharing follows core publication synchronization; pending revisions can differ from live values. Secondary-locale editors may edit shared fields under normal core permissions. The recurrence engine implements structured daily/weekly/monthly rules, not arbitrary RFC RRULE parsing. Timed recurrence starts require minute precision; DST gaps are skipped and ambiguous wall times use the earlier offset.

Venue names/addresses are shared; directions are localized. Categories, registration links and images are shared as site policy. Deliberately changing those policies requires reassessing feed synchronization.

## Preview and execute

Preview with the administrator-only migrateToNative tool:

```json
{"dryRun":true,"locale":"fr","limit":25}
```

Review venues/events, payloads, errors, counts and optional nextCursor. The action field distinguishes creation, resumed publication and unchanged existing items. Follow preview cursors for subsequent batches. Preview writes neither content nor migration state. New native IDs are empty because core generates them. `planned:<legacy-id>` venue values are placeholders, not usable native IDs.

Execute without dryRun, then follow the execution's own nextCursor. Keep locale/collection consistent while resuming. The default locale is fr; venueCollection follows and must match events.venue. venueMapping targets must exist in that collection, and be published for published events.

Migration scans bounded source pages, including recurring series that began in the past. It preserves recurrence, shared/editorial exceptions, original descriptions, available media, external images, organizer details, prior-start/history metadata and legacy calendar UIDs. Published events/venues are explicitly published through core's versioned API; drafts stay drafts. Missing optional venue fields become empty values; unmapped or invalid required dependencies cause errors rather than dangling references.

A renewed durable lease prevents overlapping migrations. Unique legacy IDs and recovery tokens identify a create whose response was lost. Matching interrupted creations can resume publication. Completed native records are neither overwritten nor republished. Removed migrated items require explicit restoration. Legacy records and cancellation storage remain intact. Batches are not database-wide transactions.

Preview shares structural schema/schedule/media/dependency checks with execution, but cannot predict generated IDs, concurrent changes, configured locales through an exposed API, or other plugins' save/publication policies. Per-item and batch errors remain possible during execution. Correct the cause and retry.

Markdown conversion supports paragraphs, headings, lists, blockquotes, common emphasis/code marks and HTTP(S)/mailto links. It is not complete CommonMark. Original Markdown remains in legacy_metadata and legacy storage; inspect complex rendering before accepting it. Non-text custom Portable Text blocks are omitted from calendar descriptions.

## Calendar operations and limits

Native reconciliation uses a KV lease and committed published rows. Pre-delete snapshots record existing publication; feed access derives matching cancellations after committed changes. Feed caching can delay visibility by five minutes.

UIDs survive translations, migration and hostname aliases. Logical native SEQUENCE counters replace invalid millisecond values. Existing subscribers that cached older invalid SEQUENCE values may need their subscription re-added; verify actual client behavior. Removed strict-locale/category subscriptions receive scoped cancellations while other subscriptions keep active events. Historical legacy tombstones without category metadata are omitted from category feeds because their scope is unknown.

Bounds: 10,000 scanned event/native/cancellation rows, 5,000 legacy venues, 10,000 expanded occurrences, 1,000 active occurrences/history tombstones per native group, 4 MiB calendar output, and 366 exception/copy items. Migration batches default to 25 and allow 1–100. Cancellations are retained for 366 days. Group identity/sequence state is retained; more than 10,000 historical groups requires reviewed state maintenance. Limits fail explicitly instead of returning truncated feeds.

Tests exercise installed EmDash 1.0.1/D1 sandbox publication, locale inheritance, draft/schedule/unpublish/delete/restore, migration recovery, media and authorization. An independent ICS parser checks Unicode folding, escaping, inclusive all-day dates and zero-duration events. Actual LinguaDash translation, live D1 schema application and Apple/Google/Outlook subscription behavior remain site acceptance checks.
