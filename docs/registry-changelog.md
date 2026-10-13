## 0.14.0

- Public reads use private plugin storage only when an administrator enables **Read legacy events** (MCP `legacyReads`); a missing collection now fails instead of serving pre-0.13 records under an assumed locale.

## 0.13.4

- Replace the registry gallery screenshot whose derived image exceeded EmDash's 1 MiB artifact proxy cap; registry media budgets now run in CI and release preparation. See [release notes](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/blob/main/docs/release-notes-0.13.4.md).

## 0.13.3

- Add publicUrls=false to publicEvents and the Astro helper to skip canonical URL RPCs. Default: true.
- Budget failures use EmDash's JSON error contract. Large-source pagination remains deferred. See [release notes](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/blob/main/docs/release-notes-0.13.3.md).

## 0.13.2

- Memoize settings, schema, directories and canonical URLs per invocation; one atomic calendar snapshot preserves UIDs, sequences and cancellations.
- Fetch public images directly; batch legacy import reads; guarded operations stop before an eleventh bridge call and feeds fail explicitly instead of returning partial results.
- Bulk-URL support and the migration job redesign remain pending. See [release notes](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/blob/main/docs/release-notes-0.13.2.md).

## 0.13.1

- Public featured images use the plugin streamer instead of private CMS media URLs.

## 0.13.0 — breaking native-content release

Requires EmDash >=1.2.0 <2.0.0. Native collections own Portable Text, media, locale rows, drafts, revisions and publishing; upgrades from 0.12.x or earlier need backups, schema review and explicit migration. See the [upgrade guide](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/blob/main/docs/upgrade-0.13.0.md).

See CHANGELOG.md for earlier releases.
