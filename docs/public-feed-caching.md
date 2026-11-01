# Opt-in caching of event pages

Eventual 0.15.0 supplies dependency evidence for host-rendered HTML. It
does not enable caching, change a site's route rules, or purge a host cache from
the plugin. Existing feed fields and `fetchPublicFeed()` calls still work.

Use **EmDash 1.4.0 or later in the 1.x line** for this integration; the verified
baseline is EmDash 1.4.0, Astro 7.3.2, Node adapter 11.1.5 and Node/workerd runner
0.9.6. This is a caching integration requirement, not a change to Eventual's
existing >=1.2.0 rendering compatibility. Later hosts still need acceptance
testing. Registry hosts also need their normal Worker Loader/PluginBridge setup.

## Feed contract

Successful native `/publicEvents` results add optional `cache`:

```ts
interface PublicFeedCache {
  version: 1;
  dependencies: string[];
  generatedAt: string; // canonical absolute UTC ISO instant, before source reads
  expiresAt: string;   // must re-render by this instant; never extend on receipt
}
```

`dependencies` contains the actual event collection slug, its schema's venue and
organizer reference targets, and `emdash:settings`. For example a site using
`activities`, `locations`, `hosts` receives those names, not hardcoded `events`.
Collection dependencies cover **all entry IDs** in those collections, including
translations, missing references, filtered-out entries and empty results. There
are no per-event dependency reads or unbounded lists of entry tags. Directory
collection tags conservatively remain present when no event currently uses them.

The metadata describes public results only. Legacy private-storage feeds and
unsuccessful results carry no cache evidence. No draft identity, schedule or
revision is revealed by metadata. Native announcement text, schedule, occurrence
exceptions, categories, slugs, featured-media references and translations are
covered by the event collection. Venue and organizer public projections are
covered by their collections. Site URL/locale settings are conservatively covered
by the site settings tag. Host schema/URL-pattern changes and Eventual's collection
bindings have no supported purge tag; expiry bounds those changes.

Source freshness is a separate requirement: EmDash 1.4.0 initializes the plugin's
`ctx.site` identity when the runtime/runner starts. A site URL/identity change can
purge HTML without refreshing that snapshot. Follow the host's runtime restart
procedure for such changes before refilling pages; expiry cannot repair stale
source inputs. The local settings acceptance covers live page settings and plugin
collection bindings, not hot-reloading `ctx.site`. Upstream would need to refresh
site identity per invocation (or rebuild the runner on identity changes).

**Expiry is at most 15 seconds after generation.** This is a correctness ceiling,
not a chosen route TTL: it bounds missing host invalidation and purge failures.
The host may choose anything shorter, or keep event pages uncached. Metadata has
no `maxAge`, `swr`, validator or directly usable Astro `tags` property.

`fetchPublicFeed()` still uses a fresh `fetch` with `cache: "no-store"`. It returns
validated metadata when available. Its new optional `pluginId` addresses a
Registry-generated installation ID; the default remains `eventual`:

```ts
const feed = await fetchPublicFeed(origin, from, through, '', {
  pluginId: installedPluginId, locale: 'fr', publicUrls: false,
});
```

For in-process dispatch use the **request-scoped public handler**, then the same
validator. Do not fetch the site's own Worker over HTTP:

```ts
const requestUrl = new URL(`/_emdash/api/plugins/${encodeURIComponent(pluginId)}/publicEvents`, Astro.url);
requestUrl.search = new URLSearchParams({ from, through, locale: 'fr', publicUrls: 'false' }).toString();
const feed = parsePublicFeed(await Astro.locals.emdash.handlePublicPluginApiRoute(
  pluginId, 'GET', 'publicEvents', new Request(requestUrl),
));
```

Both functions preserve old results without metadata. Invalid event lists and
unsuccessful envelopes throw `FeedError` as before; missing, unknown-version or
malformed cache evidence is discarded and the content can still render.

## Small Astro example

Configure the appropriate Astro provider explicitly (`memoryCache()` from
`astro/config` on Node, `cacheCloudflare()` from `@astrojs/cloudflare/cache` on
Cloudflare). Keep route eligibility under host control. Here the host elects to
cache only anonymous `/events` HTML for up to 15 seconds, with no stale serving:

```astro
---
import { parsePublicFeed, publicFeedCacheOptions, publicEventTimeBoundary } from 'eventual/astro';
const pluginId = import.meta.env.EVENTUAL_PLUGIN_ID ?? 'eventual';
const requestUrl = new URL(`/_emdash/api/plugins/${encodeURIComponent(pluginId)}/publicEvents`, Astro.url);
requestUrl.search = new URLSearchParams({ locale: 'fr', publicUrls: 'false' }).toString();
const result = await Astro.locals.emdash.handlePublicPluginApiRoute(
  pluginId, 'GET', 'publicEvents', new Request(requestUrl),
);
const feed = parsePublicFeed(result);
const boundary = publicEventTimeBoundary(feed.events);
const eligible = Astro.url.pathname === '/events'
  && Astro.request.method === 'GET'
  && !Astro.locals.user
  && !Astro.request.headers.has('authorization')
  && !Astro.request.headers.has('cookie')
  && !Astro.url.searchParams.has('_preview')
  && !Astro.url.searchParams.has('_edit');
const cacheOptions = eligible ? publicFeedCacheOptions([feed], {
  maxAge: 15, boundaries: boundary ? [boundary] : [],
}) : false;
if (Astro.cache?.enabled) Astro.cache.set(cacheOptions);
Astro.response.headers.set('Cache-Control', cacheOptions ? 'no-cache' : 'private, no-store');
---
<html><body>{feed.events.map(event => <h2>{event.title}</h2>)}</body></html>
```

In a real layout, aggregate every query first and apply the final decision in
host middleware **after** rendering. Buffer the HTML if components render
asynchronously, recalculate remaining lifetime at that point, and verify status
200, HTML content type, no Set-Cookie and the host's full eligibility rules. Catch
feed/render errors and call `cache.set(false)` with `private, no-store`, even if
the host renders a friendly error with status 200. The production test fixture in
`scripts/verify-public-cache.mjs` demonstrates that final guard.

Astro merges scalar options with last-write-wins and can re-enable caching after
`set(false)`. No later layout/helper should widen TTL or turn caching back on.
Register other CMS query hints (menus, settings, widgets, etc.) only inside the
same eligible branch, and include their own expiry constraints. Never pass raw
feed metadata as a cache hint. A tags-only Astro hint can enable Cloudflare's
implicit two-hour lifetime without a route rule. Do not use a root catch-all rule
that includes `/_emdash/`, forms, operational, authenticated or preview routes.

The guard prevents storing a private render. A provider can serve an already
cached anonymous response **before middleware runs**, including to signed-in
editors. The stock Cloudflare provider cannot bypass a cache hit by cookies.
If BBHC requires every authenticated request to execute the Worker, keep these
routes uncached until the host/provider supplies that bypass. Do not put
session-dependent UI in the shared representation. The local privacy tests
demonstrate private misses never populate the cache, not a Cloudflare cookie bypass.

`publicFeedCacheOptions(feeds, { maxAge, boundaries?, now? })` returns explicit
`{ tags, maxAge, swr: 0 }` or `false`. A positive finite host TTL is mandatory. It
validates all parts, unions dependencies and floors the shortest remaining
duration to seconds. Any absent/expired/future-generated/invalid/unsupported
metadata, failed part, invalid boundary, empty input, or less than one remaining
second disables storage. Keep every successful split in the array, **including
empty splits**, and fail the whole page if any split fails. Do not reset expiry
when retrying, merging, filtering or slicing results. `now` is for deterministic
tests; production should use the current host clock and synchronized clocks.

Tags only invalidate caches attached to the same source host/provider. A remote
HTTP consumer cannot receive the source site's purge automatically; its bounded
expiry is the supported fallback. Browser caches are never purged by these tags.
Use browser `no-cache`, or a browser TTL no longer than the final remaining page
lifetime; a fresh 15-second browser TTL on an already-aged CDN hit could extend
staleness. Do not add stale-if-error or stale-while-revalidate at another layer.

## Time without writes

- An omitted `from` uses **UTC today**, preserving existing feed semantics. Its
  `expiresAt` is additionally capped at the next UTC midnight, including empty
  feeds. An omitted `through` is `from + 180` calendar days; with explicit `from`
  this adds no clock dependency.
- Explicit range expansion, recurrence and exceptions use event timezones but
  do not filter against the current instant. Membership does not change simply
  because an event starts or ends. Local civil-date and DST behavior is unchanged.
- A renderer adding upcoming/ongoing/ended labels should include
  `publicEventTimeBoundary(events)`. Timed boundaries use their absolute start/end
  instants. All-day end dates are **inclusive**: the ending boundary is midnight
  after the last day in the event's timezone, including 23/25-hour DST days.
- A renderer grouping/filtering by local today should also include
  `publicCalendarDateBoundary(timezone)`. Relative text, navigation, other data and
  timezones need their own boundaries. A skipped/unresolvable local midnight
  throws: leave that response uncached rather than guessing an offset.
- The public published-only content API does not expose all future scheduled
  drafts. Exact future publication boundaries cannot be promised without reading
  private schedules. The 15-second ceiling bounds a missed scheduler purge from
  when publication actually happens; it does not guarantee scheduler punctuality.
  No new cron job is needed. On Node the scheduler itself has no route purge.

## Verified host contract and upstream requirements

The following trace is for **installed EmDash 1.4.0**, not an assumed sandbox API.
See [EmDash route caching](https://docs.emdashcms.com/deployment/route-caching/),
[Astro caching](https://docs.astro.build/en/guides/caching/) and
[sandbox boundaries](https://docs.emdashcms.com/deployment/plugin-sandbox/).

| Mutation path | Native route invalidation | Plugin/bridge path |
| --- | --- | --- |
| Create/duplicate draft | None needed | None needed; never public |
| Save draft revision | No purge for draft-only save | `content.update` is draft-aware; no route purge |
| Save live fields in a collection without drafts | `[collection, canonicalId]` | Generic `content.update` does **not** purge |
| Publish/unpublish | `[collection, canonicalId]` | Versioned publication actions purge when a request/event invalidator is supplied |
| Trash/delete | `[collection, canonicalId]` | Generic `content.delete` does **not** purge |
| Restore from trash (restored as draft) | `[collection, canonicalId]`; stays private until republished | Versioned restore action uses supplied invalidator |
| Schedule/unschedule | `[collection, canonicalId]` | Versioned action uses supplied invalidator |
| Scheduler promotes a revision | Cloudflare Cron purges published collection/ID batches | Node timer has no route invalidation; TTL fallback |
| Restore an older revision | No route invalidation | TTL fallback |
| Native site settings | `emdash:settings` | Plugin settings/KV writes have **no** matching route purge |
| Schema/URL pattern, media library/byline edits | No general matching route purge | TTL fallback; renderers must cover additional data they resolve |

Native REST routes own their invalidation; runtime `handleContent*` calls alone
are not equivalent. Eventual's native schedule/occurrence controls save via generic
`ctx.content.update`; native publication is the later step that makes draft
changes public and purges. Its legacy MCP/storage writes are not CMS collection
writes. Collection settings affect source selection, while legacy opt-in only
affects the fallback lane. Both settings paths lack route invalidation.

Source trace: `emdash/src/astro/routes/api/content/`,
`emdash/src/cache/route-cache.ts`, `emdash/src/plugins/context.ts`,
`emdash/src/emdash-runtime.ts` (`runPluginContentAction`),
`emdash/src/astro/public-plugin-api-routes.ts`,
`@emdash-cms/cloudflare/src/sandbox/{bridge,runtime-bridge,wrapper}.ts`,
`@emdash-cms/cloudflare/src/worker.ts`, and
`@emdash-cms/sandbox-workerd/src/sandbox/bridge-handler.ts`.

There is **no public sandbox `ctx.cache`**. Plugin KV/storage and the EmDash object
cache are distinct from Astro's rendered route cache. The supported integration
is the host's `Astro.cache.set()` plus native-route invalidation and bounded
expiry. For reliable immediate invalidation of every mutation, upstream must
carry the request/event route invalidator into generic content update/delete
on both bridges, invalidate only committed live changes, provide a documented
plugin-settings/binding tag on every settings write path, and connect Node
scheduled publication to its cache provider. Revisions, schema and URL-pattern
changes also need documented tags if hosts want longer lifetimes. No currently
released version is claimed to solve these gaps. No purge endpoint is added.

Purge errors are deliberately swallowed by EmDash after successful writes.
Cloudflare purges can be rate limited. The ceiling remains required even when
all tested purge paths work. Concurrent rendering/publication can also refill a
cache after its purge; bounded TTL covers that race.

Keep HTML, public JSON, calendar subscriptions/downloads and images as separate
representations with independent policies. The existing JSON 60-second HTTP
policy and raw calendar/image policies are unchanged; feed expiry does not make
those HTTP headers into HTML dependencies. A stale upstream JSON body has aged
metadata and cannot refill a parent cache. Never derive an HTML/feed ETag or
Last-Modified solely from the currently visible event timestamps: deleted entries,
new matches, dependencies and settings would be missed.

## BBHC adoption checklist (no site change made here)

- Upgrade the helper package and backend together to 0.15.0;
  0.14.0/0.14.1 responses have no metadata. Verify EmDash/provider versions first.
- Retain the local configured npm backend and Cloudflare Registry backend lanes,
  using each installation's actual plugin ID. Verify collection tags against
  BBHC's deployed schemas; do not rename collections or rewrite content.
- Keep the current range bisection. Union evidence from **all** results and choose
  earliest expiry plus host/renderer constraints. Avoid per-event queries.
- Opt in only the agreed anonymous homepage/event HTML routes, with <=15-second
  remaining TTL and zero stale serving. Preserve all existing private/form,
  editing, preview and operational exclusions. Register all other rendered data.
- Add renderer boundaries for labels, local today and navigation; decide browser
  caching separately. Audit layouts for tags-only hints and later TTL overrides.
- Before enabling on hosted Cloudflare, demonstrate cached parent hits, native
  publish/live edit/unpublish/delete/restore, first matching publication, venue,
  organizer and settings changes; draft/privacy, clock expiry, errors and failed
  purges. Verify scheduled visibility, Registry ID and actual CDN purge limits.
- Require fresh renders within the chosen TTL when purge is unavailable. Hosted
  Workers Cache behavior and deployed Registry installation remain **unverified**
  by the local acceptance; keep BBHC uncached until its hosted gate passes.
