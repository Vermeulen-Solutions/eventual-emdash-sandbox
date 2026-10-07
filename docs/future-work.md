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
- **Core editor organization:** supported field visibility/grouping would remove duplicate schedule controls without a mandatory host frontend package.
- **Series-level rescheduling:** native revisions retain history; optional prototype schemas keep ten previous series schedules;
  moved occurrences expose their original date. A shifted whole series does not
  map every new occurrence to a previous occurrence automatically.
- **Test-stack maintenance:** continue auditing locked workerd/Miniflare dependencies and verifying cold sandbox startup when updating them. The root undici entry uses 7.29.1; Miniflare still carries a separate exactly pinned 7.29.0 test dependency. That test-stack upgrade needs its own compatibility work. Test-only dependencies are excluded from the sandbox archive. Production-only dependency audit passed with zero reported vulnerabilities for this release.

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

Current release details are in [0.13.0 release notes](release-notes-0.13.0.md) and its [breaking upgrade guide](upgrade-0.13.0.md).
