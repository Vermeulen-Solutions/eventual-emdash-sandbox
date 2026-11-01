# Eventual 0.15.0 — public feed cache evidence

- Native public feeds now include optional versioned collection dependencies and
  absolute expiry. Empty feeds retain their dependencies. Existing fields,
  locale/recurrence semantics and legacy rendering stay unchanged.
- `eventual/astro` preserves validated evidence, parses direct runtime results,
  combines split feeds with an explicit host TTL, and supplies optional event
  label/local-midnight boundaries. HTTP calls can specify a Registry `pluginId`.
- Hosts explicitly choose eligible routes. The supported integration requires
  EmDash >=1.4.0 in the 1.x line and caps remaining lifetime at 15 seconds with no
  stale serving, because generic plugin writes, settings and Node scheduling
  lack complete route invalidation. No sandbox cache API or purge route is added.
- No identities, schemas, stored content or media references are changed.
  Small validator/date-window consolidations preserve the
  Registry bundle reserve without changing its limits or removing translations.
- Disposable Node/Astro HTML and local Worker Loader/PluginBridge tests accompany
  the [integration guide and BBHC checklist](public-feed-caching.md). Hosted
  Cloudflare acceptance is separate; no BBHC deployment is part of this release.
