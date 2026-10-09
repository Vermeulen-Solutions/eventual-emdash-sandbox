# Eventual 0.13.3

Patch release for EmDash >=1.2.0 <2.0.0. No new capabilities, outbound hosts, native schemas or data migrations.

## Changes

- Public JSON requests accept `publicUrls=false` to skip canonical URL lookups. Existing requests keep URL hydration enabled. The optional Astro `fetchPublicFeed` helper accepts `{ publicUrls: false }`.
- The public JSON route throws a sandbox budget failure through EmDash's supported JSON error contract. On EmDash 1.2.0, the runtime returns HTTP 400, `success: false`, `ROUTE_ERROR` and `Cache-Control: private, no-store`. This corrects the previous HTTP 200 success response containing a raw error envelope. The raw calendar and image routes retain their existing response modes.
- Focused tests cover the actual EmDash sandbox route boundary, RPC counts, FR/EN locale fallback, strict selection, accepted boolean forms, related venues, rich descriptions and featured images.

## Consumer update

After updating the Registry installation, BBHC should add `publicUrls: "false"` to the query passed to `runtime.handlePublicPluginApiRoute` for `/publicEvents`; its existing route code supplies event links. The captured BBHC annual feed then returns all eight events in four RPCs for both FR and EN. The canonical URL field is omitted when hydration is disabled; other fields are preserved.

A successful JSON route still returns the normal `{ success: true, data: { ok: true, events: [...] } }` shape. Consumers should handle failed runtime results normally. Adding raw-envelope decoding is unnecessary for this JSON route and cannot resolve budget exhaustion.

This release does not change a site's query automatically. No BBHC deployment or content modification is part of publication.

## Deferred work

The ten-call sandbox budget remains in force. Complete native-source and related-directory enumeration can still exhaust it for larger datasets, including rows outside the requested date range. Indexed candidate reads, selective relation retrieval and cursor pagination remain deferred pending the host APIs tracked in [EmDash #4004](https://github.com/emdash-cms/emdash/issues/4004). This patch does not claim arbitrary dataset capacity or certify Cloudflare CPU headroom.

Existing 0.13.x installations can update without schema changes. Earlier versions still require the [0.13.0 upgrade procedure](upgrade-0.13.0.md).
