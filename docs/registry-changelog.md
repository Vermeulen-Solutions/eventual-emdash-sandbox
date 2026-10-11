## 0.13.4

- Replace the registry gallery screenshot whose derived image exceeded EmDash's 1 MiB artifact proxy cap (0.11.0–0.13.3 galleries). Registry media budgets now run in CI and release preparation. No runtime changes. See [release notes](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/blob/main/docs/release-notes-0.13.4.md).

## 0.13.3

- Add publicUrls=false to publicEvents and the Astro helper to skip canonical URL RPCs when a site supplies links. Default: true.
- Budget failures use EmDash's JSON error contract, correcting successful raw error envelopes.
- Preserve content, locales, relationships and media; large-source pagination remains deferred. See [release notes](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/blob/main/docs/release-notes-0.13.3.md).

## 0.13.2

- Memoize settings, schema, directories and canonical URLs per invocation.
- Replace per-group calendar RPCs with one atomic snapshot commit, preserving UIDs, sequences and cancellations.
- Fetch public images directly; batch legacy import reads/cancellation writes; report pending import rows.
- Guarded operations stop before an eleventh bridge call; feeds fail explicitly instead of returning partial results.
- Large-source/bulk-URL support and migration job redesign remain pending. Local tests do not certify Cloudflare CPU limits. See [release notes](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/blob/main/docs/release-notes-0.13.2.md).

## 0.13.1

- Public featured images use the plugin streamer instead of private CMS media URLs.

## 0.13.0 — breaking native-content release

Requires EmDash >=1.2.0 <2.0.0. Native collections own Portable Text, media, locale rows, drafts, revisions and publishing; upgrades from 0.12.x or earlier need backups, schema review and explicit migration. See the [upgrade guide](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/blob/main/docs/upgrade-0.13.0.md).

See CHANGELOG.md for earlier releases.
