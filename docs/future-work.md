# Tracked future work

These items were deliberately excluded from this iteration. They need their own
design and validation before adding sandbox code or storage commitments.

- **RSVP companion:** separate plugin, explicit privacy and retention policy,
  atomic capacity enforcement, retries/idempotency tests and notifications.
  In-memory locks cannot coordinate concurrent sandbox instances. Do not copy
  Dateline's registration concurrency assumptions.
- **Private meeting access:** authenticated authorization and expiry; public
  feeds, JSON-LD and calendar exports currently expose meeting URLs by design.
- **Full recurrence import:** measure a host-side RRULE conversion approach
  before considering any runtime library. The current ICS converter rejects
  unsupported recurrence and timezone constructs explicitly.
- **Additional indexing/cache:** measure actual sandbox CPU and host RPC cost,
  then design atomic invalidation or versioned cache keys. Avoid maintaining
  a second mutable event index without a concurrency strategy. Large recurrence
  windows can still yield large responses even with few stored series.
- **Latest EmDash canary:** separate optional CI job once a stable prerelease
  installation/compatibility policy exists; the required job uses locked versions.
- **Multiple organizers and geocoding:** keep the single saved organizer and
  existing address fields until there is a concrete need; coordinates require
  separate consent, provider choice and outbound capability budgeting.
- **Complete transfer snapshot/media restore:** the current tools export event,
  venue and organizer data. Settings, media and calendar cancellation tombstones
  require the CMS's full backup facilities; no cross-collection transaction is
  claimed by these tools.
- **Series-level rescheduling:** history stores ten previous series schedules;
  moved occurrences expose their original date. A shifted whole series does not
  map every new occurrence to a previous occurrence automatically.
- **Pinned test-stack dependency audit:** npm audit reports a vulnerable undici
  7.29.0 dependency pinned exactly by the installed Miniflare test stack, with
  downstream Cloudflare tooling advisories. A targeted lock update cannot replace
  that exact dependency. Upgrade the test stack in a separate compatibility
  change rather than forcing an untested override. These modules are excluded
  from the sandbox archive. The http-cache-semantics lock entries were updated
  in both projects; the Astro example audit is clean.

## Resolved in 0.12.0

- **Calendar revision migration ([#2](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/issues/2)):**
  Replaced legacy millisecond timestamps with true monotonic integer `SEQUENCE` values
  and committed-state reconciliation, complying with RFC 5545 limits.
- **Native collections adoption:** Modernized storage to native EmDash collections with
  row-per-locale i18n and companion admin dashboard.

## GitHub tracking

- [Extension roadmap (#1)](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/issues/1)
- [Calendar SEQUENCE migration (#2 - Resolved)](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/issues/2)
- [Test-stack maintenance (#3)](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/issues/3)

Release documentation is recorded in [0.12.0 release notes](release-notes-0.12.0.md).
