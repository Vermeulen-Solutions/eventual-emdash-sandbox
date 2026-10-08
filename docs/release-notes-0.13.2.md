# Eventual 0.13.2

Patch release for EmDash >=1.2.0 <2.0.0. No new capabilities, outbound hosts, or native schema changes.

## Changes

- Memoize raw collection settings, schema discovery, validated bindings, published directories, and canonical URLs within an invocation. Settings repair remains available when a selected collection has disappeared.
- Replace per-group calendar reads/writes and reconciliation leases with one versioned aggregate and a conditional commit. Import existing host identity, sequences and cancellation history on first use; preserve old keys for rollback. Reject snapshots larger than 1 MiB.
- Hydrate directory assets once per invocation and resolve canonical URLs only for the selected feed locale. Repeated occurrences share one authoritative EmDash URL lookup for their base entry. Remove the incorrect local routing approximation.
- Fetch public images directly by native base ID. Legacy aliases use an indexed `legacy_id` lookup; verify current publication, MIME type, and size before streaming bytes.
- Guard public reads, native MCP reads, saved editor panels, admin pages, content policies and legacy imports before an eleventh bridge call. Budget errors produce explicit failures; public feeds return HTTP 503 with `no-store` and `Retry-After` rather than a partial successful feed.
- Batch legacy import existence/reference reads, retain conditional inserts, and report unwritten rows as `pending`. Retry pending rows; existing imported IDs are skipped. Batch translated cancellation notices with other tombstones.
- Reuse the initial live-content read during save validation and reject dependency changes when a scheduled draft revision cannot be verified. Remove a duplicate mapped-venue read during migration.
- Consolidate shared error paths and recurrence form validation to keep the sandbox backend under the unchanged registry file-size cap.

## Current limits

This is an incremental RPC containment release, not completion of the background snapshot/job architecture in the implementation plan.

EmDash still resolves canonical URLs individually. Eventual deduplicates those calls within one request, but many distinct base events can exceed the ten-call budget. Directory hydration still requires complete published-directory pagination. Large sources return an explicit error rather than silently omitting rows. A cold calendar can finish its atomic state import and then exhaust its rendering allowance; a new invocation can finish when the warm request fits the budget. Repeated retries cannot make an oversized warm request fit.

Call accounting depends on the data and code path. For example, a warm calendar with one source page, no directory references, and no state changes uses five non-URL calls, leaving room for five distinct canonical URL lookups. Reference pages, changed calendar state and cancellation pages reduce that allowance. Calendar formatting/recurrence CPU is not certified against Cloudflare's 50 ms limit by local tests.

Dependency policies fail closed when their complete live/scheduled-draft check cannot finish. Large directories can therefore block deletion or unpublication until references are reduced or host support is added.

The legacy-to-native migration engine and legacy MCP mutation workflows have not been converted into budgeted multi-invocation jobs. Their existing operation counts can still exceed ten subrequests; do not assume this patch makes those workflows usable on the Cloudflare sandbox. Keep existing data and use a reviewed migration workflow appropriate to the host. The resumable migration redesign remains pending.

Upstream API tracking: [EmDash #4004](https://github.com/emdash-cms/emdash/issues/4004). Host-side bulk content/translation/URL retrieval and authoritative dependency checks would remove the remaining core API constraints.

## Update

Update Eventual to 0.13.2 in EmDash's plugin administration once the registry approves the release. Existing 0.13.x schemas and agent-access selections remain compatible. Sites upgrading from 0.12.x or earlier still need the [0.13.0 upgrade procedure](upgrade-0.13.0.md).

The first successful calendar reconciliation atomically imports prior state into `state:eventual-calendar-snapshot`. Old per-group state is retained. A rollback to an older plugin will not see subsequent updates in the new aggregate; preserve both representations and reconcile calendar history before a production rollback.
