# Eventual 0.14.1 acceptance record

Status: local acceptance complete except publication. **Not published.**
Date: 2026-10-30. Machine-readable evidence is in
[`evidence/summary.json`](evidence/summary.json) with the logs, editor report,
release-preparation report and both native-site reports beside it.

## Scope

Compatibility release. No runtime API, capability, schema, route or MCP-tool
changes. The Registry install range stays `>=1.2.0 <2.0.0`; EmDash 1.4.0 is the
recommended host.

Source revision at preparation: sandbox `ce57e95` with the compatibility
working tree; local test site `4e182c7` with the 1.4.0/native-gate working tree.
Commit these trees before tagging.

## Host matrix

| Host | Result | Evidence |
| --- | --- | --- |
| EmDash 1.2.0 | PASS | `reports/compat-1.2.0.log`: 26 test files, 228 tests, 24 tooling tests, bundle and budget |
| EmDash 1.4.0 | PASS | Unit/tooling suite, packed consumer, editor acceptance, local test site |

## 1.4.0 evidence

- `npm run validate`: manifest valid.
- `npm run typecheck`: zero errors (`reports/native-typecheck.log`).
- `npm test` in UTC and America/New_York: 26 files, 228 tests passed in each
  run (`reports/native-full-tests.log`, `reports/native-full-tests-new-york.log`).
- `npm run test:tooling`: 24 tests passed, including both Block Kit renderer
  shapes and the 1.2/1.4 source gate (`reports/native-tooling.log`).
- `npm run build`, `npm run bundle`, `npm run budget`, `npm run profile`: passed.
  Runtime 130,764 bytes; total 184,910 bytes; no budget errors.
- `npm run test:package`: packed consumer on EmDash 1.4.0, source package
  SHA-256 `a8585d13bece54a3ae412d514f857a91912960deccfa1e4d3564a6461b3db6a8`.
- `npm run test:editor`: 3/3 Playwright tests passed;
  `reports/editor-installation.json` records `emdashVersion: "1.4.0"`, the
  packed source SHA-256 above, and zero unexpected browser errors.

## Local test site (EmDash 1.4.0)

`eventual-emdash-test-site` on `@emdash-cms/sandbox-workerd` 0.9.6 and Eventual
0.14.1. Native gate in development and production: six groups passed in each
run (`.test-results/native-1793375936021` and `native-1793375977200`).

- Sandbox registration, 23 MCP tools, consent and scoped authentication.
- Block Kit validation for events, venues, organizers, settings and widget.
- Published native events in the public JSON feed.
- Native `getEvent` and the real event detail page/JSON-LD.
- Per-event ICS (subscription route recorded as a known budget limitation).
- Draft duplication through `ctx.content.create`.

Evidence: `eventual-emdash-test-site/.test-results/latest-native.json`
(`built: true`) and the matching run directory `report.json`/`server.log`.

Known limitation: the full-year subscription calendar returned HTTP 503
("The sandbox RPC budget is exceeded") with five native events. The JSON feed
and per-event ICS passed. This is the documented ten-bridge-call limit, not a
1.4.0 regression.

The pre-0.13 legacy integration script is retained as
`test:integration:legacy`; it is not a valid gate for a native 0.14 site because
legacy writes intentionally return `NATIVE_COLLECTIONS_ACTIVE`.

The editor acceptance regenerated the historical `images/registry-0.13.0/*`
captures under EmDash 1.4. They were reverted to keep this compatibility release
scoped; `npm run registry:media` passes with the committed images. Refreshing
those historical captures is a separate listing change.

## Release artifacts

`npm run release:prepare` passed with `published: false`:

| Artifact | Bytes | SHA-256 |
| --- | --- | --- |
| `dist/eventual-0.14.1.tar.gz` | 47,393 | `1e05fd48939a4173d8c9a4b83013a4d28e476f4858dbb782e4bf196b8459bcf0` |
| `dist/source/eventual-0.14.1.tgz` | 131,696 | `a8585d13bece54a3ae412d514f857a91912960deccfa1e4d3564a6461b3db6a8` |

The source package hash matches `reports/editor-installation.json` and
`reports/packed-astro.json`; `reports/release-preparation.json` and
`dist/SHA256SUMS` are the local evidence. Do not edit packaged files after
`test:package`/`test:editor`; their hash is checked by release preparation.

Publication is intentionally not performed. Fill publication CIDs and the
tag/commit here after the release is approved.
