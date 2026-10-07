# Eventual 0.13.1

Release date: 8 October 2026. Patch release following the 0.13.0 native-content modernization. Requires EmDash >=1.2.0 <2.0.0.

## Fixes

- **Public Featured Event Images:** Route public featured event image requests to the plugin's public image streamer endpoint (`/_emdash/api/plugins/eventual/publicEventImage?eventId=<eventId>`) instead of private CMS media asset URLs (`/_emdash/api/media/asset/`), preventing 401 Unauthorized errors on unauthenticated Astro frontends.
- **Hydration & Serialization:** In `hydrateNativeAssets`, `formatPublicEvent`, and `eventRecordToPublicEvent`, hydrate `event.imageUrl` whenever `featuredMediaId` or `imageMediaId` is present.
- **Occurrence Image Streamer:** Updated `handlePublicEventImage` to resolve both `event.id` (including occurrence IDs with `#` delimiters) and `baseEventId`, correctly serving images for series and individual occurrence overrides.
