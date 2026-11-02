## 0.16.0

Parallelized public feed resolution and direct imageMedia metadata: `getPublicUrl` lookups, collection bindings, and venue/asset branches resolve concurrently across the Worker Loader boundary. `publicEventImage` route adds `Cache-Control: public, max-age=3600, must-revalidate`. `PublicEvent` carries optional `imageMedia` with direct file URLs and native dimensions for Astro `<Image>` and responsive WebP transforms. Full backwards compatibility; existing `imageUrl` behavior and EmDash **>=1.2.0 <2.0.0** compatibility preserved. [Release notes](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/blob/main/docs/release-notes-0.16.0.md).

## Earlier releases

- **0.15.0:** opt-in public feed cache evidence: actual collection dependencies, empty-list invalidation and absolute expiry.
- **0.14.1:** EmDash 1.4 editor compatibility; no runtime or permission changes.
- **0.14.0:** public legacy storage reads require explicit opt-in; native collections stay authoritative. Clear configuration errors, gated legacy images and refreshed settings UI.
- **0.13.4:** repair an oversized Registry image and check media budgets.
- **0.13.3:** publicUrls=false avoids canonical URL RPCs; JSON budget failures use host errors.
- **0.13.2:** memoized reads and atomic calendar snapshots within the bridge budget.
- **0.13.1:** public native featured-image route.
- **0.13.0:** native rich content, translations, drafts, directories and publication. Earlier upgrades require migration.

[Full changelog](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/blob/main/CHANGELOG.md).
