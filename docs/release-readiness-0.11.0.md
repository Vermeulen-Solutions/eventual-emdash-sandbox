# Eventual 0.11.0 release readiness

Prepared on 2026-10-04; registry and GitHub publication completed on 2026-10-05.

## Completed locally

- Version and linked lockfiles: 0.11.0.
- Changelog, release notes and registry installation section updated, each profile section within the 2,000-grapheme limit.
- Icon, banner and six screenshots wired into release artifacts. Images stay outside the installation archive.
- Typecheck, manifest validation and 112 plugin tests pass; six tooling tests and two profiling tests pass.
- Astro example: zero diagnostics, 29 tests and built-page JSON-LD verification pass.
- Local EmDash site: zero diagnostics and fifteen integration groups pass in development and built production, using isolated SQLite backups.
- Configured-plugin upgrade: actual 0.10.0 source creates a legacy venue/event, then 0.11.0 preserves their stored payloads and public defaults. New indexes materialize on the scheduler tick; changed MCP tools require renewed consent. This upgrade check and the fifteen integration groups pass together (sixteen groups).
- [GitHub CI](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/actions/runs/37230982375) passes in UTC and America/New_York for release commit `f9fa43b`.
- The [GitHub 0.11.0 release](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/releases/tag/v0.11.0) is published, targets `f9fa43b`, and contains the prepared archive. GitHub's uploaded-asset SHA-256 agrees with the local checksum below.
- Issues filed: extensions #1, calendar revisions #2, tooling maintenance #3.
- Publisher identity matches the manifest. PDS and aggregator return the same approved current profile CID, `bafyreibfzbnnf674xonpa753cnmjnkcrvhbzvblln237dpntb53yoaj5wm`, with an exact-CID `listing-passed` label. The published 0.10.0 release has its separate passed label.
- `emdash-plugin update-package` dry-run previews the installation/changelog changes. No signed record was written.

## Prepared archive

`dist/eventual-0.11.0.tar.gz` contains only:

| File | Uncompressed bytes |
| --- | ---: |
| backend.js | 108649 |
| manifest.json | 44765 |
| README.md | 23399 |
| Total | 176813 |

Three files; runtime 106.1 KiB and total 172.7 KiB. Passes the working 110 KiB/file, 220 KiB total and 16-file budgets, and EmDash's hard 128 KiB/file, 256 KiB total and 20-file limits.

Prepared tarball SHA-256: `32ea7fbd531d9ee14c2898dd391d71602e86c80ab023516746526cb24b148647`. The published release asset was verified against this SHA-256.

## Publication status

### Deployment status

The profile update was applied on 2026-10-04. Its initial CID
`bafyreifbrjztgozpsmof3kafmxbqrgxk32glygkt5mprpv6i2qwfuc3dem` received an
exact-CID `listing-passed` assessment, but the aggregator initially returned
`ListingUnavailable`. On 2026-10-05, the aggregator began serving the current
profile CID `bafyreibfzbnnf674xonpa753cnmjnkcrvhbzvblln237dpntb53yoaj5wm`,
which also has an exact-CID `listing-passed` label.

The 0.11.0 release was published to the PDS. Release URI:
`at://did:plc:g2hei4vcwndrdl3gdbb6np6c/com.emdashcms.experimental.package.release/eventual:0.11.0`;
release CID `bafyreib4lrtg62z63qi5pqwjpfw273mn5acgwcnqybh5q7v6w2dof5y47u`;
checksum multihash `bciqbigj4ia652d6tijofqzl3ximo4tga6m4fm2joejdsuh67kjv6ejy`.
That exact release CID has an active `listing-passed` label, and the aggregator
reports 0.11.0 as latest. The GitHub release is published.

The remaining follow-up is to test the actual registry-installed 0.10.0-to-0.11.0 upgrade and MCP consent on an isolated site. The configured-plugin upgrade check does not validate registry download/approval/consent behavior.

The inherited iCalendar SEQUENCE limitation remains tracked in #2. Known test-stack advisories and the Windows workerd workaround remain tracked in #3; neither is included in the sandbox archive.
