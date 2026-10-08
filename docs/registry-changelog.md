## 0.13.2

- Memoize settings, schema, directories and canonical URLs per invocation.
- Replace per-group calendar RPCs with one atomic snapshot commit, preserving UIDs, sequences and cancellations.
- Fetch public images directly; batch legacy import reads/cancellation writes; report pending import rows.
- Guarded operations stop before an eleventh bridge call; feeds fail explicitly instead of returning partial results.
- Large-source/bulk-URL support and migration job redesign remain pending. Local tests do not certify Cloudflare CPU limits. See [release notes](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/blob/main/docs/release-notes-0.13.2.md) and [upstream API issue](https://github.com/emdash-cms/emdash/issues/4004).

## 0.13.1

- Public featured images use the plugin streamer instead of private CMS media URLs.

## 0.13.0 — breaking native-content release

Requires EmDash >=1.2.0 <2.0.0. Upgrades from 0.12.x or earlier need backups, schema review and explicit migration; updating the plugin does not create or convert schemas.

- Native collections own Portable Text, media, locale rows, drafts, revisions and publishing.
- Configurable event, venue and organizer collections; self-contained saved-entry schedule/recurrence/occurrence panel.
- Optional schema exporter/MCP setup guide; no mandatory frontend companion.
- Multilingual strict/fallback JSON/ICS, stable UIDs, cancellations, UTF-8 folding, optional Astro/JSON-LD.

See CHANGELOG.md for earlier releases.
