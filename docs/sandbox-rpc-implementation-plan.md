**Eventual sandbox RPC implementation plan — 8 October 2026**

Upstream tracking: [EmDash #4004 — bulk hydration and authoritative dependency checks within the 10-subrequest limit](https://github.com/emdash-cms/emdash/issues/4004). Filed before implementation, with verified local call counts, two bounded API requests, and a question about publication/invalidation consistency. Related reports: [#3989](https://github.com/emdash-cms/emdash/issues/3989) (sandbox subrequest exhaustion) and [#3768](https://github.com/emdash-cms/emdash/issues/3768) (D1 parameter limits for storage batches).

**0.13.2 implementation status**

The first patch implements request memoization, a shared ten-call guard on public reads/native inspection/editor and policy paths, one atomic calendar state aggregate, direct native image lookup, deduplicated authoritative URLs, batched legacy import reads with pending-row retry, and fail-closed scheduled dependency checks. See [the release notes](release-notes-0.13.2.md) for the precise supported paths and limits.

Background generations, resumable native migration, complete legacy mutation budgeting, and Cloudflare CPU acceptance remain pending. Directory pagination and distinct canonical URL calls can still exhaust the allowance. The proposed budgets and completion criteria below remain targets for that later work.

**Objective and completion criteria**

Keep Eventual a registry-installable sandbox plugin. Every route, policy hook, lifecycle hook, and cron invocation must fit EmDash's enforced limits: 10 subrequests, 50 ms CPU, and 30 seconds wall time. The normal-path engineering target is at most 8 bridge calls and 35 ms measured CPU, leaving room for exceptional work. These targets are proposed acceptance budgets, not measurements of an implementation that already exists.

Count content, schema, settings, media, plugin storage, KV, cron, HTTP, and logging bridge calls. Reserve cleanup, checkpoints, and error reporting before starting work. Parallel execution can reduce latency but does not reduce the call count. A scheduled continuation is a new invocation; an asynchronous loop inside the same invocation is not.

Preserve native collections as the source of truth, existing public endpoints, translations and fallback behavior, recurrence and moved exceptions, draft isolation, dependency protections, calendar UIDs and sequences, cancellation history, and resumable migration semantics. Never return a truncated successful feed or treat an incomplete dependency scan as permission to mutate content.

The current baseline is 185 passing tests across 23 files, successful manifest validation, and successful type checking. The review additionally reproduced incorrect local URLs, 12 bridge calls for a cold one-group calendar feed without reference lookups, and 11 list calls for a single reference in a 1,001-row directory.

References: [EmDash resource limits](https://docs.emdashcms.com/deployment/plugin-sandbox/#resource-limits), [limit-sensitive test guidance](https://docs.emdashcms.com/plugins/creating-plugins/testing/).

**Architecture decision**

Use two stages: first make the existing synchronous paths bounded and correct; then move collection-wide work into resumable jobs and publish complete derived snapshots for public reads. The first stage is containment, not completion of large-site support.

EmDash 1.2.0 exposes content list pagination, exact status/locale filters, and filters on indexed custom fields. It does not expose content `getMany`, bulk translation-group lookup, bulk revision lookup, or bulk public-URL resolution. Plugin storage does expose `getMany`, `putMany`, and conditional per-record writes. Cron scheduling and content state-change hooks are available.

The plugin-only implementation must use those existing APIs. New bulk content APIs are a separate, recommended EmDash dependency track; do not invent them in Eventual or require a trusted site-side companion. In particular, use the existing authoritative `getPublicUrl` API in small background batches until a supported bulk equivalent exists.

**1. Establish invocation accounting and workload limits**

Files: `src/plugin.ts`, a small new invocation-budget module, `tests/native-source.test.ts`, and new route/hook budget tests.

- Introduce one shared budget object per invocation. Ensure all helpers see the same accounting state even when a route adjusts site metadata or wraps its context.
- Build a test context wrapper that counts every bridge method, including storage methods accessed through the storage proxy. Fail before attempting the eleventh call. Record method names and aggregate counts for assertions.
- Add production preflight checks to unbounded pagination, imports, reconciliation, and job loops. Avoid shipping a general proxy framework if explicit accounting at these boundaries is smaller and sufficient.
- Give each operation an allowance and reserve its required final writes and cleanup. Do not spend the last available call discovering that another page exists.
- Distinguish `more work remains` from `source is invalid` and `source could not be verified`. Continue resumable jobs; return an explicit retryable/incomplete-work response for synchronous paths.
- Set byte, entry, occurrence, and per-step expansion limits as well as RPC limits. An RPC-safe operation can still exceed CPU or payload limits.
- Establish build and installation-archive sizes immediately. The backend has little headroom; consolidate shared code before adding a scheduler or cache subsystem.

Exit condition: all current hotspot tests expose their complete call counts, and an over-budget path stops before crossing the limit without reporting success.

**2. Finish request-scoped memoization and remove duplicate reads**

Files: `src/domain/collections.ts`, `src/domain/native-references.ts`, `src/hooks/content-hooks.ts`, `src/native/schedule-panel.ts`, `src/native/compact-panel.ts`, `src/native-admin.ts`, `src/mcp.ts`.

- Keep the existing promise-backed `WeakMap` for bindings.
- Separate memoized raw collection settings and schema-list access from validated bindings. The settings repair page must still render when a selected collection was removed.
- Reuse these cached raw reads in `eventCollectionName`, dependency checks, panel rendering, migration setup, and native admin navigation.
- Reuse the first content read in `handleContentBeforeSave`; keep the live entry and editable revision separately rather than fetching the live entry again.
- Cache identical in-flight directory reads by context, target, visibility, and filter. This helps repeated work within one request; it is not a solution to large collections.
- Invalidate affected settings/bindings caches after successful writes. Do not reuse request promises across invocations.

Tests: concurrent readers share one promise; distinct contexts remain independent; save invalidation reloads; rejected reads fail closed; invalid bindings remain repairable.

**3. Restore authoritative public-URL behavior**

Files: `src/domain/native-source.ts`, `src/domain/event-expansion.ts`, `src/domain/event.ts`, and URL parity tests.

- Remove the current simplified derivation as the general-purpose canonical URL resolver.
- Preserve collection identity, CMS entry ID, slug, locale, publication status, and publication date in the internal representation where needed.
- For synchronous single-event inspection, use `ctx.content.getPublicUrl` once and charge it to the route budget.
- For lists and calendar generation, resolve each unique base event's URL during bounded background work and persist it with its source revision and routing-generation metadata. Recurring occurrences reuse the base event URL.
- Re-resolve when an entry's slug/publication/locale changes or collection/site routing changes. Add an explicit administrative rebuild and periodic repair for routing changes that have no available hook.
- If the host returns null, preserve an existing valid explicit fallback according to the established API contract; do not fabricate a routable URL for a draft or an unroutable collection.

Parity cases: custom collection with no pattern; repeated `{slug}`; `{id}`; all supported date tokens; Unicode slugs; trailing-slash modes; disabled i18n; prefixed default locale; custom locale paths; regional codes; unknown locale; drafts; unroutable collections; recurring base IDs.

Dependency option: ask EmDash for resolved public URLs in content-list responses or a capability-gated bulk resolver. That would replace the slower per-entry background resolution without changing Eventual's public contract.

**4. Remove whole-site reconciliation from feed requests**

Files: `src/domain/native-calendar.ts`, `src/routes/calendar-feed.ts`, `src/hooks/content-hooks.ts`, `src/plugin.ts`, and new calendar-state/job modules.

Immediate containment:

- Extract pure calendar comparison from RPC persistence: previous state plus current normalized groups produces sequences, occurrences, and cancellations.
- Replace the per-group read/CAS loop on the synchronous bounded path with a versioned aggregate snapshot and one conditional commit. Include the persistent calendar host in the envelope once initialized.
- Keep existing UIDs, sequence values, and cancellations when importing old per-group state. Migrate in bounded invocations; do not recreate the state during a public request.
- Eliminate repeated organizer hydration and repeated host lookup. Hydrate normalized records once; occurrence formatting must not reload directories.
- Bound aggregate bytes, total groups, and expansion work. If the bounded synchronous path cannot finish, schedule/continue the job and return an explicit response. A single giant snapshot is not the long-term storage design.

Durable design:

- Use generation-scoped records/chunks and a small manifest containing the completed generation, source/binding fingerprints, persistent host identity, freshness state, and known chunk IDs.
- Read one bounded source page or work unit per cron invocation. Expand recurrence in bounded date windows; checkpoint inside large series rather than assuming one series fits 50 ms.
- Persist normalized records and reusable calendar fragments with batch storage operations. Generate locale-aware content without materializing every possible category/locale query combination.
- Make a completed generation visible with one manifest CAS only after its chunks and cancellation state are complete. Feed requests read the manifest and bulk-fetch known fragments with storage `getMany`.
- Define concurrent-change fencing: an edit during a build invalidates or advances the source generation. A stale job cannot mark its output current. Keep each chunk idempotent and make retries reuse work without incrementing sequences twice.
- Preserve last-published snapshots for deletion and unpublication cancellation computation. Replace `beforeDelete` whole-site reconciliation with bounded work for the affected group and durable invalidation.
- Continue job work through supported `cron` hooks. Verify site Cron Trigger and EmDash scheduled-handler wiring; one-shot scheduling does not create a platform wakeup by itself. Provide an authenticated explicit continuation path for bootstrap/repair.

Freshness and safety are release gates. Test that the host's policy semantics can reliably establish invalidation before relevant publication/deletion changes commit. After-hooks alone are not a transactional publication fence. If the host can commit a change despite failed invalidation, a cached feed cannot claim immediate publication correctness: keep it unavailable when correctness is uncertain, or obtain the required host support before enabling it. Never use a cached absence as authoritative permission to delete a dependency.

When no complete, current generation is available, return a retryable 503 with `Retry-After` and do not cache the error. Feed formatting must be complete within its byte/CPU envelope; exceeding that envelope is an explicit supported-volume error, not a partial calendar.

Exit condition: public calendar requests perform no reconciliation writes, no native collection scans, and no per-group RPCs; failed or concurrent jobs leave durable state recoverable.

**5. Bound references, public JSON, images, and editor directories**

Files: `src/domain/native-source.ts`, `src/routes/public-events.ts`, `src/routes/public-media.ts`, `src/native/compact-panel.ts`, `src/native/schedule-panel.ts`, `src/mcp.ts`.

- Populate derived event and directory records during the same generation workflow. Keep native entry IDs and translation groups separate and index their relationship in the projection.
- Use storage `getMany` for requested projected references. Preserve published-only base and translated selection, exact locale matching, and existing fallback behavior.
- Add pagination/filtering to native MCP lists and directory controls. Match names/search choices from bounded projected queries, and retrieve an explicit saved selection separately when it lies outside the page.
- Public JSON should read bounded projected candidates, select locales, and expand only the requested window. If candidate/expansion volume exceeds its envelope, use completed generated occurrences or a separately designed paginated JSON contract. Keep the existing complete-response contract until such a versioned change is explicitly introduced.
- Do not filter native events using `start >= from`: that loses older recurring series, long overlapping events, and exceptions moved into the window. Validate any candidate query against the pure recurrence result, including these cases.
- For event images, first fetch the base native entry directly and verify it is currently published. Resolve legacy IDs using an indexed `legacy_id` filter where the installed schema supports it. Keep bounded fallback behavior explicit; do not reintroduce a collection scan.
- Keep the current image MIME/size/publication checks. Media metadata and bytes remain one call each for the selected image.

Dependency option: EmDash bulk lookup by IDs/translation groups would allow live reference hydration without a directory projection. Core field filters cannot currently be assumed to filter system IDs or translation groups.

**6. Make policy checks and transfers bounded**

Files: `src/hooks/content-hooks.ts`, `src/domain/migration.ts`, `src/transfer.ts`, `src/storage.ts`, `src/mcp-schemas.ts`.

- Dependency checks must continue to inspect published and scheduled content, including staged draft revisions. Avoid one revision call for every unrelated scheduled event.
- Prefer an authoritative host-side dependency query covering live and scheduled draft references. On current EmDash, use a bounded fail-closed check; if it cannot prove safety, block the operation with an actionable reason. A derived index can identify candidates but must not be the sole proof that no dependency exists.
- Migration should reuse the native venue index it already loads, deduplicate repeated venue/media/organizer reads, and stop checking a mapped venue twice for one published event.
- Replace full native-index and ledger scans on every migration request with bounded preload/job phases. Keep durable identities, unique `legacy_id`, lock ownership, and conditional publication semantics.
- Budget migration by actual operations, not a fixed count of 25 or 100 records. A single published migration item can itself exceed ten calls today; split create, publication, and ledger-completion phases across invocations where necessary. Resume from durable intent after interruption.
- Batch legacy import reference reads and preview-existence checks with storage `getMany`. Retain insert-if-absent conditional writes. Accept up to the current ten records only when that invocation's total call/byte allowance permits it; otherwise return an explicit continuation outcome with per-row status.
- Replace translated occurrence-cancellation `put` loops with `putMany`. Respect payload bounds and persist continuation state when even a single batch is too large.

Exit condition: no mutation succeeds based on incomplete verification; interrupted transfers resume without duplicate content, unintended publication, or lost cancellation records.

**7. Proposed steady-state call budgets**

These are design targets for the completed projection/snapshot architecture. Count first-use setup, conflicts, cleanup, and logging in separate worst-case tests; do not infer them from this normal-path table.

| Invocation | Proposed bridge operations | Target |
| --- | --- | --- |
| Public calendar | Settings + schema once; completed-manifest read; bulk fragment read | 4, maximum 8 after compatibility work |
| Public event JSON | Settings + schema once; generation read; bounded candidate queries; bulk directory reads | At most 8 |
| Native image | Settings + schema; direct event read; media metadata; media bytes | 5; bounded legacy lookup may add 1 |
| Single-event MCP inspection | Settings + schema; event read; authoritative URL; at most two reference/projection reads | 6–8 |
| Editor panel load | Settings + schema; event + optional revision; at most two directory queries | 5–6; test saved-selection fallbacks separately |
| Before publish/schedule | Settings + schema; two reference validations; bounded generation invalidation | At most 8 |
| Job step | Checkpoint/claim; bounded source/work reads; batch writes; checkpoint; continuation scheduling if needed | At most 8 normal, never more than 10 |
| Migration/import step | Shared setup + prefetch + a budgeted mutation phase + durable checkpoint | At most 8 normal, never more than 10 |

Do not assume a budget guard alone solves CPU usage. Measure actual sandbox CPU; cut the work-unit size or preformat output if cold formatting exceeds the target.

**8. Verification and rollout**

For each implementation phase, run the focused correctness/budget tests and type checking before integrating it. Before release, run the full suite plus `test:tooling`, `test:package`, `test:editor`, `bundle`, and `budget`; run timezone-sensitive tests in Europe/Paris and America/New_York.

Required regression matrix:

- Zero references; one reference in a large directory; shared references; more than 100 rows; translated siblings across pages; unpublished or missing bases/siblings; configurable collection slugs.
- Cold and warm feed reads; missing host identity; initial backfill; interrupted jobs; repeated jobs; concurrent edits; midnight rolling-window advancement; lease/CAS conflicts; deleted/restored groups.
- Calendar sequence monotonicity and stable cross-locale UIDs; one versus last published sibling removal; category/locale cancellations; retained cancellation history; recurrence across DST; moved exceptions and long overlaps.
- Draft-only edits never replacing published output; unpublication and deletion never leaking a previously cached public entry; directory changes and routing/schema changes invalidating affected generations.
- More than 10,000 source rows processed over multiple invocations if that volume remains supported; oversized Portable Text, exception lists, fragments, and image bytes; high occurrence density.
- Every route/hook/job at 9, 10, and an attempted 11 calls; error paths and cleanup; logging charged to the allowance; no continuation within the same exhausted invocation.
- Migration/import crashes between create, publication, and ledger completion; existing conditional-write conflicts; dependency verification that cannot finish.

Use Cloudflare preview/staging to verify the enforced 10-subrequest and 50-ms limits. The local passing suite does not prove deployed enforcement or CPU headroom. Use real cold isolates and recurring workloads, capture operation counts and platform metrics, and verify public and admin behavior in the browser.

Rollout sequence: (1) accounting/memoization and bounded containment; (2) URL parity and calendar state migration; (3) resumable generations and public reads; (4) policy/transfer completion; (5) deployed acceptance and release packaging. Keep old calendar state until the new generation is validated. Rollback must retain cancellation history, host identity, and resumable job metadata. An unavailable generation must remain an explicit failure rather than falling back to the old unbounded implementation.

Manifest additions for derived storage and lifecycle/cron hooks must be validated against registry access rules and accompanied by the appropriate release version/update notes. Rebuild and measure the actual installation archive throughout; preserve the existing file/total hard limits. If this architecture cannot fit the current bundle, consolidate shared implementation and use supported core bulk APIs before adding another layer.

**Implementation completion means** all supported workflows are functionally correct, every invocation is bounded, the supported content/occurrence envelope is documented and verified on Cloudflare, and existing URL/calendar/mutation semantics pass the regression matrix. Passing the old tests or reducing average calls alone is insufficient.
