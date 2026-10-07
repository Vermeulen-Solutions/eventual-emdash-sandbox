# Eventual 0.12.1 publication acceptance — 2026-10-07

This report supersedes the 0.12.0 candidate artifact identities in `release-refinements-2026-10-07.md`. The already-published 0.12.0 is not overwritten. Publication is authorized by the user, contingent on completing release checks. Registry writes and approval results will be recorded below when performed.

## Local acceptance

- Plugin manifest validation and TypeScript: passed.
- Plugin suite: 21 files / 170 tests passed separately with `TZ=UTC` and `TZ=America/New_York`; no unhandled errors.
- Tooling: 17 tests passed, including integration guards, French presentation and backed-up SQLite schema/reference upgrade preservation.
- Profiling suite and bundle budgets: passed. Backend is 115,916 bytes; three decompressed registry files total 180,090 bytes. The hard limits remain 128 KiB per file / 256 KiB total / 20 files.
- Fresh 0.12.1 host tarball: installed in a clean Astro consumer; check/build and import surfaces passed.
- Real packed-install browser acceptance: both workflows passed without skipped tests, retries or flakes. Covered French admin forms, grouped/searchable venues, selection persistence, native draft save/review/publication, recurrence cancellation/restoration and rejecting draft venue publication.
- Public Astro example: 23 source files checked without errors/warnings/hints; 29 tests passed; production build and rendered-page/JSON-LD checks passed.
- Public browser capture: all seven views (list, timeline, cards, schedule, dates, month, locations), event detail with the calendar menu open, empty state and unavailable state, each at 1440×1000 and 390×844. All 20 captures inspected. No browser page errors or populated-page horizontal overflow. The unavailable fixture returns 502 intentionally.
- Final visual review fixed image-less agenda rows being auto-placed into the reserved image column. Only grid placement was corrected; the existing fonts, colors, spacing tokens and visual design are retained. A browser width assertion protects this regression, and public visual capture is included in CI and release preparation.
- Production dependency audit: zero reported vulnerabilities. Whitespace check: passed.

Local evidence is ignored build output under `reports/`: `refinement-unit.log`, `refinement-unit-new-york.log`, `refinement-tooling.log`, `refinement-typecheck.log`, `refinement-packed.log`, `refinement-browser.log`, `publication-example-check.log`, `publication-example-tests.log`, `publication-example-page.log`, `publication-public-visual.log`, `public-visual/`, `publication-audit.json` and `release-preparation.json`.

## Prepared host artifact

- File: `dist/host/eventual-0.12.1.tgz`.
- Size: 121,238 bytes; 53 package files.
- SHA-256: `3387aed22ab5af91149b68aed6c5029d894a38ac6be4b7078cc4d4b55266f18d`.
- This exact host tarball passed installed-package browser acceptance and must be the GitHub release asset. Regenerating it after editing any packaged source requires repeating packed installation/browser acceptance.
- Backend gzip bytes/checksum can change when the publisher rebuilds the tarball. The final published checksum must be checked against the artifact produced by that publication, not an earlier prepared archive.

## Installation contract

Both the registry backend and the matching GitHub host tarball are required. The registry alone cannot install host-side Astro/editor compatibility adapters. Node 24, EmDash/Admin/Block Kit exactly 1.0.1, Astro 7.3.x (>=7.3.2), Vite 8.3.x and React 19 are the supported tested matrix. Use `eventual/install`, preserve the site's configured runner/database/storage, and do not add a second source backend on a registry-managed site.

Existing native collections need the offline backed-up schema/reference upgrade in `editor-upgrade.md`; updating a blueprint is insufficient. The supplied upgrade tool supports SQLite. Deployed D1 upgrades need equivalent reviewed site-specific tooling. Legacy storage and old reference edges are retained deliberately, not purged. Existing installations must review the new scoped editor-draft capability consent.

## Explicit limits

These checks do not certify external Google/Apple/Outlook subscription refresh, a live LinguaDash translation service, remote D1 migration or large-site load. Cross-request publication/dependency deletion atomicity requires core transactional support. Public capture uses production-built example pages and local CMS fixtures; it is not a visual test of an unrelated deployed production site. The previous detailed handoff explains these boundaries.

## Publication records

Pending: source commit, GitHub release, signed package-profile update and exact-CID approval, versioned registry release and checksum verification. Do not describe the release as registry-installable until both current profile and release records have applicable approval labels.
