# Modernization repair verification

Verified locally on 6 October 2026, for the unreleased 0.12.0 working tree against EmDash 1.0.1, plugin CLI 0.13.1 and plugin-test 0.2.6. This records repairs to the preceding modernization audit; it does not claim a deployed migration or calendar-client acceptance.

## Architectural result

Installed native events collections are authoritative, including when empty. EmDash owns editing, publication, revisions and row-per-locale translations. Eventual supplies schema blueprints, schedule policies, recurrence expansion, public feeds, Astro helpers and resumable migration. Non-event collections are unaffected by event policies.

The custom event editor is retired from the runtime. The Eventual admin page explains native setup and exposes the companion workflow. Legacy storage, exports, public feeds and MCP compatibility remain available for unmigrated installations. Legacy mutation/import paths are blocked once native events are installed. The capability contract and package version were updated for native publication, revision reads and publication/scheduling policies.

## Audit finding disposition

| Findings | Implemented repair and evidence |
| --- | --- |
| F01–F03: migration scan, schema/API contract, publication | Bounded raw storage pagination replaces the invalid date sentinel. Creation uses core-generated IDs and schema-compatible values. Core publication is explicit and separate from event business status. Production D1 sandbox migration tests cover past-starting recurring series, drafts and published records. |
| F04, F10: partial updates, translations, schedule validation | Save policies merge editable revision data for validation; incomplete drafts and new translation rows defer full validation until publication. Publication/scheduling validates complete schedules and published venue dependencies. Validation covers offsets, civil dates, IANA zones, recurrence membership and exception shapes. |
| F05: all-day representation | Native all-day events use inclusive civil start/end dates; timed events use ISO datetimes. D1 booleans and legacy records are normalized. ICS emits the exclusive following-day end. Runtime and independent-parser regressions cover both representations. |
| F06–F08: cancellations, source authority, pagination | Reconciliation derives cancellation tombstones from committed published state. Strict-locale and category removals produce scoped tombstones. Native source failures fail explicitly; they cannot resurrect legacy records. Native content pagination handles more than 100 rows and rejects broken cursors. |
| F09, F15: packed Astro imports and localized dates | All transitive source dependencies and schema exports are packed. Independent packed-package builds render four locales. Machine dates use Gregorian ASCII digits while display dates use the entry/page locale. Native and Live Content IDs, public URLs and all-day rendering are tested. |
| F11–F12: UID continuity and SEQUENCE | Migration preserves the legacy UID identity. Native sibling rows share encoded group/occurrence UIDs and a pinned host. Durable logical SEQUENCE counters respond to published content and venue changes; values stay within RFC integer bounds. Unicode folding, escaping, UID collisions and date semantics are checked with ical.js. |
| F13: shared schedule and localized occurrence copy | Shared exceptions contain schedule fields; localized copy uses a separate translatable field. Categories stay shared. Copy orphaned by a sibling's schedule change remains stored and is ignored until its recurrence ID matches again. Runtime tests cover continued publishing and feeds in both languages. |
| F14: venue, media and metadata preservation | Adapters retain structured addresses, native media, business status, organizer details, previous-start/history metadata and public URLs. Migration retains original source metadata. Public rendering resolves published venue dependencies and core media URLs. |
| F16: preview, mappings, idempotency and interruption | Preview makes no writes and reports generated IDs honestly as unavailable. Plans identify creation, resumed publication or unchanged records. Venue mappings and required dependencies are checked. A renewable lease, unique legacy IDs and recovery tokens handle overlapping runs and lost creation/publication responses. Completed records are not overwritten or republished; deleted migrated records are not silently recreated. |
| F17: Markdown conversion fidelity | The converter supports common Markdown constructs, with original Markdown preserved in legacy storage and legacy_metadata. Complete CommonMark conversion remains outside the implementation; complex content requires editorial acceptance. |
| F18: schema provisioning and select validation | Blueprints use installed core field/seed contracts, including select validation and draft/revision/scheduling supports. A non-overwriting exporter produces a reviewable seed. Existing locations collections require compatible fields and are never replaced by the exporter. |
| F19: resource and concurrency limits | Pagination, expansion, tombstones, output size and migration batches are bounded. Leases serialize reconciliation and migration. Tests cover contention, deterministic storage-call budgets and a native 1,830-occurrence annual workload. This is correctness and bounds verification, not a production latency benchmark. |
| F20: multiple editing/public authorities | Public events, calendar feeds and the admin companion use native authority when installed. Native installations cannot mutate the obsolete legacy event workflow. Legacy compatibility remains available before native schema installation. |

Migration remains non-destructive to legacy records and cancellation storage. It is resumable, not a database-wide transaction. Preview cannot predict concurrent state changes, generated IDs, configured-locale acceptance through an unavailable API, or other plugins' policies. These limits are explicit in the preview and [setup guide](native-modernization.md).

## Verification completed

| Check | Result |
| --- | --- |
| Manifest validation and full plugin suite | 170 tests passed across 24 files; installed EmDash/D1 sandbox exercised |
| Final Astro/JSON-LD targeted regressions | 14 tests passed across 2 files after the final plain-text serialization adjustment |
| TypeScript | npm run typecheck passed |
| Tooling tests | 6 tests passed |
| Node storage-call profiling | 2 deterministic call-budget tests passed |
| Independent packed consumer | npm run test:package passed; en/fr/ar/th pages built and verified |
| Astro example | 0 diagnostic errors/warnings/hints; 29 tests passed; built-page verification passed |
| Schema | Exported seed passed installed EmDash CLI validation; blueprint tests validate core contracts |
| Sandbox bundle | npm run bundle and npm run budget passed; backend 81,938 bytes, total 134,565 bytes, 3 files |
| Whitespace | git diff --check passed |

The backend is below both the 112,640-byte project budget and the 131,072-byte hard file limit. The archive total is below the 225,280-byte project budget and the 262,144-byte hard total limit. Packed Astro verification is now part of CI. Retained legacy recurrence/organizer assertions were moved from the retired custom editor to the supported MCP path.

## Site acceptance still required

Apply the reviewed schema and preview migration against the intended site's actual locales, content and location schema. Then verify native side-by-side editing and LinguaDash translation, complex Markdown rendering, scheduled publication and public route integration. No live D1 schema or migration was applied during this work.

Exercise existing and new Apple, Google and Outlook subscriptions through translated edits, exception cancellation/restoration, unpublication, deletion and migration. Subscribers that cached the prior invalid millisecond SEQUENCE may require a subscription reset; server tests cannot establish a particular client's recovery behavior. Feed caching may delay changes by five minutes.

No release was published, and no Git commit or push was created. Follow the [native setup and migration guide](native-modernization.md) for the reviewed operational workflow.
