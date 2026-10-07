> **Historical record:** Current behavior is documented in [0.13.0 release notes](release-notes-0.13.0.md) and the [breaking upgrade guide](upgrade-0.13.0.md). Host-package, hidden-field and publication-status statements below describe superseded work, not current instructions.

> Historical two-package proposal — superseded. Do not follow the installation or publication commands below. The current unpublished candidate uses native EmDash 1.2 collections, a sandbox saved-entry panel and optional schema setup only. See [Collection setup](collection-setup.md) and [Registry installation](registry-installation.md). Publication remains on hold.

> **Superseded installation proposal:** The current candidate is self-contained. Do not follow a two-package installation requirement below. See [self-contained architecture](./self-contained-plugin.md) and [current installation](./registry-installation.md). Historical evidence below refers to the earlier companion candidate; publication is on hold.

# Eventual 0.12.1

This recovery release restores friendly editing after the initial native-collection modernization. Current public styling is preserved. The registry backend and matching host package must be installed together.

## Changes

- Native Portable Text, media, drafts, revisions and publishing, with shared schedule fields and locale-specific editorial content.
- Friendly local date/time and daily/weekly/monthly recurrence forms; cancellation, restoration, rescheduling and localized announcements in the 90-day occurrence inspector. Core draft review remains required.
- English/French admin presentation independent of content language, optional-field disclosures and human draft summaries; technical JSON and migration metadata stay stored but hidden.
- Grouped venue/organizer translations, name/address search, draft warnings, retained selection IDs and native directory links. Unpublished dependencies cannot satisfy publication.
- Corrected native reference storage and hydration, preserved live/draft/history selections, safe duplication, bounded schedule history and native MCP/export authority.
- Stable multilingual/migrated calendar UIDs, logical SEQUENCE, committed-state cancellations and UTF-8 folding/escaping.
- One `eventual/install` integration with compatibility guards, compiled schema exports and an offline backed-up SQLite upgrade CLI.

## Required host installation

Tested: Node 24; EmDash/Admin/Block Kit exactly 1.0.1; Astro 7.3.x (>=7.3.2); Vite 8.3.x; React 19. Unknown core builds are rejected rather than applying uncertain source transforms.

Install the host tarball attached to this GitHub release:

```sh
npm install https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/releases/download/v0.12.1/eventual-0.12.1.tgz
```

Use `eventual/install` in the existing Astro config, retaining its database, storage and sandbox runner. Registry-managed sites must not register a second source backend. Follow [editor-upgrade.md](editor-upgrade.md); updating a registry plugin or blueprint does not upgrade installed schemas.

Stop SQLite writers, preview the supplied upgrade, apply with a new consistent backup, then rerun its preview and the editorial checklist. Existing relation-bound D1 sites require equivalent reviewed deployment-specific migration tooling. Legacy records and old reference edges are retained; do not purge them as routine cleanup.

## Verification and limits

Acceptance includes UTC/New York plugin tests, tooling/SQLite upgrade preservation, strict TypeScript, packed Astro consumers and real installed-package browser workflows for draft review, publication, venue persistence and occurrence cancellation/restoration. All seven public views, detail pages, empty states and error states are visually reviewed on desktop/mobile. The existing design is preserved; image-less agenda rows now use the available content width. Exact final evidence and artifact checksums are recorded in [the publication report](publication-0.12.1.md).

External Google/Apple/Outlook refresh behavior and live LinguaDash service acceptance are not certified by local tests. Cross-request event-publication/dependency-deletion atomicity requires host/core transactional support. Deployed D1 migration and large-site load testing remain site-specific. See [the detailed handoff](release-refinements-2026-10-07.md) for these boundaries.

Registry capabilities include content/publication/revisions, schema read, content policy, scoped draft read/patch and media; there is no schema-write or outbound-host permission. The frontend companion declares no backend capabilities. Existing installations must review the updated editor-draft capability consent.
