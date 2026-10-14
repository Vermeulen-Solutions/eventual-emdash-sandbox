# Developer guide — Eventual 0.14.0

EmDash collections own content, rich text, languages, drafts, revisions and publication. Eventual's sandbox supplies schedule validation, recurrence, saved-entry controls and feeds. See [setup](collection-setup.md) and [upgrading](upgrade-0.13.0.md).

## Installation and plugin ID

Registry installations use the host's sandbox runner and downloaded bundle. Config-managed installations register the source descriptor in `sandboxed: [eventual]`. Use one backend per site. Cloudflare Registry hosts need Worker Loader and PluginBridge: [EmDash sandbox setup](https://docs.emdashcms.com/deployment/plugin-sandbox/).

**Use the installed plugin ID in URLs and MCP names.** Config-managed installs normally use `eventual`; Registry installs have generated IDs such as `r_hxn32uyal53iahxf`. Read it from the install result or authenticated `GET /_emdash/api/admin/plugins`. MCP names are `<pluginId>__<toolName>`.

Astro/schema/transfer helpers use this repository's npm-format source package, not the Registry `.tar.gz`. As of 14 October 2026, GitHub's latest downloadable source archive is 0.13.1. For matching 0.14.0 helpers, use a checkout containing release commit `16a832d` whose package.json version is 0.14.0:

```sh
npm ci
npm run build
npm pack
# In your site repository, install the resulting file:
npm install /path/to/eventual-0.14.0.tgz
```

Source tooling needs Node 24+. Peer ranges are in [package.json](../package.json); release acceptance used EmDash/Admin/Block Kit 1.2.0, Astro 7.3.2 and React 19. Historical editor compatibility exports target 1.0.1.

## Public routes

Routes are relative to `/_emdash/api/plugins/<pluginId>/`.

| Route | Inputs and behavior |
| --- | --- |
| `GET publicEvents` | Inclusive `from`/`through` dates (YYYY-MM-DD); default UTC today through 180 days later; maximum 366 inclusive dates. Also `locale`, `strict` (false), `category`, `publicUrls` (true). |
| `GET calendar` | Raw text/calendar; fixed window from UTC today through 365 days later. Supports locale, strict and category. |
| `GET publicEventImage?eventId=…` | Published featured image with MIME/size checks; absent, unpublished or disabled legacy images return 404. |

`strict=true` omits events without the requested translation; false can use another language with a `[FR]`/`[EN]` title prefix. Categories match without case sensitivity. `publicUrls=false` skips native canonical-URL lookups; slug/id remain available for site-owned links.

JSON success:

```json
{"success":true,"data":{"ok":true,"from":"2026-11-01","through":"2026-11-30","events":[]}}
```

The feed has no top-level locale. Event rows carry title, description/plain text, optional descriptionBlocks, start/end, allDay, timezone, location, organizer, externalUrl, imageUrl, categories, venue and directionsUrl. Optional native metadata includes locale, translationGroup, slug and publicUrl. Business status is `status`, not `eventStatus`: see [PublicEvent](../src/public-event.ts). All-day end dates are inclusive here and exclusive in ICS.

Handle both `success:false` host failures and `data.ok:false` plugin failures. EmDash 1.2.0 JSON configuration/RPC failures use HTTP 400, ROUTE_ERROR and private/no-store caching. Preserve errors instead of substituting stale rows or a successful empty feed.

## Astro integration

`fetchPublicFeed(origin, from, through, category, {locale, strict, publicUrls})` from `eventual/astro` validates responses and throws FeedError. **It hardcodes ID `eventual`**; its options do not accept a Registry ID. The showcase has the same assumption. Registry sites need a site-owned adapter to the actual URL or EmDash's SSR dispatcher:

```ts
const pluginId = 'YOUR_INSTALLED_PLUGIN_ID';
const url = new URL(`/_emdash/api/plugins/${pluginId}/publicEvents`, Astro.url);
url.searchParams.set('from', '2026-11-01');
url.searchParams.set('through', '2026-11-30');
url.searchParams.set('locale', 'fr');
const runtime = Astro.locals.emdash;
if (!runtime) throw new Error('EmDash is unavailable');
const result = await runtime.handlePublicPluginApiRoute(
  pluginId, 'GET', '/publicEvents', new Request(url),
);
if (!result.success) throw new Error(result.error?.message ?? 'Event feed unavailable');
// Validate result.data.ok and result.data.events before rendering.
```

`eventual/astro/EventList.astro` is an optional unstyled list. JSON-LD helpers are eventToJsonLd and serializeJsonLd; use the safe serializer. The [showcase](../examples/astro-events/README.md) supplies seven complete visitor layouts.

## Settings, tools and transfer

Tools `getSettings` and `updateSettings` use `mcp/settings/get` and `mcp/settings/update`. **updateSettings requires defaultTimezone**, even when only changing legacyReads. Read and retain its value first:

```json
{"defaultTimezone":"Europe/Paris","legacyReads":false}
```

Optional collections contains `{events,venues,organizers}`. Native timezone defaults belong to the schema. Only stored boolean true enables legacy public reads. Native collections stay authoritative; broken explicit bindings always error. Both MCP and admin `save-legacy-reads` invalidate the request memo.

Enable intended tools under the plugin's **Agent access** controls. Eventual tools require plugins:manage; native editing uses core content tools and content:edit_any. Read tools: listEvents, getEvent, listOccurrences, listVenues, listOrganizers. Legacy writes are blocked once native collections are active. [Tool schemas](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/blob/main/src/mcp-schemas.ts) define exact inputs/routes.

exportRecords follows cursors (default 5, maximum 10). Native native-content-v1 exports are inspection records, not full backups or legacy-import input. previewImport/importRecords accept legacy data only: at most 10 rows / 64 KiB, insert absent IDs, and import events as drafts. The [eventual/transfer interface](../transfer/index.d.mts) supplies legacy backup/copy/CSV/ICS helpers. CSV needs stable source IDs and explicit-offset timed dates; all-day ends are inclusive. ICS conversion accepts standalone UTC or VALUE=DATE events and rejects unsupported recurrence/timezone constructs. Media, settings, revisions and calendar-state recovery need the host's backup facilities.

## Limits and checks

The host's ten-bridge-call budget can constrain feeds, dependency checks and migration even with few displayed events. Smaller date windows or publicUrls=false help some JSON requests; complete-source scans still cost calls. Native exceptions/occurrence copy are bounded at 500 items; calendar group/state/output bounds also apply and fail explicitly. Background migration jobs and bulk APIs remain pending: [Eventual #5](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/issues/5), [EmDash #4004](https://github.com/emdash-cms/emdash/issues/4004).

Calendar UIDs, monotonic SEQUENCE and 366-day cancellation retention support reconciliation. Preserve migrated calendar_uid values. Publication shares schedule fields across languages; pending drafts stay separate. Stale-form checks are not an atomic write lock. Some settings copy remains English in the French admin; stock development-renderer diagnostics are recorded in acceptance.

Runtime checks: npm run validate, typecheck, build, bundle, budget, and npm test. Tooling/package/editor/media changes have test:tooling, test:package, test:editor and registry:media checks. `node scripts/audit-documentation.mjs` checks local links and Registry section caps. Publishing uses the pinned CLI; immutable releases and current profile/release CIDs need separate approvals. [Release evidence](../audit/releases/0.14.0/README.md).
