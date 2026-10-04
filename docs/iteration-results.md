# Implementation and verification — 2026-10-04

Changes are based on commit `57c8f13`. Verification was completed locally before committing. No plugin was
published or installed on a live site; no GitHub issues were opened.

## Completed

- Review fixes: safe JSON-LD embedding, HTTP(S) URL validation, MCP field updates
  and exception validation, publication/status consistency, hybrid locations and
  calendar links, and headless feed validation.
- CI with locked installations and UTC / America/New_York matrices, type checks,
  runtime tests, host-tool tests, actual archive budgets and built Astro page tests.
- Structured public venue addresses with legacy formatted address compatibility.
- Optional saved organizers, admin creation/editing and event selection, MCP
  tools, version-guarded edits, public metadata and Schema.org organizer URLs.
- Bounded schedule history, rescheduled previousStartDate, original dates for
  moved occurrences, and duplicates without inherited history.
- Paginated JSON data export and draft-first import/restore. Server validation,
  reference checks, row errors and atomic insert-only deduplication. Host-side
  CSV and limited ICS conversion, typed helpers, batching and a local converter.
- Deterministic storage-call budgets and host profiling reports.
- Compatible http-cache-semantics lock update in both projects; corrected the
  example's local Eventual version in its lockfile.

## Final archive

Measured from the actual CLI tar.gz payload, excluding tar padding and gzip.

| Item | Bytes | KiB |
| --- | ---: | ---: |
| backend.js / dist/plugin.mjs | 108,649 | 106.1 |
| manifest.json | 44,765 | 43.7 |
| README.md | 23,313 | 22.8 |
| Total, 3 files | 176,727 | 172.6 |

Working ceilings: 110 KiB per file, 220 KiB total, 16 files. Hard limits:
128 KiB, 256 KiB, 20 files. The runtime retains 22,423 bytes of hard-limit
headroom and 3,991 bytes under the working ceiling. CSV/ICS parsers, CI,
profiling tools and the Astro helper run outside the installation archive.
The runtime contains no Zod MCP schema implementation.

## Verification

- `npm ci` succeeded in both projects using their lockfiles.
- `npm run typecheck` passed.
- `npm test` passed: 15 files, 112 tests, under the local timezone and America/New_York.
- `npm run bundle` and `npm run validate` passed the installed CLI checks.
- `npm run budget` passed all working budgets.
- `npm run test:tooling` passed 6 tests.
- `npm run profile` passed 2 call-budget scenarios.
- Astro `npm run check`: 23 files, zero diagnostics, in both timezones.
- Astro `npm test`: 5 files, 29 tests, in both timezones.
- Astro `npm run test:page` passed in both timezones: actual built-page JSON-LD
  escaping, parsed payload preservation, hybrid locations, relative image URL,
  safe meeting link and French lifecycle label.
- Real local EmDash test-site integration: 15 groups against both development
  and the built production server, using the actual sandbox runners and MCP
  transport. Browser checks covered attendance conditions, event save/edit,
  organizer creation, public lifecycle labels, meeting links and calendar menus.
  See `../eventual-emdash-test-site/docs/eventual-integration-results.md`.
- Live workerd tests exposed its permissive empty-host URL parser; HTTP(S)
  validation now requires a hostname. Visual inspection exposed empty image
  URLs resolving to the homepage; both Astro consumers now omit those images.
- `git diff --check` passed.

The integration tests also exercise simultaneous real imports, read-back of
stored data, restore across fresh hosts, venue/organizer references, recurrence
cancellations, missing-reference preview warnings, malformed rows, and exact
seconds/instants during a repeated DST hour.

## Limits and deferred work

The transfer tools export event/venue/organizer data, not a complete site backup.
Media, settings and subscription cancellation tombstones need host backup tools.
Unsupported ICS recurrence/timezone constructs are rejected explicitly.

Profiling is diagnostic, not a production sandbox CPU measurement. The initial
Node mock measured 500 single events at 150,455 JSON bytes with 5 event queries
and one lookup each for venues and organizers. One hundred daily series over
31 days expanded to 3,100 events and 963,855 bytes with one query and two batch
lookups. Current measurements are written to ignored `reports/` files by
`npm run profile`; elapsed times vary by environment.

The Astro example dependency audit is clean. The pinned Miniflare/Cloudflare
development stack still reports 5 findings, including its exact Undici 7.29.0
dependency. Those modules are excluded from the installation archive. A toolchain
upgrade and the existing calendar SEQUENCE migration are recorded alongside the
deliberately deferred RSVP, private access, full recurrence and cache work in
[future-work.md](future-work.md). Release preparation still requires a version
bump and an installed-site upgrade test for the new storage collection/index.
