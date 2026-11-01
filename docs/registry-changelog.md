## 0.15.0

Opt-in public feed cache evidence: actual collection dependencies, empty-list invalidation and absolute expiry. Astro helpers validate metadata, merge split feeds and constrain host TTL by event/timezone boundaries. HTTP consumers can supply the Registry plugin ID. Existing feed fields and recurrence/locale behavior are preserved; no new capabilities or MCP tools.

Caching integration requires EmDash **>=1.4.0 <2.0.0**, an explicit host policy, a maximum 15-second remaining lifetime and no stale serving. Event management retains **>=1.2.0 <2.0.0** compatibility. Generic plugin/settings writes and Node scheduling have invalidation gaps; hosted Cloudflare acceptance is separate. [Guide](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/blob/main/docs/public-feed-caching.md) · [Release notes](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/blob/main/docs/release-notes-0.15.0.md).

## Earlier releases

- **0.14.1:** EmDash 1.4 editor compatibility; no runtime or permission changes.
- **0.14.0:** public legacy storage reads require explicit opt-in; native collections stay authoritative. Clear configuration errors, gated legacy images and refreshed settings UI.
- **0.13.4:** repair an oversized Registry image and check media budgets.
- **0.13.3:** publicUrls=false avoids canonical URL RPCs; JSON budget failures use host errors.
- **0.13.2:** memoized reads and atomic calendar snapshots within the bridge budget.
- **0.13.1:** public native featured-image route.
- **0.13.0:** native rich content, translations, drafts, directories and publication. Earlier upgrades require migration.

[Full changelog](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/blob/main/CHANGELOG.md).
