## 0.13.0 - breaking native-content release

**Breaking from 0.12.x and earlier; EmDash >=1.2.0 <2.0.0 required.** Back up and follow the [upgrade guide](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/blob/main/docs/upgrade-0.13.0.md). Updating the plugin does not create or convert schemas.

- Native content types own Portable Text, media, locales, drafts, revisions and publishing. The self-contained sandbox adds schedule/recurrence/occurrence controls.
- Select event, venue and organizer collections. Compatible locations and custom names are supported.
- Saved-entry panel: timed/all-day dates, daily/weekly/monthly rules, native directories and 90-day occurrence changes. Edits remain drafts.
- Clean new-site schemas: 19 event fields, no default prototype metadata/snapshots/history, one comma-separated category input and no duplicate panel control. Existing fields are not deleted automatically.
- Optional schema exporter/MCP guide; no mandatory Eventual frontend or second runtime package. Remove historical eventual/install adapters from EmDash 1.2 hosts.
- Native MCP inspection/export, dependency guards, safe duplication and explicit non-destructive migration with opt-in compatibility schemas.
- Multilingual strict/fallback JSON/ICS, stable UIDs, cancellation notices, UTF-8 folding, rich description blocks and optional Astro/JSON-LD.

Legacy data remains, but private forms are removed. Native sources are authoritative while empty; plan activation/migration together. Preserve migrated calendar identity. Internal fields remain visible in stock core; no hidden Advanced renderer is claimed. Styling is unchanged.

## 0.12.1

Unreleased two-package proposal, superseded by 0.13.0; do not install its draft host artifacts on EmDash 1.2.

## Earlier releases

See CHANGELOG.md and GitHub releases.
