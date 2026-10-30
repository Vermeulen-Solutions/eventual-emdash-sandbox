# Eventual 0.14.1 acceptance record

Status: **published and approved by the Registry**. Current signed profile and
release CIDs match the approved Registry index; see the publication record below.
Date: 2026-10-30. Machine-readable evidence is in
[`evidence/summary.json`](evidence/summary.json) with the logs, editor report,
release-preparation report and both native-site reports beside it.

## Scope

Compatibility release. No runtime API, capability, schema, route or MCP-tool
changes. The Registry install range stays `>=1.2.0 <2.0.0`; EmDash 1.4.0 is the
recommended host.

Source revision at preparation: sandbox `ce57e95` with the compatibility
working tree; local test site `4e182c7` with the 1.4.0/native-gate working tree.
Accepted sandbox source was committed and pushed as `f0d5bc0`. The local test
site retains its separate working tree. No release tag was created.

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

## Prepared release artifacts

`npm run release:prepare` passed with `published: false`:

| Artifact | Bytes | SHA-256 |
| --- | --- | --- |
| `dist/eventual-0.14.1.tar.gz` | 47,393 | `1e05fd48939a4173d8c9a4b83013a4d28e476f4858dbb782e4bf196b8459bcf0` |
| `dist/source/eventual-0.14.1.tgz` | 131,696 | `a8585d13bece54a3ae412d514f857a91912960deccfa1e4d3564a6461b3db6a8` |

The source package hash matches `reports/editor-installation.json` and
`reports/packed-astro.json`; `reports/release-preparation.json` and
`dist/SHA256SUMS` are the local evidence. Do not edit packaged files after
`test:package`/`test:editor`; their hash is checked by release preparation.

These are preparation-time hashes. Publication rebuilds the Registry gzip;
the final published identity is recorded below. The accepted source package
remains unchanged.

## Registry publication — 30 October 2026

Published once from accepted source `f0d5bc0`, using the pinned plugin CLI
**0.13.5** and publisher `did:plc:g2hei4vcwndrdl3gdbb6np6c`.
`releaseOverwritten` is **false**. No tag or site deployment was performed.

- [Registry listing](https://plugins.emdashcms.com/plugins/@vermeulen.solutions/eventual).
- Release URI: `at://did:plc:g2hei4vcwndrdl3gdbb6np6c/com.emdashcms.experimental.package.release/eventual:0.14.1`.
- Release CID: `bafyreiamjf6qbqltgrjdoun2qynu7e5ynuswchu6tz6arwvmbwstjwhhxq`.
- Current profile CID: `bafyreiddvxfmh3kbganattryirzh53flamsceq5e6qrbc4bw7fwj5aan7q`.
- Both current CIDs have exact-CID `listing-passed` labels. Both match the
  publisher's signed records and the Registry index; 0.14.1 is installable.
- Published Registry gzip: **47,391 bytes**, SHA-256
  `26e9b1beb65e456ec49c577493b84d9a24120f19c3eb892ead8139f9bb47a481`.
- Signed checksum: `bciqcn2nrx23f4rloysofo5etxbgzujasb4m4h24jf2wycopzxnd2jai`.
- Package blob CID: `bafkreibg5gy35ns6ivxmjhcxosj3qtm2eqja6god5oes5lmbhh43wr5eqe`.
- Accepted source package remains **131,696 bytes**, SHA-256
  `a8585d13bece54a3ae412d514f857a91912960deccfa1e4d3564a6461b3db6a8`.

The installation/changelog profile update was previewed, applied once, and
approved before publication. Publication stamped another profile revision;
that final revision was independently checked for exact-CID approval.

The package downloaded from the DID-resolved publisher PDS matches the local
publication archive byte-for-byte. The runtime matches 0.14.0 and the accepted
source package; the runtime manifest differs from 0.14.0 only in version.
The Registry README also matches the accepted source package. Publication's
rebuilt gzip has a different checksum from the preparation-time archive above.
The payload remains three files / 184,910 bytes, with no budget errors.

All seven actual published CDN image derivatives pass, with zero violations.
The existing banner has a size warning at 958,008 bytes, below the 1 MiB cap.

Public evidence: [`evidence/publication.json`](evidence/publication.json) and
[`evidence/registry-verification.json`](evidence/registry-verification.json).
Detailed command logs remain in `reports/release-0.14.1/`. The historical
release-preparation report retains `published:false` to describe its original
pre-publication run; it is superseded by this publication record.
