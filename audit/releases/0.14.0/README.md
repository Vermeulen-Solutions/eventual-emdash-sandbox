# Eventual 0.14.0 release acceptance — 2026-10-14

Eventual `did:plc:g2hei4vcwndrdl3gdbb6np6c/eventual@0.14.0` was accepted, published once, approved by the Registry, and deployed to BBHC Genève. Dates in this record use Europe/Paris; Registry evidence retains its original UTC timestamps.

## Accepted source and verification

Agent 2's handover at `17965c5` was reviewed. Acceptance commit `16a832d` restored seven French weekday translations that the pruning had incorrectly removed. A real EmDash 1.2.0 browser run caught the regression at the Monday checkbox; the corrected French recurrence workflow passes. Shorter help text keeps the backend inside its reserve. MCP descriptions were shortened without changing their validation, routes, permissions or mutation semantics.

The committed source passed the complete pipeline: `validate`, `typecheck`, `build`, `bundle`, `budget`, and Vitest (**26 files / 228 tests**). Packed-package Astro checks passed. All **three** real-host browser workflows passed: boolean switch submission/persistence with the unconfigured feed failing closed; French native content editing, recurrence and publication; and English native collection navigation. Unexpected browser errors: zero. The existing, explicitly classified EmDash nested-form and ComboboxList diagnostics remain visible in the browser evidence.

The unconfigured browser fixture returns the actionable configuration error with the switch off, an empty successful legacy feed when explicitly enabled, and the error again after disabling it. Unit/runtime regressions additionally cover string `"true"` rejection, native-source bypass, public legacy-image 404 without reading storage, role/value validation, and memo invalidation. Native collections were kept intact on BBHC; the absence case was tested on the disposable stock host.

Versions remain `0.14.0` in package and lockfile metadata and in the generated manifest; the CLI derives the manifest version from package.json. The installed publishing CLI is pinned at **0.13.3**, with EmDash compatibility `>=1.2.0 <2.0.0`.

## Documentation and assets

The documented switch label matches `Show old events saved inside the plugin`; the verified boolean form action is `save-legacy-reads`. The release notes now quote the actual error and document the media gate and both memo-invalidating saves. Collection setup clarifies that native collections remain authoritative even when legacy reads are enabled.

The manifest's settings screenshot was at `images/registry-0.13.0/native-fr-settings.png`, rather than `docs/assets/`. It lacked the switch. A fresh capture was inspected against the EmDash 1.2.0 admin renderer and published as `images/registry-0.14.0/native-fr-settings.png`; historical captures were preserved. The French admin shell and collection controls are localized; the new settings explanation/switch retains the current English source strings visible in the capture.

| Registry section | UTF-8 bytes | Graphemes |
| --- | ---: | ---: |
| Installation | 1,896 | 1,892 |
| Changelog | 1,952 | 1,950 |

Both sections are strictly below 20,000 bytes and 2,000 graphemes. Local derivative estimates and the real published CDN checks pass. The banner derivative is 958,008 bytes (a warning, below the 1 MiB proxy cap).

## Published artifact and record identities

| Registry archive entry | Decompressed bytes |
| --- | ---: |
| backend.js | 130,764 |
| manifest.json | 46,284 |
| README.md | 21,472 |
| Total, three files | 198,520 |

Backend headroom: **52 bytes** below the 130,816-byte reserve and 308 bytes below the 131,072-byte hard limit. Total/file-count reserve checks pass.

- Registry gzip: **52,428 bytes**; SHA-256 `6fd95c5363d9405d55c1a96a8c83e66baef6702b574510335697b7eb8b158fe2`.
- Signed artifact checksum: `bciqg7wk4knr5sqc5kxa2s2umqptgxlxwoavvoriqgnljpn7lrmky7yq`.
- Package blob CID: `bafkreidp3fofgy6zibovlqnjnkgihztlv33hak2xiuidgvuxw7vywfmp4i`.
- Release URI: `at://did:plc:g2hei4vcwndrdl3gdbb6np6c/com.emdashcms.experimental.package.release/eventual:0.14.0`.
- Release CID: `bafyreib557wyteme4yjlbzcxmgw3t5cvgqwbzffru4x34geddx47xcxp2y`; exact-CID `listing-passed` at `2026-10-13T23:06:15.647Z`.
- Profile CID at publication: `bafyreibptjmn5jildzp4c2tv6rnpdzyen4lnbw67xgdbfofmi3oo4ivhcm`; exact-CID `listing-passed` at `2026-10-13T23:05:58.423Z`.

The installation/changelog profile update was previewed and applied once. Publication then stamped a new profile revision. At both transitions, the signed publisher and indexed records were compared; the site update waited for matching records and current approvals. Old-CID approvals were not reused. The final package downloaded from the publisher's DID-resolved PDS is byte-for-byte identical to the archive created by publication. `releaseOverwritten` is false. Provenance is absent and optional under this package's existing policy.

The local npm host tarball is **144,973 bytes / 67 files**, SHA-256 `f28477072d645fbd3dc6b380ccaed2932ab5cb70fcb09b6cd95bbb4c0a87b972`. Its final documentation correction was compared against the browser-tested tarball: only `package/docs/collection-setup.md` differs; every runtime and other packaged file is identical. BBHC's installed runtime SHA-256 is `27a97351e2d9801378e839a7339907bf17fdd72fde00b57e9211c287b7c3d132`.

## BBHC production acceptance

BBHC's production Registry plugin `r_hxn32uyal53iahxf` was updated through the native Registry endpoint from **0.13.4 to 0.14.0**. The update acknowledged the changed MCP settings/tool metadata against the exact approved CIDs; capability additions/removals are empty, and plugin MCP access remains disabled. Local Node uses `vendor/eventual-0.14.0.tgz`; Cloudflare uses the Registry installation.

Worker **`e89a445a-01e8-4353-81e3-4f052b5f769b`** was deployed at <https://bbhc-emdash.vsol-adf3c7.workers.dev>. The site's 23 defined tests, 138-file typecheck and both builds passed. Production acceptance covers six French feed windows in 2025/2026, FR/EN index/archive pages, the 2025 archive, a native event detail, site `.ics`, plugin French calendar and native featured image. All return 200; event feeds retain `locale: fr`, with no `[EN]` fallback markers or retired media references. The 33 French events and 8 venues retain their exact pre-release schema/content hashes. `legacyReads` remains unset; defaultTimezone remains UTC in production.

Detailed deployment, content-preservation and rollback evidence is in the site's `audit/deployments/2026-10-14-eventual-0.14.0/README.md`. The pre-existing sandbox RPC constraint still requires BBHC's range bisection for large archives.

## Evidence and repository state

Publication/verification logs are retained locally under `reports/release-0.14.0/`, including `publish.log`, `registry-records.json`, `registry-verification.json`, `registry-info.json`, `budget-published.log`, `registry-media-published.log`, `vitest-final.log`, `editor-host-final.log`, and `host-equivalence.json`. Public release evidence is retained in this directory's `evidence/` folder. These are publication-time records; later documentation/profile updates do not rewrite their identities.

The four 0.14.0 implementation/audit/acceptance commits through `16a832d` were pushed to main so Registry documentation links resolve. The existing modifications to `scripts/verify-editor-host.mjs` and `scripts/verify-packed-astro.mjs` were used for verification and left unmodified and uncommitted. Package checks and browser captures completed before publication; no version bump, overwrite, content migration or reseed was performed.
