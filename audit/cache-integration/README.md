# Public cache integration — local acceptance, 1 November 2026

Implementation acceptance on top of Registry 0.14.1, before release preparation.
Package/manifest versions were unchanged during this phase; its local archives
were development builds, not the published 0.14.1 artifact. This phase changed no
Registry record, production content, BBHC file, or deployment. The subsequently
authorized [0.15.0 release](../releases/0.15.0/README.md) has its own record.

Read the published [0.14.1 acceptance](../releases/0.14.1/README.md) and
[0.14.0 deployment record](../releases/0.14.0/README.md) separately. The latter's
BBHC identity/content guarantees remain historical evidence, not new acceptance.

## Contract and source findings

The [integration guide](../../docs/public-feed-caching.md) records the installed
EmDash 1.4.0/Astro 7.3.2 contract and current official documentation, the native
versus plugin mutation matrix, time semantics, fail-closed host example,
upstream requirements, and BBHC adoption checklist.

Native REST writes purge collection slugs and canonical entry IDs. A collection
dependency is sufficient to cover its entries, translations, missing matches and
empty lists. Generic plugin update/delete and settings writes lack route purge;
Node scheduled publication lacks it too. Sandbox authoring types and both
bridges expose no `ctx.cache`. Plugin KV and core object caches are separate.

The additive native-feed evidence has at most four collection/settings
dependencies, absolute generation/expiry and version 1. The 15-second ceiling
bounds gaps and failed purges; default UTC-today queries expire sooner at UTC
midnight. No dependency RPC is added. The host explicitly selects routes and
TTL; the helper returns a finite remaining TTL and `swr: 0`, or disables storage.

## Local checks

- Manifest validation and typecheck passed.
- Final full suite: **28 files / 247 tests passed** on installed EmDash 1.4.0,
  including legacy/error evidence and scheduled publication through the production
  Worker Loader/PluginBridge boundary. Focused gate: **3 files / 22 tests passed**.
- Tooling: **24 tests passed**. Performance profile: **2 tests passed**.
- Bundle validation and original reserve passed: backend **130,800 bytes**,
  reserve **130,816**, hard limit **131,072**; three files / **185,144 bytes**.
  Duplicate validator closures and date-window code were consolidated to retain
  the reserve. No translation, schema or capability was removed.
- Packed Astro consumer verification passed for the final helper/docs.
  `reports/packed-astro.json` records the accepted package hash and file hashes.
- `npm run test:cache` uses only a new synthetic SQLite database, the packed npm
  descriptor, Node adapter production build, actual Astro memory provider and
  Node/workerd sandbox. `reports/public-cache-host.json` records its final result;
  `reports/public-cache-host.log` contains native route and injected purge logs.
  All **eight** production HTML acceptance groups passed, including a real
  authenticated session and a host-signed draft preview URL.
- Final package SHA-256:
  `9f5abb54833d3cc52b85133b5d99722b9c9cba2e34305ae1f223a201cc233458`.
  `reports/cache-package-equivalence.json` verifies that every runtime/helper and
  other packaged file matches the HTML-tested package; only the guide's final
  `ctx.site` caveat changed. The final packed consumer also passed its Astro gate.

The HTML gate checks a stable render marker on cache hits, then changed output
after native publication, direct-live venue/organizer edits, settings writes,
unpublish/trash/restore/republication and a first matching event. It also checks
private misses, preview/edit, feed errors, absent/unknown metadata, event-start
expiry, rejected purge fallback, and plugin collection-setting expiry.

Trash restoration was verified to return a **draft**, with no public event until
republished. Unit tests cover inclusive all-day ends, local midnight, Paris's
23-hour spring and 25-hour fall days, UTC default-window rollover, malformed or
expired metadata, split unions/earliest expiry and unchanged RPC counts.

## Limits of this evidence

- Windows Node/workerd 0.9.6 needs its existing platform-binary resolver
  workaround. The HTML harness patches only its disposable dependency to use
  workerd's exported binary path; Eventual and system installations are untouched.
  The local Cloudflare PluginBridge tests use the production Worker Loader bridge,
  not that patched Node runner.
- The initial full-suite attempt encountered Miniflare's random `bad port`
  startup failure; the subsequent complete run passed. Early fixture attempts
  exposed mistaken test assumptions about seeded IDs, field shapes and restoration;
  final checks use the real installed semantics.
- No local test proves hosted Workers Cache storage, purge rate limits, cross-PoP
  behavior, Registry download/consent, or BBHC's production settings. Those remain
  **unverified** and are listed in the adoption checklist.
- Plugin `ctx.site` is initialized from `readSiteInfo()` when the runtime/runner
  starts. Native settings purges cannot refresh that snapshot. Site URL/identity
  changes therefore require the host's normal runtime restart before cache
  refill, or upstream per-invocation site identity refresh. The accepted settings
  tests cover live HTML settings and Eventual's source bindings, not hot-reloading
  that host snapshot; TTL alone cannot fix stale source inputs.
- A cached anonymous response can be served before authentication middleware.
  Preventing private fills does not implement cookie-based cache-hit bypass.
  BBHC must retain uncached routes if that stricter bypass is required.
- Failed purge, a concurrent refill or an uncovered write can remain stale until
  the bounded expiry. Longer cache lifetimes require the upstream invalidation
  work described in the guide; this change makes no immediate-purge promise for
  unsupported paths.

No publication/deployment commands were run during this implementation phase.
Subsequent release preparation and publication are recorded separately above.
