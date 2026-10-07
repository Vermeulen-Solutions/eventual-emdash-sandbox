## 0.13.1

- Route public featured event image requests to the plugin's public image streamer endpoint (`/_emdash/api/plugins/eventual/publicEventImage?eventId=<eventId>`) instead of private CMS media asset URLs (`/_emdash/api/media/asset/`), preventing 401 Unauthorized errors on unauthenticated Astro frontends.
- Hydrate `event.imageUrl` from `featuredMediaId` / `imageMediaId` in `hydrateNativeAssets`, `formatPublicEvent`, and `eventRecordToPublicEvent`.

## 0.13.0 - breaking native-content release

**Breaking from 0.12.x and earlier; EmDash >=1.2.0 <2.0.0 required.** Follow the [upgrade guide](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/blob/main/docs/upgrade-0.13.0.md). Updating the plugin does not create or convert schemas.

- Native content collections own Portable Text, media, locales, drafts, revisions and publishing. The self-contained sandbox adds schedule/recurrence/occurrence controls.
- Select event, venue and organizer collections with support for custom names.
- Saved-entry panel: timed/all-day dates, daily/weekly/monthly rules, native directories and 90-day occurrence changes.
- Clean new-site schemas: 19 event fields, no default prototype metadata/snapshots, one category input.
- Optional schema exporter/MCP guide; no mandatory frontend companion or secondary package.
- Native MCP inspection/export, dependency guards, safe duplication, non-destructive migration.
- Multilingual strict/fallback JSON/ICS, stable UIDs, cancellation notices, UTF-8 folding, and optional Astro/JSON-LD.

## Earlier releases

See CHANGELOG.md and GitHub releases.
