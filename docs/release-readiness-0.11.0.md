# Eventual 0.11.0 release readiness

Prepared on 2026-10-04. This is release preparation, not registry publication.

## Completed locally

- Version and linked lockfiles: 0.11.0.
- Changelog, release notes and registry installation section updated, each profile section within the 2,000-grapheme limit.
- Icon, banner and six screenshots wired into release artifacts. Images stay outside the installation archive.
- Typecheck, manifest validation and 112 plugin tests pass; six tooling tests and two profiling tests pass.
- Astro example: zero diagnostics, 29 tests and built-page JSON-LD verification pass.
- Local EmDash site: zero diagnostics and fifteen integration groups pass in development and built production, using isolated SQLite backups.
- Configured-plugin upgrade: actual 0.10.0 source creates a legacy venue/event, then 0.11.0 preserves their stored payloads and public defaults. New indexes materialize on the scheduler tick; changed MCP tools require renewed consent. This upgrade check and the fifteen integration groups pass together (sixteen groups).
- [GitHub CI](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/actions/runs/37230982375) passes in UTC and America/New_York for release commit `f9fa43b`.
- The 0.11.0 draft on [GitHub Releases](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/releases) targets `f9fa43b` and contains the prepared archive. GitHub's uploaded-asset SHA-256 agrees with the local checksum below. The draft remains unpublished.
- Issues filed: extensions #1, calendar revisions #2, tooling maintenance #3.
- Publisher identity matches the manifest. PDS and aggregator return the same approved current profile CID, `bafyreiayr6jfyhycosvqz3n2inru4qohffwrj2rey64upgkzjq7rpr5egu`, with an exact-CID `listing-passed` label. The published 0.10.0 release has its separate passed label.
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

Prepared tarball SHA-256: `32ea7fbd531d9ee14c2898dd391d71602e86c80ab023516746526cb24b148647`. Publication rebuilds the archive; record and verify the checksum from that publication separately.

## Publication steps still outstanding

### Deployment status

The profile update was applied on 2026-10-04. Its initial CID
`bafyreifbrjztgozpsmof3kafmxbqrgxk32glygkt5mprpv6i2qwfuc3dem` received an
exact-CID `listing-passed` assessment, but the aggregator initially returned
`ListingUnavailable`. On 2026-10-05, the aggregator began serving the current
profile CID `bafyreibfzbnnf674xonpa753cnmjnkcrvhbzvblln237dpntb53yoaj5wm`,
which also has an exact-CID `listing-passed` label.

The 0.11.0 release was then published to the PDS. Release URI:
`at://did:plc:g2hei4vcwndrdl3gdbb6np6c/com.emdashcms.experimental.package.release/eventual:0.11.0`;
release CID `bafyreib4lrtg62z63qi5pqwjpfw273mn5acgwcnqybh5q7v6w2dof5y47u`;
checksum multihash `bciqbigj4ia652d6tijofqzl3ximo4tga6m4fm2joejdsuh67kjv6ejy`.
The listing assessment for that exact release CID is currently `pending`; the
aggregator still reports 0.10.0 as latest and has no 0.11.0 release label.
The GitHub release remains a draft until the 0.11.0 release itself receives
an exact-CID `listing-passed` label and becomes available through the
aggregator. Check with `npm exec emdash-plugin -- info vermeulen.solutions eventual --version 0.11.0 --json`.

1. Review the additive storage contract and the disclosed version-policy choice in the release notes.
2. The approved profile is served by the aggregator, and the 0.11.0 PDS release record has been created once. Wait for the exact release CID to pass and appear as latest in the aggregator; do not overwrite the version.
3. Verify profile and release labels independently, then test the actual registry-installed 0.10.0-to-0.11.0 upgrade and MCP consent on an isolated site. A configured-plugin upgrade check cannot validate registry download/approval/consent behavior.
4. Publish the GitHub draft release only when the registry release verification is complete.

The inherited iCalendar SEQUENCE limitation remains tracked in #2. Known test-stack advisories and the Windows workerd workaround remain tracked in #3; neither is included in the sandbox archive.
