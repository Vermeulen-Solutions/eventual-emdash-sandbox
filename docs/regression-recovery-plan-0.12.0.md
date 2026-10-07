> **Historical record:** Current behavior is documented in [0.13.0 release notes](release-notes-0.13.0.md) and the [breaking upgrade guide](upgrade-0.13.0.md). Host-package, hidden-field and publication-status statements below describe superseded work, not current instructions.

# Eventual 0.12 regression recovery: implementation handoff

**Date:** 7 October 2026. **Repository:** `C:\dev\eventual-em\eventual-emdash-sandbox`.

**Compared:** the pre-modernization implementation at `a08d21d^`, modernization commit `a08d21d`, and current local HEAD `97cba825a355184d58b61a455e30403e54e7721f`.

**Deliverable:** a source-based regression inventory and implementation plan. No application repairs, live-site writes, deployment or release were performed while preparing this document. The working tree initially contained an untracked `eventual-0.12.0.tgz`; preserve it unless the user requests otherwise. Registry publication/deployment status was not independently established in this review.

## 1. Correction to the previous handoff

The prior repair made real improvements to native data correctness, migration recovery, publishing, multilingual calendar identity and package distribution. It also retired Eventual's functional editor without providing equivalent domain controls. That removed normal editor tasks. Describing recurrence/occurrence UI as future ergonomics work understated a release-blocking product regression.

**The product requirement is now explicit: preserve the native architecture and restore usable event-management workflows.** Editors must not hand-author JSON to create recurring schedules, cancel/reschedule/restore occurrences, select reusable organizers or edit categories. Backend correctness is necessary, but it is not proof of feature parity.

This document supersedes the UI-retirement and “site acceptance next” prioritization in [modernization-agent-handoff.md](modernization-agent-handoff.md). First repair the missing workflows and integration gaps, then do site acceptance and release work. Preserve the earlier report's valid native API, migration, publication and calendar-identity contracts.

The recovery must not consist of reverting `a08d21d`, restoring native-site writes to `ctx.storage.events`, changing only the README, or hiding the JSON controls while leaving no replacement. Nor should a bundle-size problem be solved by deleting another user workflow.

## 2. Evidence and classification

This review inspected source, Git differences and installed EmDash 1.0.1/plugin CLI 0.13.1/blocks 1.0.1 contracts. It did not inspect a running native admin screen or newly execute the 170-test suite. Confirmed findings below describe reachable code paths or explicit data contracts; browser-dependent questions are identified separately.

The old `src/admin.ts`, `src/occurrence-admin.ts`, `src/organizer-admin.ts` and `src/description-admin.ts` are still present. Their existence is not proof that the old functionality ships. `src/plugin.ts` now imports `src/native-admin.ts`, and the manifest registers only the companion events page.

Priority means: **P1** significant workflow/data/integration regression to resolve before claiming feature parity; **P2** degradation or compatibility gap requiring an explicit remedy or accepted boundary. It does not assert a newly discovered P0 security vulnerability.

### Confirmed workflow regressions and native integration gaps

| ID | Priority | Before | Current consequence | Evidence |
| --- | --- | --- | --- | --- |
| R01 | P1 | Friendly recurrence frequency, interval, weekdays and monthly-pattern controls | Native recurrence is a JSON field without an Eventual recurrence UI | `src/admin.ts` eventFormBlocks; `src/schema/blueprint.ts`; `src/native-admin.ts` |
| R02 | P1 | 90-day occurrence inspection with paging, original/effective dates, Cancel/Change/Restore | No reachable occurrence manager; schedule and localized exceptions are JSON | `src/occurrence-admin.ts`; old admin handlers; current native admin |
| R03 | P1 | Reusable organizer directory, picker, validated public website/contact links | No native organizers collection/reference/UI. Migrated organizer details are snapshots; organizer MCP routes are also gated | `src/organizer-admin.ts`; `src/schema/blueprint.ts`; `src/mcp.ts`; `src/domain/migration.ts` |
| R04 | P1 | Eventual MCP event/venue/organizer CRUD and occurrence inspection/mutation | Native schema causes all these routes, including read/inspection tools, to return `NATIVE_COLLECTIONS_ACTIVE`; tool declarations still advertise them | `src/mcp.ts` route wrapper; `src/mcp-schemas.ts` mcpTools |
| R05 | P1 | Changing a saved schedule automatically retained ten previous schedules and previousStartDate | Native save hook normalizes dates but does not call equivalent history logic. Existing migrated history survives, but new native changes do not maintain it automatically | `src/storage.ts`; `src/domain/schedule-history.ts`; `src/hooks/content-hooks.ts` |
| R06 | P1 | Event list with status/date filters, recurrence indicators, quick edit/duplicate/delete and paging | Companion is effectively navigation links. Core listing exists, but Eventual's domain listing/workflow is gone | `src/admin.ts` renderEvents; `src/native-admin.ts` |
| R07 | P1 | “Duplicate” produced an unpublished copy with exceptions/history excluded | Eventual has no reachable native duplicate command. Generic core duplication, if available, has not been verified against migration/calendar identity fields | `src/admin.ts` duplicate-event; `src/domain/event-data.ts` duplicateEventDraft; current admin |
| R08 | P1 | Transfer export/preview/import supported the managed event dataset | exportRecords still exports legacy tables, not current native edits. Native import is blocked, but preview still validates legacy imports and can report ready | `src/transfer.ts` importRecords and transfer/export |
| R09 | P2 | Default timezone and 12/24-hour preferences configured the editor/dashboard | Defaults now diverge: native schema uses Europe/Zurich while legacy setting may be another zone. Native widget ignores timeFormat; companion settings/feeds page disappeared | manifest settingsSchema; blueprint; native admin; old renderSettings |
| R10 | P2 | Date pickers, searchable IANA timezone selector, separate forgiving time input, conditionally relevant fields, schedule samples | Generic fields lack the equivalent Eventual schedule workflow: all-day dates and timezone are strings; inactive/technical fields have no Eventual presentation layer | old eventFormBlocks/timeZoneField/schedulePreview; blueprint |
| R11 | P2 | Categories entered as readable comma/newline text | Native categories is JSON, adding another raw-data task for editors | old categories text field; blueprint |
| R12 | P1 | Images served from stable publicEventImage URLs tied to legacy event visibility | That endpoint immediately returns 404 whenever native events schema exists. Previously stored/cached/hardcoded image URLs break after cutover | `src/routes/public-media.ts` nativeSchema guard; `src/domain/image.ts` |
| R13 | P1 | Public event descriptions retained rich Markdown/HTML source for existing frontend renderers | Native public adapter flattens Portable Text to plain text. Included example still renders the description string as Markdown, so native formatting/links are lost | `src/domain/event-expansion.ts`; example EventDescription.astro/markdown.ts |
| R14 | P1 | Existing event IDs supported links into the example's detail/export routes | Migration generates new CMS IDs and native public slugs. Example still builds ID-based URLs; old bookmarks are not mapped. New EventList publicUrl/slug semantics differ from the example resolver | migration; `astro/event-list.ts`; example calendar.ts and events/[id] routes |
| R15 | P1 | Applying a plugin update did not immediately remove the legacy editor; legacy feeds remained usable without provisioning native schema | Unmigrated installations now get an informational banner instead of an editor. Creating even an empty native events schema switches feeds/MCP immediately | native admin legacy branch; `src/domain/native-source.ts`; MCP gate |
| R16 | P1 | Up to 500 legacy occurrence exceptions supported | Native validator limits both schedule exceptions and localized copy to 366. Migration invokes it, so valid 367–500-item legacy series can fail migration | old admin exception limit; MCP/domain legacy validation; native-validation.ts |
| R17 | P2 | Dashboard widget showed formatted dates, timezone/all-day range and location | Current widget shows title plus raw start string. It also changes the window/count to the public JSON default and five items | old renderUpcomingWidget vs native-admin widget branch |
| R18 | P1 | Legacy venue deletion refused an assigned venue | Native beforeDelete handles events only. Equivalent protection against native venue deletion/unpublication is not implemented by Eventual; do not assume generic reference behavior matches the old safeguard | old admin/MCP venue deletion; hooks; native venue resolver |
| R19 | P1 | Product documentation described the actual Eventual workflows | Current README reuses screenshots/claims for the removed dashboard and organizer directory and adds unsupported yearly recurrence; release notes overstate client guarantees | README current Visual Tour/features; release-notes-0.12.0.md |
| R20 | P1 | Admin feature tests exercised normal editor actions | GUI parity assertions were removed or moved to MCP tests that still exercise legacy mode. Native tests assert a link-only admin and blocked tools, so they approve the regressions | Git diff tests/plugin.test.ts; tests/occurrence-plugin.test.ts; tests/migration.test.ts |

R07 and R18 do not assert that core has no duplication, bulk delete or reference safeguards. They establish that **Eventual has not supplied or verified equivalent semantics**, especially for UID/legacy identity and event-specific publication dependencies. Prove actual core behavior before relying on it.

### Incomplete repair paths and related risks, not all new regressions

| ID | Classification | Finding |
| --- | --- | --- |
| I01 | Pre-existing serializer defect left unfixed; new identity split exposed by native migration | The example's formatICalendar still uses `event.id@siteHost`, millisecond SEQUENCE and unconditional timed DTEND. The plugin subscription serializer uses stable native/migrated identity, logical sequence and zero-duration handling. The subscription fix did not repair individual downloads. |
| I02 | Native locale integration missing | Example list/detail/simple-list/.ics calls do not pass `{ locale, strict }`; calendarFeedUrl also omits them. Translated chrome can surround content selected by the server's default sibling policy. This is an unfinished multilingual integration, not proof that pre-0.12 had native translation support. |
| I03 | Current implementation risk to test | A generic editor may submit unchanged `occurrence_content` with a title edit. The hook treats field presence as an explicit copy edit, potentially rejecting preserved orphaned copy. Existing patch-only tests do not prove the real browser submission is safe. |
| I04 | Current implementation risk to test | Every calendar request takes a reconciliation lease; a concurrent request gets a busy error/503 rather than a cache snapshot. Multi-locale subscriptions can amplify this. Existing lease tests do not establish good live concurrency/latency. |
| I05 | Existing limitation, not a lost feature | The engine supported daily/weekly/monthly before and after modernization. Yearly frequency in the quoted proposal and current README is unsupported. Monthly interval 12 is not a general implementation of all yearly recurrence semantics. |
| I06 | Existing/partially improved limitation | Markdown conversion is a subset; full CommonMark and arbitrary non-text Portable Text-to-calendar conversion were not delivered. Keep original source recovery and test complex editorial content. |
| I07 | Policy change requiring explicit acceptance | Native feeds resolve only published venues; publication requires a published referenced venue. Valid dependency checks are useful, but editors need a usable way to publish/select dependencies and diagnose failures. Core media URLs also have core's availability policy, not necessarily the old event-scoped media policy. |
| I08 | Installed API constraint on the recovery implementation | `ctx.content.update(collection,id,data)` in installed core delegates directly to `updateDraftAware` without a revision precondition and without the normal beforeSave pipeline. `ContentWriteInput` declares fields/SEO, not an `_rev` update option. A read/check followed by this call is not atomic and must not be advertised as native editor-equivalent mutation. |

The statement “the recurrence engine is 100% intact” is too absolute. Its main daily/weekly/monthly algorithm remains; limits, validation, serving paths, identity and editor access changed. No source comparison can establish every edge case without acceptance coverage.

## 3. Important corrections to the proposed fix

### EmDash already exposes extension mechanisms

Installed EmDash 1.0.1 has:

- `PluginAdminConfig.editorPanels` and `editorActions` for saved-entry extensions.
- Host-attested `routeCtx.ui.entry` identity and locale for content-editor invocations.
- Bounded unsaved draft snapshots and `EditorDraftPatchEffect`, guarded by `admin.editor-draft:read` and `admin.editor-draft:patch` capabilities and explicit field selectors.
- `fieldWidgets` declarations and field `widget` assignments for supported custom rendering.
- Host ownership checks in `dispatchPluginEditorExtensionRequest`, plus CSRF/private-route authorization and stale-revision/draft-generation checks.

Relevant local sources: `node_modules/emdash/src/plugins/types.ts`, `manifest-schema.ts`, `http-route-dispatch.ts`, `editor-draft.ts`, `node_modules/@emdash-cms/blocks/dist/validation-CX9LT920.d.ts`, and the CLI manifest schema. These declarations are confirmed. A particular renderer configuration/new-entry interaction still needs a running proof.

Therefore, raw JSON is not an unavoidable consequence of native content. Build friendly native editor extensions over the canonical JSON, and share their domain commands with a functional companion dashboard.

**Default architecture for implementation:** canonical native JSON + friendly schedule/occurrence editor extension + native companion workspace. Do not introduce persistent recurrence scalar fields as the first solution. Two mutable representations create synchronization and upgrade hazards for migrated records, revisions, MCP writes and translation inheritance.

### Four scalar fields would not restore recurrence parity

If the native extension path cannot support an essential creation flow, use a documented fallback after the integration proof, not an unexamined rewrite. At minimum, a scalar fallback needs monthly pattern, monthly day, missing-day behavior, weekday position and weekday name in addition to frequency/interval/weekdays/until. It must not expose Yearly without implementing it.

Weekly JSON uses **`weekdays`**, not the `days` key shown in the quoted example. Correct example:

```json
{"frequency":"weekly","interval":1,"weekdays":["monday","thursday"],"until":"2026-12-31"}
```

Adding default frequency `none` to existing rows must not clear their migrated canonical recurrence. If a fallback is necessary, define a one-way compiler, patch-aware precedence, legacy backfill, readback for canonical API writes, conflict handling and explicit null/clear semantics. Test all of those before applying schema changes.

### “Update native in the background” is not a publication model

An occurrence button must not quietly publish a draft or overwrite pending edits. Native panel interactions should return a patch to the **current editor draft**. The normal core save/publish/schedule buttons remain the publication authority. The companion must visibly distinguish draft changes from live changes and link into the native editor for normal publication.

Direct persisted mutations used by MCP or companion commands need revision preconditions and deliberately scoped fields. Never fetch the latest revision at submission time and use it as if it were the revision the user edited; that defeats stale-write protection.

## 4. Non-negotiable recovery constraints

1. Native events remain authoritative after native activation, including when empty. No error/unpublish/delete fallback to legacy data.
2. Preserve generated native IDs, translation groups, core per-locale slugs, stable migrated UIDs, pinned host and durable sequence/recovery state.
3. Keep core publication distinct from event business status. Preserve drafts, revisions, scheduled publication, Portable Text/media and translation inheritance.
4. Shared occurrence changes stay in `exceptions`; localized title/description/location/organizer overrides stay in `occurrence_content`. Category changes are shared.
5. Preserve stored orphaned localized copy after shared schedule changes. Explicit UI edits to an unchanged orphan are not implied merely because a full form contains that field.
6. Never restore native-site event/venue writes to legacy storage. Legacy UI restoration is allowed **only in legacy mode** while no native authority is active.
7. Do not flatten rich descriptions irreversibly, change identity to silence a client defect, or clear migration/calendar state to force retries.
8. Do not add outbound hosts or schema-write capability to work around missing setup design. Schema provisioning is an explicit site workflow.
9. Preserve real feature tests. A moved unit assertion is not equivalent to an editor interaction test.
10. Measure actual sandbox archives throughout implementation. The hard per-file limit is 131,072 bytes; the project budget is 112,640. The hard total is 262,144; project total budget 225,280. Do not solve size pressure by silently removing features.

## 5. Implementation work packages, in required order

### WP0 — Establish parity baseline and prove native extension integration

**Files:** old admin modules, `src/native-admin.ts`, `src/plugin.ts`, manifest, schema, test host, installed core extension sources.

Deliver a checked parity checklist for every R/I item and capture current/old screenshots where runnable. Treat the old controls and behavior as the product specification; preserve their purpose while improving native editing.

Create a minimal installed-host spike for an events-only schedule panel that reads a saved entry and the declared current draft fields, displays one friendly control, returns a validated draft patch, and leaves published content unchanged. Test the manifest through the installed CLI and the real host dispatcher. Also prove the custom field-widget rendering/binding contract before using it to replace raw JSON fields.

Saved-entry panels cannot be assumed to work before a new entry exists. Demonstrate the new-event path separately. Default fallback: create a minimal native draft through an authorized content path, immediately open its native editor and schedule panel, then use native Portable Text/media editing. An incomplete draft is allowed, but the UI must guide users through completing it. Do not force JSON entry during creation.

There is no verified generic field-level `hidden: true` property in the inspected Field interface. Do not invent it or inject CSS to hide controls. Use verified field widgets, supported editor organization, or a clearly labeled advanced area. The normal task must never require the raw field. If the supported host cannot provide the required in-field UX, document the precise blocker and implement a site/core extension deliberately instead of promising a nonexistent hook.

**Acceptance:** Editor can reach the panel in a saved native event; another collection never shows it; draft patch survives save; live feed changes only on publish; stale patch and wrong entry/locale are rejected; new event creation needs no JSON; supported field-widget behavior is demonstrated or the supported fallback is recorded.

### WP1 — Shared native event command layer and authorization

**Suggested modules:** `src/native/event-service.ts`, `src/native/event-commands.ts`, `src/native/editor-context.ts`. Names are suggestions; their responsibilities are mandatory.

Use one native service for dashboard, editor extension and MCP. It loads canonical entry identity, live content, editable revision, locale/group, venue/organizer targets and revision token. Commands operate on specific field sets rather than replacing whole records. Pure helpers compile schedule controls, compute occurrence patches, prepare duplicate data and format previews.

Native editor routes use the host-attested `routeCtx.ui` context. Treat any ID/locale in action values as untrusted and compare it with the host identity. Do not trust a body-supplied role or user ID. The editor extension dispatcher performs ownership checks; direct companion routes do not gain those checks automatically.

Keep migration/transfer-management operations at `plugins:manage`. Editing routes must preserve native owner/edit permissions. Explicit publish/delete commands must require the corresponding installed core permissions, not merely `content:edit_any` plus the plugin's own publish capability. Token-authenticated callers without a user need a defined supported policy. Preserve production CSRF/auth dispatch.

**Do not assume the sandbox content update API is the normal editor write API.** In installed `node_modules/emdash/src/plugins/context.ts`, `createContentAccessWithWrite.update` calls repository `updateDraftAware(collection,id,{data:fields})` directly. It does not pass an expected revision or execute normal save validation hooks. Putting `_rev` into its fields object does not create a precondition. A plugin KV lock cannot prevent concurrent edits from core or another plugin.

Persist editor changes through host-validated draft patches and the normal core save path. For direct companion/MCP persistence, WP0 must establish a supported host-side/core content mutation adapter that accepts the expected revision, validates fields, runs the actual lifecycle and enforces caller authorization atomically. If the installed extension API cannot provide that adapter, record the exact limitation and implement a reviewed site/core extension or compatible core upgrade; do not ship read-then-unconditional-update as the substitute. A safe preparatory domain tool may return a patch for authorized core tools to apply, but it must explicitly report that it performed no write and must not masquerade as a successful update command.

Publication methods do accept `_rev` explicitly. Catch stale/conflict errors, preserve unsaved inputs and offer reload/review. The plugin's content capabilities are not proof that a human caller may perform every mutation.

**Acceptance:** two-tab race loses no edits; editor cannot publish/delete through an edit-only route; non-owner cannot mutate another author's content where core forbids it; public calls cannot invoke commands; wrong locale/group/collection is rejected; MCP and GUI commands produce equivalent native patches.

### WP2 — Restore complete friendly recurrence and schedule controls

**Primary surfaces:** a native schedule/recurrence field widget or panel and a companion “Manage schedule” entry point that opens it. Keep canonical storage as-is wherever possible.

Implement:

| Control | Required behavior |
| --- | --- |
| Repeat | Does not repeat, Daily, Weekly, Monthly; no unsupported Yearly |
| Interval | Integer 1–52; clear human summary such as “every 2 weeks” |
| Weekly days | Monday-first checkboxes; documented empty selection uses the original start weekday |
| Repeat through | Date picker, inclusive, required for repeating rules and not before local first date |
| Monthly pattern | Same day of month or weekday position |
| Day of month | 1–31 with Skip missing month/Use last day choice |
| Weekday position | First–Fifth or Last, plus selected weekday |
| Schedule | Timed or all-day, appropriate date/time controls, searchable IANA zone |
| Preview | Human summary and next three occurrences, based on current draft values |

Use existing recurrence/date/time-entry helpers rather than reimplementing date math. Interpret typed local times in the **event timezone**, independent of the browser's timezone. Accept the previous supported time-entry formats. All-day dates remain inclusive civil dates; native timed values remain ISO instants. Hide irrelevant controls using supported form conditions.

Compiler rules: `none` clears canonical recurrence deliberately; blank required repeating inputs produce an inline error; inactive stale controls are ignored; monthly omission/default behavior is deterministic. Do not generate yearly rules or silently change existing monthly interval-12 rules. Preserve unknown/unsupported input as a visible diagnostic, not a silently reset schedule.

When recurrence changes affect existing shared exceptions, show the affected dates and require an explicit repair/remove decision. Do not silently discard exceptions or make users edit JSON. Preserve unrelated localized/orphaned occurrence copy and expose it readably in an advanced history section.

Add friendly category editing and clear attendance/link conditions. Reference/media picking may remain native where it is already usable. Internal UID/legacy/recovery/history fields must be presented as technical/read-only through supported mechanisms, not editable routine form tasks.

**Acceptance:** create/edit a one-off, biweekly Monday/Thursday series, monthly 31st with both missing-day policies, last-Tuesday series, interval 12, all-day multi-day event and DST-adjacent timed series without JSON; reopen controls with identical rule; switching timed/all-day clears inactive fields; malformed dates retain typed input and a useful message; en/fr/ar/th display never changes machine dates.

### WP3 — Restore visual occurrence inspection, changes and restoration

**Suggested modules:** `src/native/occurrence-service.ts`, `src/admin/occurrence-panel.ts`; reuse `inspectOccurrences`, `scheduledOccurrence`, recurrence engine and old `occurrence-admin.ts` presentation as a reference.

Show a selectable 90-day window with pages of approximately ten rows. Include scheduled, modified and cancelled rows, original local date/time, effective local date/time, timezone, all-day range, state, locale and whether the view is the draft or current live schedule. Include Previous/Next dates and Previous/Next 90 days. Moved occurrences remain discoverable by original identity and effective range. Provide human-readable changed/cancelled history and orphaned copy, not just active occurrences.

Actions and scopes:

- **Cancel this date:** adds/updates one shared cancellation exception for the original recurrence ID. Explain “shared schedule: affects every language.”
- **Reschedule/change schedule:** edits only shared schedule/domain overrides. Keep original recurrence identity; show replacement timezone and inclusive all-day semantics.
- **Edit this language's announcement:** edits only localized title/description/location/organizer copy. Description must use a supported rich editing flow, not JSON; retain current blocks and custom-node policy. If the panel cannot embed Portable Text, use a verified core editing extension or linked native occurrence-content editor while preserving the same identity, rather than claiming a textarea is equivalent.
- **Restore schedule:** removes the shared schedule exception only. Other languages' localized copy remains.
- **Reset this language's copy:** removes that locale's editorial override only.
- **Restore schedule and this language's copy:** optional explicit combined action; never silently erase all siblings' copy.

Each field needs distinct “inherit series value” and “set value” semantics. Empty text must not be accidentally treated as inherit if an editor deliberately clears it. Confirmation is needed for cancellation/removal; routine previews are reversible and need no repeated confirmation.

In the native editor, return draft patches and use normal core save/publication. In a companion persisted-draft action, state “Draft updated; publish in native editor” and link there. An already-cancelled action is idempotent. Every command validates the original recurrence membership and current revision; arbitrary forged recurrence IDs must fail.

**Acceptance:** cancel/move/restore one date with unchanged UID; unpublished draft change emits no live cancellation; publish creates correct tombstone; restore removes stale tombstone; category change affects only the appropriate subscriptions; translated announcement stays local; unrelated pending title/PT edits survive; stale confirmation does not overwrite a newer exception; all-day and timezone transitions render correctly.

### WP4 — Restore companion workspace, duplication, legacy continuity and settings

Replace the link-only page with a useful native event workspace: title search, locale/group context, draft/published/scheduled state, event business status, upcoming/past selection, recurrence summary, next occurrence, venue/organizer and actionable edit/manage-dates links. Paginate; do not render an unbounded selector of all events. “Upcoming” must use occurrences, not merely a recurring series' old start date. Core metadata may provide list fields, but all-day/timed mixed dates need an explicit display/sort policy.

Restore Add event, safe native Duplicate, confirmed single/bulk deletion or links to a **verified equivalent** core operation. Do not count an untested generic list button as parity. Bulk actions identify row-vs-entire-group scope and report partial failures. Deleting one translation must not cancel the still-published group.

Duplication must create a new unpublished item/group/slug identity. Copy editorial values, schedule, native media/reference/category and organizer choices. Do **not** copy `calendar_uid`, `legacy_id`, recovery token/legacy metadata identity, old translation_group, exceptions, occurrence_content, schedule_history or previous_start_date. A normal copy starts with new identity; translation creation is a separate command and deliberately retains group/shared fields. Tests must distinguish those operations.

Restore legacy editor reachability when no native authority is active. Dispatch by source mode before loading forms. Native mode must never invoke old storage-writing handlers. Minimize/reuse presentation helpers to meet bundle limits; importing the entire old editor beside native runtime previously exceeded limits. Measure early and redesign code/package boundaries through supported tooling if necessary. Do not invent backend chunk support without testing installation.

Restore a Settings/Feeds page: displayed source mode, default timezone, 12/24-hour preference, locale/strict/category feed builder, copy/open subscribe/download links, and clear setup/migration status. Settings must describe their actual scope. Existing per-event zones never change when the default changes. For legacy preference continuity, seed future native defaults from the reviewed existing setting during schema upgrade; do not rely on a beforeSave hook to recover the user's default after core has already filled a static schema default. Keep schema-default updates deliberate and documented.

Dashboard widget: formatted local schedule, explicit timezone/all-day range, location, chosen content locale, expected window/count and event-specific management links. Use the preference consistently or explicitly make locale govern hour cycle; do not retain a setting that does nothing.

**Acceptance:** normal Editor can operate the workspace; filtered paging retains filters; duplicate has new identity and no exceptions; bulk failure is reported per item; unmigrated sites can still create/edit legacy events; native sites never write legacy tables; changing default zone affects new native creation as specified; 12/24 preference changes relevant display; feed links carry the selected locale/strict/category.

### WP5 — Restore reusable organizers and protect location dependencies

Add a native organizers blueprint and configurable native organizer reference on events, or explicitly integrate an existing compatible site collection. Default standalone contract: shared required `name`, public HTTP(S) `website`, public HTTP(S) `contact_url`, unique/indexed `legacy_id`, JSON `legacy_metadata`, native publication. Keep localized event organizer display text as an override/fallback. Do not store private addresses/contacts in public fields.

Migrate **all** legacy organizers, including unreferenced ones. Use a separate resumable organizer backfill with generated-ID mapping, uniqueness, preview and ledger protections. Do not change old migration cursors silently. For already migrated 0.12 events, provide a separate explicit preview/link pass from preserved `legacy_metadata.organizerId` to the native reference. Use revision preconditions, do not overwrite local display text, and do not republish intentionally unpublished completed events. Existing source and snapshot data remain recoverable.

Resolve published organizer references live so a directory change reaches public metadata. Define precedence consistently: explicit localized occurrence organizer override; explicit localized event display override; resolved native organizer name; preserved snapshot name/free-text fallback. Website/contact details come from the published native reference where present. Test the currently broken case: selected saved organizer plus empty event organizer text must still show the organizer and JSON-LD.

Add native chooser/directory entry points and native-aware organizer MCP commands. For venues/locations, preserve structured-address editing and require a useful published-dependency workflow. Implement or prove native safeguards against deleting/unpublishing a venue or organizer referenced by affected published events. Check the configured collection and actual references, across locale siblings. Prefer refuse-with-listed-dependents/reassign guidance over silently detaching published content.

If enabling live organizer/calendar-rendered metadata changes, include that dependency in relevant fingerprint/invalidation logic, as venue changes already are. Do not create a second independent index without atomic invalidation semantics.

**Acceptance:** create/select/update an organizer without JSON; update its website/name and observe public outputs according to override policy; unreferenced legacy organizers migrate; linking existing events preserves editorial/publication choices; dependency deletion/unpublication cannot break published events invisibly; custom locations collection works; locale names/URLs follow the documented policy.

### WP6 — Restore native MCP and trustworthy transfers

Replace the blanket native gate with native-aware implementations of domain operations. Preserve the gate only for explicit legacy writes in native mode. At least implement native listEvents/getEvent/listOccurrences/createEvent/updateEvent/publishEvent/unpublishEvent/deleteEvent/setOccurrenceException/removeOccurrenceException and venue/organizer operations. Reuse WP1 services; do not replicate storage logic in each tool.

Native tool inputs must carry explicit entry/locale scope, original recurrence ID and expected revision for changes. Mutation depends on the safe host adapter required in WP1; raw sandbox content.update is insufficient. Domain wrappers compile friendly rule input, preserve Portable Text and split schedule/editorial overrides. Keep a clearly documented legacy compatibility mapping for old IDs and timed local-value semantics. Do not silently accept old `published` or business-status arguments as equivalent to core publication. Tool descriptions/schema/output must match current mode and supported semantics; advertise a capabilities/source-mode discovery result so agents do not call unusable tools blindly.

Transfer API: make native export operate on current native rows and preserve core metadata, translations, published/draft distinction, canonical schedule/rich content, identities and references. Keep explicit legacy archive export for recovery. Make preview/import share the same source/target mode so a preview that says ready can actually be executed. Support bounded pagination, dependency mappings, skipped-existing versus conflicts, and actionable per-row errors.

Copy import creates new identities and drafts; restore/import into an existing native dataset preserves identity only under an explicit collision/precondition policy. Portable data export does not replace a complete database/media/KV backup. Live/pending revisions must not be conflated; if a transfer cannot carry all revisions, state exactly which version it exports and leave full-history restoration to core backup.

**Acceptance:** native MCP lists a draft/series and inspects cancelled dates; a rule/exception update produces the same result as GUI; auth/conflicts are tested through dispatcher; export after a native edit contains the edit rather than old legacy values; preview and execution use the same authority; copy creates no UID/legacy collision; full source-mode semantics are documented.

### WP7 — Restore domain schedule history with native revisions

Do not conflate core revisions with domain schedule history/previousStartDate. Define the latter as the previous **committed published schedule** plus a bounded ten-change history. Pending drafts must not advance public history/SEQUENCE. A history preview in the editor may show the pending transition separately.

Use an installed supported publication policy/data-promotion mechanism or a revision-aware native command path. Prototype it against actual core hook mutability before choosing a hook. A beforePublish policy that only cancels/allows must not be treated as a field-mutating hook. Avoid unawaited after-hooks or secondary revision writes that race or recursively republish content.

Derive prior live start/end/all-day/timezone when a changed schedule is promoted; preserve original civil/instant form. Record one logical group transition even when siblings synchronize. Title-only save/publication creates no schedule entry. Restore/revert should create a genuine transition where appropriate, while duplicate creates no inherited history. Business status rescheduled and previous_start_date semantics must remain coherent.

If the host cannot atomically enrich normal generic-editor publication, implement a supported native Eventual publish action with equivalent permissions and clearly integrate it into the editing workflow; document the host limitation instead of claiming automatic history for paths you cannot observe. Do not silently leave generic publish behavior inconsistent.

**Acceptance:** pending schedule edit does not change live history; publish adds one prior schedule; successive changes cap at ten; translated publication does not double-count; title-only edit does not add history; rollback semantics are tested; Schema.org rescheduled output has correct previousStartDate; copy has no source history.

### WP8 — Restore rich public content, locale propagation, stable URLs/media and ICS consistency

**Rich content:** keep current lightweight `description` behavior explicit, and add a typed optional `descriptionBlocks` output for native Portable Text where rich rendering is requested. Do not replace a stable string field with an unannounced array. Add a declared request option such as `includeDescriptionBlocks=true`, default false on lists; native event detail lookup can request it. Preserve safe known block rendering, headings/lists/marks/links and controlled custom-block fallback. Never pass arbitrary rich text/HTML through set:html without the existing safe rendering contract. Bound bytes as well as event counts when returning rich payloads.

Update PublicEvent validation, packed exports and the example to consume that richer representation. For legacy strings, distinguish Markdown/source behavior from native plain text so literal punctuation is not reparsed incorrectly. Calendar/JSON-LD plain text remains intentional; public event detail pages must retain formatting.

**Locale:** update every example fetch (browser, simple list, detail and ICS) to request the selected content locale and explicit fallback policy. Extend subscription URL generation with locale/strict/category. Use consistent query propagation through navigation/download links. Display locale alone is not content selection. Native Live helper consumers must select one published sibling or use a shared explicit locale-selection helper; `expandEventOccurrences` does not currently deduplicate all siblings for them.

**URLs:** implement a published native event/occurrence resolver for current ID, locale slug and legacy ID aliases with unambiguous lookup rules. Keep original recurrence IDs separate from route slugs. Align example detail lookup with the URL builder. Redirect old event bookmarks to the correct published native locale/occurrence where mapped; missing/unpublished entries must not expose legacy content. Preserve occurrence-window machine dates and avoid Unicode/double-decoding errors.

**Media compatibility:** replace the native blanket 404 on legacy image aliases with a published-native mapping lookup using ledger/legacy_id and the native media reference. Serve a safe redirect or validated bytes using the supported route response contract. No legacy fallback for unpublished native items. Verify content-type/size and cache policy. Explain that core media URLs may remain publicly accessible independently of event publication; this is a policy boundary, not proof that native unpublish makes uploaded assets private.

**ICS:** remove the example's independent UID/SEQUENCE implementation. Preferred concrete path: add a bounded public single-occurrence calendar export route that resolves a published native/legacy occurrence and uses the same server reconciliation/serializer identity as the subscription feed. The example's `.ics` route forwards that result instead of deriving ID@host and milliseconds locally. If a shared standalone formatter is also exposed, pass complete authoritative calendar identity/sequence rather than guessing from CMS ID/updatedAt. Do not append an occurrence suffix twice to an already-expanded UID.

**Acceptance:** native PT formatting renders in real packed detail pages; fr page never shows an arbitrary English sibling unless labeled fallback; strict behavior applies to downloads/subscriptions too; migrated bookmarks and image aliases resolve; unpublished native aliases 404 without resurrecting source; feed and individual ICS share UID/SEQUENCE/status/date semantics, parsed independently with ical.js; zero-duration and Unicode folding pass on both paths.

### WP9 — Remove migration capacity regression and make upgrades usable

Restore compatibility for at least the previously accepted **500** schedule exceptions and localized copy items, while retaining byte limits, scan/expansion caps and bounded UI pagination. Do not solve a 500-item source record by truncating it to 366. Preview/execution must report inability truthfully and preserve the original. Source records near limits need actual sandbox tests; large JSON field/editor snapshot sizes can create additional independent limits.

Provide a versioned, idempotent schema upgrade plan for existing 0.12 installations: organizer fields/reference if used, field-widget assignment, labels/admin configuration and reviewed default settings. Exporting a new blueprint does not modify an installed site. Preserve all-day representation, legacy UID and migration ledgers, locale flags and current content. Do not rerun original completed migration to overwrite editor changes with old source.

For unmigrated sites, supply clear setup/migration status and an operational cutover flow that preflights dependencies/locale/schema, previews all batches, explains that empty native schema switches authority, and coordinates execution. Preview cannot promise generated IDs. A failed partially executed batch is not a transaction rollback. Source storage and relevant KV/media need a proper backup. Never silently activate legacy fallback on a site already using native content.

**Acceptance:** migrate a valid 500-exception series without lost data; new native manager paginates it; upgrade an existing 0.12 dataset without changing IDs/groups/UIDs/publication/editor changes; interrupted upgrade resumes safely; unmigrated UI works until planned cutover; mismatch/batch errors are visible and recoverable.

### WP10 — Product parity tests, documentation, performance and release

Do not use “170 passing tests” as the release acceptance criterion for this recovery. Restore task-level coverage that proves the new GUI, native extensions and native tools can perform the work. The prior suite legitimately checked repaired backend behavior but also encoded link-only UI and blocked MCP as desired outputs.

Add tests at four boundaries:

1. Pure form/compiler/command semantics, with genuine core/native/Live/legacy shapes.
2. Production D1 plugin dispatcher/editor-extension tests for permissions, ownership, draft patches, stale writes and complete save/publish/schedule/restore lifecycles.
3. Packed Astro builds/rendering with actual native detail, locale, rich text, old URL/image aliases and single-event ICS paths, not only a minimal EventList fixture.
4. Browser task tests and manual visual/keyboard checks against a running installed admin: no JSON, clear error recovery, focus/labels/confirmations, Arabic/RTL and mobile/zoom layouts. Static declarations are not evidence of usable rendering.

Restore README/registry/release notes to truthful descriptions and replace legacy screenshots with tested current screenshots, or explicitly label them historical. Remove unsupported yearly claims and absolute “zero data loss/client cancellation guaranteed” claims. Explain the new capabilities and real native workflow. Update the earlier handoff/verification documents so a later agent cannot repeat the rejected retirement policy.

Run actual native timed-series and concurrent locale/category load tests. Address I04 with a bounded reconciliation strategy: safe cached committed snapshots or retry/coalescing semantics and meaningful Retry-After/error handling, without serving stale identity as if current publication had reconciled. Serialize only the required mutation work; keep CAS/lease ownership correct. Test failed delete while reconciliation is busy and lease expiry. Do not add unsafe shared mutable state.

Run the installed commands sequentially because build/Vitest/bundle share dist artifacts:

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

Then run example `npm ci`, `npm run check`, `npm test`, `npm run test:page`, plus the newly added browser/native-detail/export checks. Require CI in its UTC and America/New_York matrix. Re-measure the complete archive after docs/manifest changes. Do not copy the earlier 81,938-byte backend measurement into a future release report.

Verify actual LinguaDash translation on the native editing workflow and Apple/Google/Outlook subscription behavior after migration, localized edits, cancellations, restoration and individual download. Existing client caches containing invalid old SEQUENCE may require a tested reset instruction. Identical UID strings are not proof of deduplication across two separately subscribed calendars.

Use the authorized registry/site release workflow only after acceptance. Recommended next version is a new minor recovery release if new capability/schema contracts are introduced; decide the exact version from the actual release state. Do not assume 0.12 was unpublished because an earlier session did not publish it. Commit every new source/test/schema/doc file, review the signed actual artifact, source-package distribution and installed consent, and stage the site upgrade before production.

## 6. Release completion checklist

The implementing agent must return evidence, not “implemented both options.” Required evidence:

- R01–R20 and I01–I08 disposition with exact implementation/tests or a user-approved exception.
- Editor demonstration: create a weekly Monday/Thursday event, preview it, cancel/move/restore one date, edit a translated announcement and publish, without JSON.
- New/legacy/native modes all have a working management path and one authoritative store per mode.
- Reusable native organizer workflow, safe duplication and domain history demonstrated.
- Native MCP performs real native edits/inspection; transfers export current data and preview accurately.
- 500-exception migration and existing-0.12 schema upgrade preserve source and identities.
- Rich native public pages, locale propagation, prior bookmarks/media aliases and matching per-event/subscription ICS verified.
- Production dispatcher permissions, revision conflicts, failed mutations and partial batch results verified.
- Current screenshots/browser accessibility evidence and truthful documentation.
- Packed consumer, full tests, CI, load measurements and sandbox archive budget results.
- Site staging/LinguaDash/calendar-client acceptance and actual release/deployment identifiers if those actions are authorized and completed.

Until those are available, describe the work as a partially recovered native modernization, not complete product parity. Preserving core architecture and preserving editor capability are simultaneous requirements.
