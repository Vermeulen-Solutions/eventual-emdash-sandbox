# Sandbox content API: bulk hydration and authoritative dependency checks within the 10-subrequest limit

Filed: https://github.com/emdash-cms/emdash/issues/4004

### Problem

Eventual is a registry-installable sandbox plugin that reads native event, venue, and organizer collections. We need to keep it within the documented **10 subrequests, 50 ms CPU, and 30 s wall time per invocation**, including on a paid Cloudflare Workers plan.

The current content bridge exposes individual `get`, `getTranslations`, `getPublicUrl`, and `getRevision` calls, plus paginated `list`. We have not found a supported way to batch lookup by native IDs/translation groups, resolve authoritative public URLs in bulk, or check dependencies across live content and scheduled draft revisions.

This creates two concrete gaps:
1. Hydrating a modest event list can exhaust the sandbox budget even after settings/schema memoization.
2. A plugin protecting a referenced venue/organizer cannot reliably prove that deletion/unpublication is safe at larger volumes within one invocation.

Related: #3989 reports another plugin hitting the same sandbox limit. This report focuses on APIs that allow plugins to **stay within the existing limit**. Raising the limit is not our proposed solution.

I understand CONTRIBUTING recommends Discussions for feature/performance proposals. Filing this as a concrete API limitation report with reproducible call accounting; please convert it to a Discussion if that is the preferred place to agree on the API contract.

### Minimal reproduction / call accounting

In a sandbox route with content-read permission, populate a routable `events` collection with 20 published entries, then:

```ts
const page = await ctx.content.list("events", {
  limit: 20,
  where: { status: "published" },
});
const urls = [];
for (const entry of page.items) {
  urls.push(await ctx.content.getPublicUrl("events", entry.id));
}
```

That requires **21 bridge calls** (one list plus 20 URL resolutions), before any settings/schema/reference reads. Parallelizing the URL calls does not reduce the count.

We also instrumented the current Eventual working tree in isolated Node/Vitest tests:
- Hydrating **one referenced venue from a 1,001-row published directory** required **11 `content.list` calls** with 100-row pages. Replacing per-reference reads with a complete directory scan removes one N+1 pattern but still exceeds the invocation budget as the directory grows.
- A cold one-group calendar request without reference hydration required **12 bridge calls**, even with the calendar host identity already stored. This includes Eventual's own reconciliation/KV operations, which we will redesign; bulk content APIs alone do not solve that path.
- Local URL derivation did not match the core resolver for custom collection fallback paths, repeated slug tokens, ID/date tokens, unroutable collections, and trailing-slash settings.

These are **local call-count and correctness probes, not a captured deployed Worker error trace or CPU benchmark**. The regular suite passed (185 tests), as did type checking. The documented Cloudflare limits provide the enforcement boundary; local Node tests do not enforce it.

### Requested contracts

**1. Bounded bulk content hydration and authoritative URLs**

Please provide a capability-gated operation, or equivalent list/query support, that can:
- Fetch selected native IDs without scanning the entire collection.
- Resolve requested published translation siblings by translation group/locale, preserving existing fallback and visibility semantics.
- Return authoritative public URLs using the same routing/i18n/publication rules as `getPublicUrl`.

These can be separate operations; they need not be one large API. Explicit item/payload limits, missing-entry/null-URL behavior, and continuation semantics would let plugins budget calls predictably. Native system-ID/translation-group filtering should be supported explicitly rather than relying on indexed custom-field filters.

Please batch host-side work as well as the bridge request, and account for D1 parameter limits (related storage batching report: #3768).

**2. Authoritative, bounded dependency checks**

Please provide a host-side query that can determine whether a specific reference is used by:
- Relevant live published content.
- Scheduled content's staged draft revision, where that revision can introduce a reference absent from the live entry.

A boolean/existence result with an optional bounded witness would be sufficient. The query must distinguish “no dependency” from incomplete/failed verification, and honor collection permissions and declared reference fields.

Today a plugin may have to paginate events and call `getRevision` for each scheduled candidate. A derived plugin index can help find candidates, but a cached absence cannot safely authorize deletion. Our fallback will reject operations when verification cannot finish.

### Consistency guidance needed

For derived public feeds, what supported revision/invalidation contract can a plugin use to ensure cached content stops being public after unpublication/deletion, including changes through admin, REST/MCP, and scheduling? In particular, can a failing before-policy invalidation reliably prevent the relevant content change from committing? We are treating this as a release gate, not assuming after-hooks provide a transactional publication fence. This may warrant a separate discussion.

### Environment and references

- EmDash `1.2.0`; `@emdash-cms/cloudflare` `1.2.0`.
- Eventual sandbox plugin `0.13.1`, with local optimization changes under review.
- Deployment context: Cloudflare Workers paid plan, sandbox runner/Worker Loader.
- API surface also checked against current upstream `main` on 2026-10-08.
- [Sandbox resource limits](https://docs.emdashcms.com/deployment/plugin-sandbox/#resource-limits)
- [Content bridge types](https://github.com/emdash-cms/emdash/blob/main/packages/core/src/plugins/types.ts)
- [Core public-URL resolver](https://github.com/emdash-cms/emdash/blob/main/packages/core/src/plugins/content-access.ts)
- [Eventual source](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox)

Screenshots: not applicable (bridge/API behavior). No exact deployed error log is attached.

Prepared with Codex assistance; the local observations above were verified against source and instrumented tests.
