# Eventual modernization: implementation repair and completion handoff

**Current continuation:** Read [release-refinements-2026-10-07.md](release-refinements-2026-10-07.md) for the final installation, French interface, venue selection, package acceptance and remaining deployment work. The prior handoff below is historical.

> **Latest audit:** [recovery-audit-2026-10-07.md](recovery-audit-2026-10-07.md) records the repaired editor/reference workflows, applied local schema upgrade and actual verification. Follow that report and [editor-upgrade.md](editor-upgrade.md) for current implementation and installation details; this document is retained as historical context.

> **Correction, 7 October 2026:** the custom-editor retirement described below removed essential product workflows and was rejected as a regression. This is a historical backend-repair handoff, not a current statement of editor feature parity or release readiness. Use [the 0.12 regression recovery plan](regression-recovery-plan-0.12.0.md) for implementation priorities and restored workflow requirements. Preserve the valid native data/calendar contracts; restore native-friendly controls and safe legacy-mode continuity. Publication/deployment status may have changed since this report's recorded session and must be checked separately.

**Recipient:** the agent responsible for the original four-milestone implementation and audit prompt.

**Repository:** `C:\dev\eventual-em\eventual-emdash-sandbox`.

**Date:** 6 October 2026.

**Current state:** repaired, locally verified, unreleased working tree at version **0.12.0**. Native schema application, migration on the intended site, LinguaDash acceptance, real calendar-client acceptance, release publishing and deployment are still outstanding.

Read this report before changing the implementation. The original audit describes defects in the earlier 0.11.1 working tree; it does not describe the repaired tree. This report explains the current behavior and the work still required. The short verification record is [modernization-verification.md](modernization-verification.md); the operational guide is [native-modernization.md](native-modernization.md).

## 1. What happened in this session

The initial request was an exhaustive audit of your modernization implementation. The audit found that the architectural direction was appropriate, but the existing passing tests did not establish a reliable native workflow. Several mocks accepted payloads or returned records in ways that differed from installed EmDash. The original suite passed 151 tests, while production-runtime probes reproduced failures in migration, all-day dates, partial saves, publication and native discovery.

The audit recorded 20 findings, F01–F20. The user accepted the proposed repair order and explicitly authorized implementation. Repairs were made in the existing working tree while preserving the user's earlier uncommitted modernization work. Application changes were followed by production-runtime regressions, independent calendar parsing, a packed Astro consumer, bundle validation and documentation.

The implementation was checked against **installed EmDash 1.0.1**, **plugin CLI 0.13.1**, and **plugin-test 0.2.6**. Do not substitute assumptions about another EmDash version for these verified contracts. The advertised minimum remains EmDash 1.0.1; newer versions still need normal compatibility validation.

There was no Git commit, push, release publication, site deployment, real-site schema application or real-site migration. Do not tell the user that BBHC or another site has already been modernized. The local code is ready for the remaining acceptance work described below.

The audit findings map to this report as follows. “Repaired” means the local implementation and relevant regressions were corrected; it does not mean the site/client acceptance in section 11 has happened.

| Finding | Original problem | Current disposition |
| --- | --- | --- |
| F01 | Migration scan excluded ordinary legacy events | Repaired: raw bounded storage scan; section 5 |
| F02 | Native create payload/API/schema mismatch | Repaired: generated IDs and schema-compatible payloads; sections 3 and 5 |
| F03 | Publication metadata was not preserved correctly | Repaired: explicit core publication and separate business status; section 5 |
| F04 | Partial saves and translation creation were rejected | Repaired: patch/revision-aware validation and inheritance deferral; section 4 |
| F05 | Native all-day datetime values failed expansion | Repaired: explicit civil-date representation; section 3 |
| F06 | Native recurring cancellations had incomplete/wrong identity | Repaired: committed snapshots and matching tombstones; section 7 |
| F07 | Legacy fallback could resurrect native removals | Repaired: schema-based native authority; sections 2 and 6 |
| F08 | Native feed read only the first 100 rows | Repaired: defensive native pagination; section 6 |
| F09 | Packed Astro imports lacked their source dependencies | Repaired and packed-consumer verified; section 8 |
| F10 | Schedule/exception validation missed important cases | Repaired: common validator and complete publication policies; sections 3–4 |
| F11 | Migration did not preserve subscriber UID identity | Repaired: stored shared calendar UID and pinned host; section 7 |
| F12 | Millisecond SEQUENCE exceeded RFC limits | Repaired in output; existing client cache recovery still needs acceptance; section 7 |
| F13 | Shared exceptions contained localized editorial copy | Repaired: separate occurrence_content with orphan preservation; section 3 |
| F14 | Adapters dropped venue/media/status/reschedule details | Repaired: preserved metadata and native hydration; sections 5–6 and 8 |
| F15 | Localized machine dates and entry locale were unsafe | Repaired: separate Gregorian machine/display formatting; section 8 |
| F16 | Preview, mappings and retries were unreliable | Repaired with explicit preview limits and durable recovery; section 5 |
| F17 | Portable Text conversion was incomplete and fragile | Improved and bounded; complete CommonMark remains outside scope; section 8 |
| F18 | Select/schema provisioning contracts were incomplete | Repaired blueprint/export/preflight; actual site application remains; sections 3 and 11B |
| F19 | Resource/concurrency limits were insufficient | Repaired bounds and regressions; live performance/state maintenance remain; sections 9 and 11F |
| F20 | Native and legacy editing/serving had competing authority | Repaired: common source and retired/gated legacy editor paths; sections 2 and 6 |

## 2. Architectural decisions you must preserve

### One native authority

When a compatible native `events` collection is installed, native content is authoritative for both public JSON and calendar feeds, even when the collection is empty. Native read failures must surface as failures. They must not fall back to legacy storage.

Legacy fallback is allowed only when the native events schema is absent. Otherwise, an intentionally unpublished or deleted native event could be resurrected from an old legacy row. This was a concrete audit defect, not a hypothetical concern.

**Operational consequence:** creating an empty events collection immediately changes public feed authority. Schema installation and migration must be coordinated. Do not install the schema on a live site and then leave migration for an unspecified later date while expecting legacy events to remain visible.

### Core owns editing and publication

Eventual is now a domain companion around native collections. The custom event editor is retired from the runtime. `src/plugin.ts` imports `src/native-admin.ts`, whose page links to EmDash events and the configured venue collection. The upcoming-events widget uses the common public source.

The old `src/admin.ts`, `src/description-admin.ts` and `src/organizer-admin.ts` source files remain in the repository, but are not the active plugin editing path. Do not restore their imports to recover an old UI. That would recreate competing native and legacy editing authorities and also increase the sandbox bundle size.

Before native schema installation, legacy MCP event/venue/organizer operations and legacy feeds remain available. Once native events are installed, legacy management operations and legacy import/preview paths are gated with `NATIVE_COLLECTIONS_ACTIVE`. Export and settings remain available. The migration tool has its own native-aware path and is not blocked by that gate.

**User-visible change:** the custom editor is retired in both modes. An unmigrated installation retains MCP compatibility, but does not retain the old custom GUI. This transition is deliberate and must be included in release communication.

### Shared fields are not a permission system

`translatable: false` means that core shares values across translation siblings. It does not prohibit an authorized editor from changing a schedule through a secondary-language row. Published shared data follows core synchronization; pending revisions can legitimately differ from current live values.

Do not claim that every draft row always has an identical schedule or that English editors are automatically forbidden to change shared fields. If a site needs language-specific editing permissions, that is additional policy work and needs separate authorization and tests.

### Native IDs, slugs and publication belong to core

Native content IDs are assigned by EmDash. Migration no longer promises predetermined IDs. `legacy_id` and a durable ledger connect legacy records to generated native IDs.

Slug is per-locale core metadata. There is no custom `slug` field in the event blueprint. Do not add a reserved slug field merely to attach a translatable flag. The blueprint provides `/events/{slug}` as its URL pattern; the site remains responsible for its Astro routes.

Core publication status controls visibility. The custom `event_status` field describes event cancellation, postponement or rescheduling. Setting `event_status: "published"` does not publish a core draft.

## 3. Native schema and schedule contracts

`src/schema/blueprint.ts` now produces typed seed-compatible collections. Events support `drafts`, `revisions`, `scheduling` and `search`. Select constraints use installed core's `validation.options`, not the ineffective `options.choices` shape.

The full event field policy is:

| Fields | Representation | Locale policy |
| --- | --- | --- |
| `title` | Required searchable string | Translatable |
| `description` | Portable Text | Translatable |
| `excerpt` | Text | Translatable |
| `location`, `organizer` | Editorial display strings | Translatable |
| `occurrence_content` | JSON localized occurrence overrides | Translatable |
| `start`, `end` | Timed ISO instants | Shared |
| `start_date`, `end_date` | Inclusive Gregorian all-day dates | Shared |
| `all_day`, `timezone` | Boolean and IANA zone | Shared |
| `venue` | Native reference to the configured collection | Shared |
| `location_type`, `virtual_url`, `external_url` | Attendance type and URLs | Shared |
| `featured_image`, `image_url` | Native image value or external URL | Shared |
| `organizer_details`, `categories` | JSON | Shared |
| `event_status` | Business-status select | Shared |
| `recurrence`, `exceptions` | Structured schedule JSON | Shared |
| `previous_start_date`, `schedule_history` | Rescheduling metadata | Shared |
| `legacy_id`, `legacy_metadata`, `calendar_uid` | Migration/recovery/calendar identity | Shared |

The standalone venues blueprint has shared `name`, `street`, `street2`, `locality`, `region`, `postal_code`, `country`, `legacy_id` and `legacy_metadata`; `directions` is translatable Portable Text. Venue names and addresses are intentionally shared. Localized registration URLs, categories or images are not the current policy. A site requesting those changes needs a reviewed policy change, not a casual flag flip.

`createEventsCollectionBlueprint({ venueCollection: "locations" })` references existing locations. The exporter does not replace that collection. Migration checks the actual `events.venue.options.collection`; an explicit `venueCollection` must match it. It does not choose locations merely because a locations collection happens to exist while events references venues.

### Timed and all-day data are different representations

A valid timed field payload can look like:

```json
{
  "title": "Meeting",
  "all_day": false,
  "start": "2026-11-15T10:00:00.000Z",
  "end": "2026-11-15T11:00:00.000Z",
  "timezone": "Europe/Paris"
}
```

A valid two-day all-day field payload can look like:

```json
{
  "title": "Festival",
  "all_day": true,
  "start_date": "2026-11-15",
  "end_date": "2026-11-16",
  "timezone": "Europe/Paris"
}
```

These examples are content **field data**, not a complete invocation of a site-specific core content tool. Use the actual core tool/API envelope when creating content. Both fields of an all-day range are inclusive. That second example emits an ICS `DTEND;VALUE=DATE:20261117`. Do not store date-only values in core datetime fields. Switching `all_day` clears inactive date fields through the save patch.

`src/domain/native-validation.ts` centralizes schedule validation. It accepts D1 boolean representations `0` and `1`, checks real civil dates and clock values, normalizes valid timed offsets to UTC, and rejects invalid IANA zones. Compatibility with legacy wall-time input remains through the date normalizer. Full publication requires start and end, ordered dates, and valid recurrence/exception metadata.

Recurrence is a structured daily/weekly/monthly language with a finite `until`, optional interval and the existing monthly pattern options. It is **not arbitrary textual RFC RRULE support**. Timed recurring starts require minute precision because recurrence IDs use original local `YYYY-MM-DDTHH:mm`. All-day recurrence IDs use `YYYY-MM-DD`. DST gaps are skipped; ambiguous wall times use the earlier offset. Preserve and communicate these semantics.

### Occurrence schedule and occurrence copy are separate

Shared `exceptions` may modify schedule/domain fields such as start/end, all-day flag, timezone, attendance mode, virtual URL, event status, external/image values and categories. It may cancel an occurrence. It may not carry translated title, description, location or organizer copy.

Localized `occurrence_content` contains those four editorial override fields, indexed by the original recurrence ID. Exception override keys follow the domain's camelCase names, not the collection's snake_case names; inspect the types and validation before generating payloads.

Migration separates existing legacy mixed overrides into these two fields. Categories are shared, including occurrence-level category changes.

If a published shared schedule change makes another language's editorial recurrence ID obsolete, that localized copy stays stored. Expansion ignores it until the recurrence ID matches again. Publication and unrelated editorial edits may proceed. Explicit edits to `occurrence_content` must refer to currently scheduled occurrences. Do not delete orphaned copy automatically or make every subsequent English publication fail until it is manually removed.

## 4. Lifecycle hook repairs

`src/hooks/content-hooks.ts` registers `content:beforeSave`, `content:beforePublish`, `content:beforeSchedule` and `content:beforeDelete`.

The important installed-host contracts are:

1. Before-save receives a patch, not necessarily the complete event. Editorial-only patches pass through. A schedule patch is merged with the current row/latest editable revision for validation. The hook returns a patch; it does not replace all content with the current live row.
2. Core inherits shared fields into a new translation **after** this hook. A new row with no nonempty schedule dates is allowed to remain incomplete. Full publication/scheduling validation is the final guard. Do not require complete dates in every translation-create patch.
3. `listRevisions(..., { limit: 1 })` returns an array in the installed API. The implementation uses the latest editable revision rather than validating a draft patch against stale live values.
4. `calendar_uid` and `legacy_id` cannot be changed after creation. They are identity fields, not editorial fields.
5. Save rejection uses the supported sandbox hook-result envelope with `SAVE_REJECTED` and a reason. Ordinary thrown exceptions previously lost the useful reason at the sandbox boundary. Do not replace this with an untested throw-only implementation.
6. Publication and scheduled publication validate the complete content data. If a venue is referenced, its ID must resolve in the schema's referenced collection and that venue must be published.
7. Non-event collections return immediately. Eventual does not impose event validation on locations, venues, posts or unrelated content.
8. Before-delete snapshots the existing published calendar state while it still exists. Matching tombstones are derived from committed state during reconciliation. A failed or uncommitted delete must not send cancellation notifications.

Unused deferred after-hooks were removed. Do not add an after-save background RPC merely to mark calendar data dirty without proving its runtime lifetime and correctness. Feeds already reconcile committed publications.

## 5. Migration engine repairs and exact guarantees

`src/domain/migration.ts` was substantially rewritten. Its route is `mcp/transfer/migrateToNative`; its MCP tool name is `migrateToNative`. Both use `plugins:manage` through the production dispatcher. Anonymous and Editor requests were tested as 401 and 403 respectively. Calling the migration function directly in a unit test is not an authorization test.

### Scan, schema and payload correctness

The original migration used a `9999-12-31` feed-style scan bound that rolled into an extended year and excluded ordinary events. Migration now pages raw legacy storage, venues first and events second. It includes past-starting recurring series and drafts. It does not use a public upcoming-event query as its migration source.

Before writes, migration checks native APIs, schemas, unique/indexed `legacy_id`, JSON `legacy_metadata`, required event fields, the venue reference target and the requested locale's canonical BCP 47 syntax. It fits payloads to the actual target schema and checks required target fields. Existing locations receive common name/title/address aliases supported by the mapper; arbitrary required custom fields are not magically populated.

Missing venue fields are normalized safely. A missing referenced venue produces an item error; it does not fall back to an invalid legacy venue ID. Explicit mappings must resolve in the configured collection. A published event requires a published mapped venue. Referenced legacy media must exist.

Empty descriptions become empty Portable Text arrays. Original event descriptions/exceptions, timestamps and organizer IDs are retained in event `legacy_metadata`; the entire original event remains in legacy storage. Venue `legacy_metadata` preserves the venue source row. Native core creation/update timestamps are not backdated to pretend the migration was an original native creation.

Legacy organizers are retained and copied into `organizer_details` snapshots when referenced. This does **not** create a new native organizers collection or establish a live native organizer relationship. If the site later needs centrally editable native organizers, that is an additional migration design.

Published legacy events are explicitly published with the versioned core API. Draft events stay drafts. Legacy venue records do not have the event publication flag; newly migrated venues are explicitly published so published events can reference them. Existing native venue publication remains relevant and is not bypassed.

### Identity, concurrency and recovery

Real execution acquires a five-minute KV lease and renews it during processing. Unique legacy IDs and a durable ledger identify generated IDs. An intent token is persisted before creation and copied into native `legacy_metadata.migrationToken`, allowing recovery when a create succeeded but the response or following ledger update was lost.

Ledger state progresses through `creating`, `created` and `complete`. An interrupted item with a matching token can resume publication. A completed record is not overwritten or republished just because the legacy source still says published. An editor who intentionally unpublished a migrated record keeps that decision. If a ledger points to a deleted native item, migration reports an error requiring explicit restoration rather than creating a replacement from old data.

Do not delete migration ledger keys or unique identity fields to make a retry appear successful. Do not infer that `already_exists` always means no work happened: the accompanying `action` can be `resume_publication`. Mapped or already-resolved venue result rows may omit `action`; consumers must accept optional fields.

Native event identity also belongs to its migration locale. Rerunning the same source into a different locale is not how to create translations. Use core translation creation after migration.

### Dry-run is a read-only structural preview

Input options are `locale`, `venueCollection`, `dryRun`, `venueMapping`, `cursor`, and `limit`. Defaults are locale `fr`, dry-run off, and limit 25; limit must be 1–100. `venueMapping` values must be nonempty native ID strings and the MCP schema limits the object to 1,000 properties.

Example preview for a site whose reviewed schema references locations:

```json
{
  "dryRun": true,
  "locale": "fr",
  "venueCollection": "locations",
  "limit": 25,
  "venueMapping": {
    "legacy-hall-id": "ACTUAL_EXISTING_NATIVE_LOCATION_ID"
  }
}
```

Replace the example mapping with actual IDs or omit `venueMapping`. Never execute with the placeholder text shown above.

Preview writes neither native content nor migration KV state. It returns planned payloads, known mappings, errors and warnings. New `nativeId` values are empty because core has not assigned IDs. `planned:<legacy-id>` references represent venues planned for creation; they are not valid IDs to persist or send directly to core.

The preview uses the same structural/schema/schedule/media/dependency checks, but it cannot execute other plugins' policies or predict concurrent changes and generated IDs. The exposed API does not provide a configured-locale preflight, so configured locale acceptance must be checked operationally and during core execution. A valid BCP 47 locale is not proof that the site has enabled that locale.

**Correction to the original milestone claim:** dry-run no longer promises exact future IDs or guaranteed successful execution. That original promise was incompatible with the actual native API.

### Result and cursor interpretation

The result has `ok`, `dryRun`, `locale`, `venueCollection`, `venues`, `events`, optional `nextCursor`/`error`/`warnings`, and `summary`. Each row has a status such as `planned`, `migrated`, `already_exists` or `error`, with optional `action`, `payload` and error details. `action` distinguishes `create`, `resume_publication` and `none` where supplied.

Summary counts apply to **this invocation**, not the whole source database. `migratedEvents`/`migratedVenues` count newly migrated rows; they do not count every existing item or publication recovery. Aggregate results across all pages yourself.

`nextCursor` is opaque operational state binding phase, storage cursor, locale and venue collection. Preserve it verbatim and keep locale/collection consistent. Restart execution without a cursor after preview; follow execution's own cursors. Never use the preview's final cursor as the first execution cursor, because that would skip earlier planned pages.

Item failures can coexist with successful writes and an advanced cursor. No batch-wide rollback occurs. A batch-level reconciliation error can also occur after rows have been written. Inspect both top-level and per-item errors. Save the responses. Once the cause is corrected, rerun from the start or an appropriate earlier execution point; completed identity records make a full restart safe without overwriting them. Do not assume a false `ok` means nothing changed.

## 6. Native source, adapters and public feeds

New repair modules `src/domain/native-source.ts` and `src/domain/native-calendar.ts` consolidate source and calendar behavior.

Native discovery checks collections before reading content. Published native listing uses correct core publication metadata and follows pages of up to 100 rows. Repeated/missing cursors fail explicitly. A 130-row regression confirms that records beyond the first page are read. Invalid published native events fail the server source rather than silently disappearing or triggering legacy fallback.

`nativeEntryToEventRecord()` supports genuine core ContentItems, Astro Live Content entries and flat/wrapped legacy records. A core item uses its CMS ID; a Live entry can have a slug as its outer ID while `data.id` holds the CMS ID. It preserves locale/group, timestamps, publication/business status, native images, public URLs, slugs, organizer details and rescheduling metadata. It does not mutate caller inputs.

Legacy `published` controls legacy visibility independently of its business status. A published legacy cancelled/postponed/rescheduled event must not accidentally become a core draft because its status name is not `published`.

Native venue resolution uses the actual referenced collection, not combined venues/locations maps with ambiguous IDs. Targeted reads run in batches of 20 and only published venues are exposed. Native public URLs and missing image URLs are hydrated using core APIs. The adapter tolerates heterogeneous address fields without converting objects into `[object Object]`.

Both server feeds select one published sibling per translation group. Canonical locale matching is exact: `en` is not an automatic match for `en-GB`. With no requested locale, selection is deterministic by locale then ID. In non-strict mode, an unavailable requested translation uses the deterministic fallback and prefixes its title with the source locale, for example `[EN]`. Strict mode omits untranslated active entries.

Category filtering happens **after** occurrence overrides. Otherwise an event whose exception moves an occurrence into a category would be filtered out before expansion. This behavior is covered across the expansion helper and server feeds.

Public endpoints remain:

```text
GET /_emdash/api/plugins/eventual/publicEvents?from=2026-11-01&through=2026-11-30&locale=fr&strict=true
GET /_emdash/api/plugins/eventual/calendar?locale=fr&strict=true
GET /_emdash/api/plugins/eventual/calendar?locale=en&category=Music
```

The JSON route uses EmDash's response envelope; `fetchPublicFeed()` handles it. Its date range is inclusive and limited to 366 days. The calendar covers UTC today through 365 days ahead, inclusive. Invalid calendar locales return 400; unavailable or excessive calendar work returns 503 with `no-store`, not a partially successful feed. Calendar responses may be cached for five minutes; JSON uses a shorter route cache.

## 7. Calendar identity, updates and cancellations

### Stable identity

For native untranslated/multilingual groups, `eventUid()` uses the group plus original occurrence identity. The `eventual-` prefix is applied consistently, eliminating an earlier potential alias between differently named groups. Opaque parts are encoded and UID text is escaped. Host normalization prevents unsafe control/content-line characters.

For migrated events, stored `calendar_uid` preserves the legacy base UID even though the native ID changes. Recurrence suffixes are added to that preserved base. A shared field carries this identity to translated siblings. The configured calendar host is pinned in KV, so later requests through aliases do not change identity.

The feed emits **expanded VEVENTs**, not arbitrary source RRULEs. The original occurrence's recurrence ID remains its identity when that occurrence moves. Do not regenerate a moved occurrence's UID from its new date.

Identical UID values across languages establish shared logical identity in the output. They do not guarantee that a particular calendar application will deduplicate two separately subscribed calendar feeds. That behavior must be tested with actual clients.

### SEQUENCE

The prior timestamp-in-milliseconds approach exceeded RFC integer limits. Native groups now have durable logical sequence counters. They advance when the committed published group fingerprint changes, including resolved published venue changes. Saving a pending schedule draft alone does not change the live sequence.

New native groups start at zero. Migrated groups initially use a seconds-based value to exceed valid older seconds-based updates; subsequent changes increment it. Values remain within signed 32-bit bounds. Clearing calendar state can therefore regress update identity/counters and must not be used as routine cleanup.

Clients that already cached the old invalid millisecond values may ignore new valid smaller values. Server code cannot force every client to repair that cache. Test the affected clients and document whether re-adding a subscription is necessary.

### Committed-state cancellation reconciliation

Reconciliation reads current published rows while holding a KV lease, groups them, resolves venue context, expands bounded occurrences, and compares snapshots. Removed occurrences create matching-UID `STATUS:CANCELLED` tombstones. Unpublishing the last sibling cancels the logical event; removing only one language does not cancel the still-published group in general feeds.

Strict feeds for a removed language receive scoped cancellation records. Category feeds that lose membership receive category-scoped cancellation records while the event remains active elsewhere. Restoration reuses the UID and suppresses stale cancellation output for active entries. Duplicate cancellation records retain the newest cancellation. Past occurrences that simply leave the feed window are not treated as fresh future cancellations.

Native lifecycle history is stored in KV. Legacy `calendar_cancellations` storage is retained and consulted. Legacy tombstones without category metadata are omitted from category subscriptions because their category scope cannot be established safely.

Cancellation retention is 366 days. A client absent longer than that may not receive historical removal records. Group identity/sequence state is retained beyond that window. More than 10,000 historical group states requires a reviewed maintenance strategy; blind KV deletion is not acceptable.

### Serialization

The existing CRLF content-line termination and TEXT escaping were retained and checked independently. Folding measures UTF-8 octets, caps physical lines at 75 octets and counts the continuation space. Non-ASCII characters are not split midway through encoding. Text escapes backslash, newline, comma and semicolon; category items are escaped individually.

Inclusive all-day ends are converted to exclusive calendar ends. Zero-duration timed events omit `DTEND`. `ical.js` tests parse actual generated output and verify values; a self-referential string test is no longer the only evidence.

The output cap is 4 MiB. This is a publication feed with `METHOD:PUBLISH` and event/tombstone statuses, not an email invitation transport. Actual update/cancellation handling remains a client acceptance task.

## 8. Portable Text, Astro and package repairs

### Portable Text conversion

The converter now produces deterministic block/span/mark keys and supports common paragraphs, headings, ordered/bullet list items, blockquotes, emphasis, inline code and HTTP(S)/mailto links. Empty input becomes `[]`. Plain-text extraction tolerates malformed/null trees and can append link destinations.

It is not a complete CommonMark or HTML-to-Portable-Text parser. Complex nested syntax, tables, code fences and custom embedded blocks require editorial review. Unsupported non-text blocks are omitted from calendar descriptions. Original Markdown remains recoverable in legacy storage and metadata. Do not describe conversion as universally lossless or claim an arbitrary Portable Text-to-Markdown round trip.

The public feed uses a plain-text description. A site that wants the full rich description should render native Portable Text from native content rather than attempt to recreate it from that feed string.

### Astro behavior

`expandEventOccurrences()` normalizes supplied entry shapes, expands recurrence, applies occurrence copy and categories, and accepts supplied venue records. It is a pure helper: it does not perform CMS media hydration or server-side sibling selection itself. If using native Live Content directly, select the appropriate published language rows and supply venue/media/public-URL context. Do not pass every translation sibling and expect this helper to silently choose the server feed's locale policy.

`EventList.astro` takes an explicit locale, otherwise the page's Astro locale, otherwise the entry locale. Display formatting is separate from machine dates. Machine URL parameters force the Gregorian calendar and Latin digits, avoiding Arabic digits or Thai Buddhist years in API queries. Native public URL takes precedence over slug/ID fallback. All-day display uses UTC to prevent civil dates shifting backward in another zone.

JSON-LD preserves attendance modes, physical/virtual places, structured addresses, native images, organizers, URLs and rescheduling metadata. Public descriptions already contain plain text; they are not run through a second Markdown/HTML stripping pass. Serialized Portable Text is decoded only when it is recognizably a typed block array. Literal `<example>`, `**notation**` and plain JSON text remain intact in the tested path. `serializeJsonLd()` escapes `<` at the HTML script boundary.

### Distribution and release artifacts

The original source package exported Astro files while omitting their new source dependencies. The package now includes required `src/domain`, `src/schema`, storage/public-event source and appropriate distribution files. `eventual/schema` is exported. Old sandbox tarballs are not swept into the npm package by a broad dist directory rule.

`scripts/verify-packed-astro.mjs`, exposed as `npm run test:package`, builds the source package, packs it, installs that tarball into an independent consumer, and builds/verifies en/fr/ar/th pages. This check is in CI. It tests the actual packed dependency graph, not merely repository-relative imports.

Version is locally bumped from 0.11.1 to 0.12.0 without a Git tag. `ical.js` was added as a development test dependency; runtime dependencies remain the existing blocks/Zod contract. Do not assume 0.12.0 is available in a registry or on public npm. The sandbox registry bundle and the source package needed by Astro are separate installation concerns.

README, registry installation/changelog text and screenshots were updated for native editing. Obsolete custom-editor screenshots were removed from the manifest; retained visitor screenshots are not proof that a target site's native integration has been accepted.

## 9. Permissions, state and resource limits

The current declared capabilities are:

| Capability | Why it is present |
| --- | --- |
| `content:read` | Native feeds, references and migration identity lookup |
| `content:write` | Native migration creation |
| `content:publish` | Explicit publication of migrated content |
| `content:revisions:read` | Save validation against editable revisions |
| `schema:read` | Native authority, schema compatibility and reference target discovery |
| `hooks.content-policy:register` | Publication and scheduling policy registration |
| `media:read` | Native media hydration and migration/media validation |
| `media:bytes:read` | Retained legacy public media serving |

There is no `schema:write` capability and no outbound allowed host. Do not remove publication/revision/policy capabilities just because the original prompt listed only content read/write and schema read. Conversely, do not add schema write or outbound networking to hide a deployment precondition.

The admin companion requires `content:edit_any`; management/MCP/transfer routes require `plugins:manage`. New capabilities change the installation consent contract and must be handled through the normal plugin update workflow.

State that must survive migration/deployment includes:

| State | Purpose |
| --- | --- |
| `state:eventual-calendar-host` | Pinned identity host |
| `state:eventual-calendar:<encoded-group>` | Sequence, occurrence snapshots and scoped cancellation history |
| `state:eventual-calendar-lock` | Reconciliation lease |
| `state:eventual-migration:<collection>:<encoded-legacy-id>` | Generated-ID/recovery ledger |
| `state:eventual-migration-lock` | Migration lease |
| Legacy events/venues/organizers/cancellation storage | Source preservation, compatibility/export and cancellation continuity |

Back up durable plugin state as well as content/media before site work. An export tool that pages event/venue/organizer records is not, by itself, a full content/media/KV/site backup.

Current bounds are 10,000 scanned event/native/cancellation records, 5,000 scanned legacy venues, 10,000 expanded occurrences, 1,000 active occurrences and 1,000 retained tombstones per native group, 4 MiB ICS output, 366 exception/editorial-copy entries, and migration batches of 1–100 source records. Native historical group-state storage is limited to 10,000 groups. Timezone formatter caching is bounded to 128 entries. Venue/media/public-URL resolution uses bounded concurrency.

These limits fail explicitly. They are not guarantees that processing the maximum will meet a particular Cloudflare plan's CPU or latency budget. Migration also reads bounded existing native indexes each invocation, so a small write batch is not constant total work as the target grows. Measure the intended site; optimize from evidence without removing completeness or identity checks.

## 10. Verification performed and how to reproduce it

The final plugin suite passed **170 tests across 24 files**. The final tiny plain-text JSON-LD adjustment and nonsemantic predicate cleanup were followed by **14 targeted tests across two files**, final TypeScript checking and packed consumer verification. The entire 170-test suite was not rerun after that tiny adjustment; do not misstate the chronology. No implementation changes were made while writing this handoff.

| Check | Recorded result |
| --- | --- |
| Manifest validation and full plugin suite | 170 tests, 24 files, passed; 116.84 seconds in the recorded full run |
| Final Astro/schema targeted run | 14 tests, 2 files, passed |
| `npm run typecheck` | Passed |
| `npm run test:tooling` | 6 tests passed |
| `npm run profile` | 2 deterministic storage-call budget tests passed |
| `npm run test:package` | Packed 0.12.0 consumer built and verified en/fr/ar/th |
| Astro example `npm run check` | 23 files; zero errors, warnings or hints |
| Astro example `npm test` | 29 tests across 5 files passed |
| Astro example `npm run test:page` | Build/render checks passed |
| Exported native seed validation | Passed installed CLI validation; typed blueprint contract tests passed |
| `npm run bundle` and `npm run budget` | Passed |
| `git diff --check` | Passed |

The final sandbox archive contained backend **81,938 bytes**, manifest **46,444 bytes**, README **6,183 bytes**, total **134,565 bytes** across three files. Project budgets are 112,640 bytes per file and 225,280 total; hard limits are 131,072 per file and 262,144 total. Rebuild before any release: changes to documentation/manifest can change archive size. The CLI publish operation rebuilds, so a local earlier tarball is not automatically the uploaded artifact.

Key regression coverage includes production EmDash/D1 publication, partial updates, all-day content, translation inheritance, empty-native authority, idempotency, intact legacy storage, bounded batching, interrupted create/publish recovery, true concurrent migration calls, deleted/explicitly unpublished migrated items, recurring cancellation/restoration, removed strict locales and categories, venue-address sequence changes, native media, admin/MCP gating, scheduled publication dependencies and orphaned localized copy.

A native annual workload test expands five timed daily series into **1,830 occurrences**, including DST transitions. It verifies correctness and output bounds. The separate Node profile verifies call budgets. Neither is a measured live-site latency benchmark.

Retained legacy occurrence/organizer tests were moved from the retired GUI path to MCP. GUI-only tests were retired with that feature; this is an intentional coverage change, not a claim that every original GUI interaction still exists. Vitest workers are serial to prevent shared dist writes racing on Windows, and the timeout is 15 seconds for D1 host setup/policy RPCs. Preserve those settings unless you separately demonstrate safe alternatives.

Run these commands sequentially from the repository before a release:

```powershell
npm ci
npm run validate
npm run typecheck
npm test
npm run test:tooling
npm run profile
npm run test:package
npm run bundle
npm run budget
git diff --check
```

Then, from `examples/astro-events`:

```powershell
npm ci
npm run check
npm test
npm run test:page
```

Do not run multiple plugin build/bundle/Vitest commands concurrently; they share build artifacts. CI has UTC and America/New_York jobs configured. Those jobs were not run on remote CI during this session; a configured matrix is not evidence that both remote jobs passed.

Local detailed logs and baseline artifacts are in ignored `reports/`, including `modernization-audit-2026-10-06.md`, `final-tests.log`, `final-astro-tests.log`, `tooling-tests.log`, `final-profile.log`, `final-package.log`, `packed-astro.json` and `final-bundle.log`. The baseline `runtime-audit` tests assert the old defects as observations. Do not run those as acceptance tests or modify repaired code to satisfy their obsolete expectations. The normal suite excludes reports.

## 11. What remains: execute in this order

### A. Inspect and prepare the actual target site

1. Identify the site checkout, runtime, actual EmDash/plugin versions, environment and database. Do not assume that a similarly named local folder is the intended production site.
2. Confirm enabled/default locales, canonical URL, installed plugin trust/capabilities, existing events/locations schemas, required location fields, media availability and native route conventions.
3. Obtain a complete backup covering native content, plugin storage/KV, schema and media. Record the pre-migration legacy counts and sample calendar UIDs. A data-only Eventual export is insufficient for full rollback.
4. Capture representative published, draft, all-day, timed recurring, cancelled/postponed/rescheduled, media-linked, venue-linked and complex-description records. Include exceptions that change categories and editorial copy.
5. Plan the authority cutover described in section 2. Use staging first. Schema removal, row deletion or state reset is not a casual rollback procedure; establish the site's rollback plan before applying changes.

**Completion evidence:** site/version/schema/locale inventory, backup location and restoration procedure, baseline counts and UID samples, written cutover plan.

### B. Review and apply the schema through the site's supported workflow

From this repository, export to a new file; the exporter intentionally refuses to overwrite an existing file:

```powershell
node scripts/export-native-schema.mjs --venue-collection locations --output reviewed-eventual.seed.json
npx emdash seed reviewed-eventual.seed.json --validate
```

For a new standalone venues collection, omit `--venue-collection locations`; that export includes events and venues. For existing locations, it emits events only. Add compatible shared unique/indexed `legacy_id` and JSON `legacy_metadata` fields to locations. Review required fields and mapper aliases; if unsuitable, pre-create valid native locations and provide mappings. Review translatable flags and scheduling support explicitly.

The seed contains defaultLocale `fr`, matching the intended BBHC default. Review it for the actual target site; it is not a command to silently replace another site's locale configuration.

Apply through the site's EmDash schema editor/MCP/applySeed workflow. A local SQLite CLI application requires the **actual** database path. The CLI's default `./data.db` is not necessarily the site database. Do not point a local SQLite command at a Cloudflare/D1 site and declare success. Eventual itself cannot apply schema because it has no schema-write capability.

**Completion evidence:** validated reviewed seed, actual applied field definitions/reference collection, enabled site locales, expected core editor and route behavior.

### C. Preview every migration batch, then execute every migration batch

1. Call `migrateToNative` with `dryRun: true`, explicit canonical locale, correct venue target and limit 25. Supply reviewed mappings if needed.
2. Save the entire response and follow `nextCursor` with the same options until absent. Do not inspect only the first page. Aggregate the per-invocation counts and inspect all errors/warnings and payloads.
3. Resolve missing/invalid dependencies and descriptions that need review. Re-preview affected records. Confirm that source IDs map to the intended target locations and media.
4. Begin real execution **without the preview cursor**, with `dryRun: false` and the same reviewed locale/collection/mappings. Follow the execution's own `nextCursor` until absent, saving every result.
5. On failure, inspect what succeeded before retrying. Do not clear ledgers or delete successfully migrated rows. Correct the cause, then rerun from the start or an appropriate earlier execution point. If a migrated row was intentionally deleted, restore it explicitly or escalate the desired policy.
6. Run a complete second execution pass from the start. It should preserve counts and IDs and report existing items; completed items should not be overwritten or republished.
7. Verify legacy rows are intact. Reconcile every legacy ID to a native item, an explicit approved mapping or a documented error/exclusion. Compare publication, recurrence, exception copy, venue/media and UID behavior with the baseline.

**Completion evidence:** complete preview/execution logs, aggregate reconciliation table, no unexplained skipped records or dangling references, stable second-run counts, preserved legacy source, generated native IDs and UID continuity.

### D. Accept native editing, LinguaDash and public site behavior

Test these in the actual native editor and actual LinguaDash installation; unit fixtures cannot substitute for the translation plugin:

| Action | Required outcome |
| --- | --- |
| Create an incomplete draft | Allowed; full publication remains blocked until valid |
| Edit a published title/description as a draft | Live feed stays unchanged until publication |
| Create a second-language translation with editorial fields | Shared schedule/reference/identity inherits correctly |
| Translate Portable Text with LinguaDash | Intended localized fields translate; shared fields/identity do not |
| Publish a shared schedule change | Published siblings/feeds follow core synchronization without losing localized copy |
| Change a schedule that orphans translated occurrence copy | Copy stays stored; current feeds and ordinary editorial publishing continue |
| Edit an explicit occurrence-copy payload | Currently invalid recurrence IDs are rejected |
| Schedule future publication | Valid draft schedules; invalid schedule or unpublished venue is blocked |
| Restore a revision | Publication, schedule and calendar changes follow actual core lifecycle |
| Use media and physical/virtual/hybrid venues | Native editor, public pages and JSON-LD agree |
| Request missing exact locale | Non-strict fallback is visibly prefixed; strict active feed omits it |
| Request a language-region variant | Exact matching behavior is understood and accepted |
| Open public event URLs | Site routes resolve locale/slugs/occurrence query dates correctly |
| Manage events through old plugin paths | Native installation directs to core; legacy management is gated |

Review actual complex Markdown and decide whether the current subset is acceptable. If it is not, add a properly scoped parser/renderer improvement with source recovery retained and new tests. Do not declare that this session already delivered full CommonMark.

JSON `recurrence`, `exceptions` and `occurrence_content` are native fields, not a recreated recurrence form. Assess core editor ergonomics on the site. A richer companion UI, if desired, must read/write native fields and preserve core translation/revision rules; rebuilding the legacy editor is not the solution.

**Completion evidence:** native and LinguaDash acceptance results, publication/revision/scheduling screenshots or logs, route checks, explicit complex-content decisions.

### E. Accept existing and new calendar subscriptions in real clients

Use Apple Calendar, Google Calendar and Outlook where those are actual target clients. Include an already subscribed legacy feed and a fresh subscription. Record client/version, URL, fetch timing and emitted UID/SEQUENCE before and after each action.

Test title translation/change, shared time changes, a moved occurrence, cancellation/restoration, recurring rule removal, last-sibling unpublication/deletion, one-sibling removal with strict and non-strict locale feeds, category membership removal/restoration, venue-address changes and migration UID continuity. Check that active entries update, removed future entries disappear or become cancelled appropriately, and restored entries reuse identity.

Account for server caching and each client's polling delay. Test two separately subscribed language feeds if cross-subscription deduplication is a product requirement. Do not infer client behavior solely from identical UIDs or a successful parser test.

If cached invalid legacy SEQUENCE prevents updates, document and test a subscription reset. Do not reintroduce millisecond SEQUENCE or change all UIDs merely to mask one client's cache issue.

**Completion evidence:** a per-client behavior matrix with any reset instructions and remaining incompatibilities. If a client fails, preserve the exact feed sample and reproduction before changing serializer/lifecycle code.

### F. Measure the actual sandbox workload and manage state

Run native timed recurring workloads comparable to the target site's volume in its runtime/plan. Measure cold and repeated feed latency, CPU/RPC usage, concurrent locale/category requests and migration batch duration. Verify explicit errors rather than truncation at limits. Adjust batching or implementation only on evidence, preserving source completeness and stable identity.

Plan monitoring/maintenance for cancellation retention, scan limits and historical group state. There is no automatic safe garbage-collection workflow for old group identity state in this session. Any such workflow must avoid sequence regression and client identity changes.

**Completion evidence:** measured workload and concurrency report for the actual environment; documented state retention/maintenance ownership.

### G. Prepare and publish the reviewed release

1. Review the whole working tree, including the original modernization files and new repair files. Commit appropriate source/tests/docs through the user's requested Git workflow; do not accidentally omit untracked new modules.
2. Run the reproducible checks above and confirm remote CI in both configured timezones. Do not infer remote CI success from local tests.
3. Review release notes for the native authority cutover, generated-ID preview behavior, editor retirement, new capabilities, migration batching and client caveats.
4. Use the normal EmDash registry publishing workflow and its applicable publishing skill when publication is authorized. Verify the actual rebuilt signed release/artifact, installation/update consent and exact published version. No signed release was created in this session.
5. Arrange the source package consumed by Astro separately from the sandbox plugin installation. A local `eventual-0.12.0.tgz` test artifact is not evidence that the source package is publicly available.
6. Deploy the site's reviewed integration after staging acceptance, then repeat essential route, feed and migration-count checks in the deployed environment.

**Completion evidence:** commit/CI references, registry release identity/version and installation verification, source-package availability, deployment identifier and post-deployment checks.

## 12. File map and instructions for the next agent

Use this map to locate the current implementation rather than rebuilding a second version from the original prompt:

| Concern | Files |
| --- | --- |
| Native schema/provisioning | `src/schema/blueprint.ts`, `scripts/export-native-schema.mjs` |
| Schedule validation/lifecycle | `src/domain/native-validation.ts`, `src/hooks/content-hooks.ts`, `src/plugin.ts` |
| Native authority/selection/hydration | `src/domain/native-source.ts`, `src/routes/public-events.ts`, `src/routes/public-media.ts` |
| Calendar durable state/serializer | `src/domain/native-calendar.ts`, `src/domain/icalendar.ts`, `src/routes/calendar-feed.ts` |
| Migration/management/auth | `src/domain/migration.ts`, `src/transfer.ts`, `src/mcp.ts`, `src/mcp-schemas.ts` |
| Normalization/recurrence/Portable Text | `src/domain/event-expansion.ts`, `src/domain/venue-adapter.ts`, `src/domain/portable-text.ts`, `src/domain/date-time.ts`, `src/domain/recurrence.ts`, `src/domain/event.ts`, `src/domain/venue.ts`, `src/storage.ts` |
| Native companion admin | `src/native-admin.ts`, `emdash-plugin.jsonc` |
| Astro consumers | `astro/feed.ts`, `astro/schema.ts`, `astro/EventList.astro`, `astro/event-list.ts`, `astro/event-details.ts` |
| Distribution/CI | `package.json`, `package-lock.json`, `scripts/verify-packed-astro.mjs`, `.github/workflows/ci.yml`, `vitest.config.ts` |
| Regression tests | `tests/migration.test.ts`, `tests/content-hooks.test.ts`, `tests/native-source.test.ts`, `tests/icalendar-parser.test.ts`, `tests/astro-ergonomics.test.ts`, `tests/blueprint.test.ts`, plus retained expansion/Portable Text/multilingual/legacy/tooling tests |
| Handoff/setup/release text | This report, `docs/native-modernization.md`, `docs/modernization-verification.md`, README and registry installation/changelog docs |

Your next task is **site-specific acceptance and release preparation**, beginning with inventory and backups, not another generic rewrite. If acceptance reveals a reproducible defect, add a regression at the appropriate boundary, make the smallest compatible repair, and rerun the affected checks plus final release checks. If the desired feature changes the policy described here, identify that change explicitly before implementing it.

Do not mark the work complete merely because TypeScript passes, a mocked `create()` returns a chosen ID, the first native page is nonempty, a dry-run says planned, or a calendar parser accepts the file. Completion requires the actual schema/migration reconciliation, native/LinguaDash workflow, client acceptance, measured runtime suitability and reviewed release/deployment evidence listed above.
