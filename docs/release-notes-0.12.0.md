# Eventual 0.12.0

Eventual 0.12.0 modernizes the plugin to adopt native EmDash collections (`events`, `venues` or `locations`), replacing isolated plugin tables with core EmDash content features including row-per-locale multilingual support, native drafts, revisions, scheduled publishing, and Portable Text rich text.

---

## What's New

### 1. Native Multilingual Collections & Invariant Scheduling
- **Row-per-locale Content:** Translation entries for an event exist as native sibling content rows in EmDash, allowing editors to localize titles, Portable Text descriptions, excerpts, and localized occurrence overrides independently.
- **Invariant Schedule Synchronization:** Non-translatable fields (`start`, `end`, `all_day`, `timezone`, recurrence rules, and shared exceptions) are automatically synchronized across translation siblings via `hooks.content-policy:register`.
- **Inclusive Civil Dates:** All-day events store inclusive Gregorian civil dates (`YYYY-MM-DD`). In RFC 5545 iCalendar feeds, end dates are automatically converted to exclusive `DTEND` dates.
- **Separation of Schedule vs Editorial Overrides:** Shared recurrence exceptions handle timing/cancellation across all locales, while localized `occurrence_content` handles per-locale presentation notes.

### 2. Public Feeds & Calendar Enhancements
- **Multi-locale JSON Feed:** `GET /_emdash/api/plugins/eventual/publicEvents` supports `locale` and `strict` query parameters. In non-strict mode, missing translations fall back to an available sibling with a localized title tag (e.g., `[EN] Meeting`).
- **RFC 5545 Monotonic SEQUENCE Counters:** Replaced legacy millisecond timestamps with true monotonic integer `SEQUENCE` values, complying with RFC 5545 and preventing subscribing clients from rejecting updates.
- **Cancellation Tombstones:** Retains `STATUS:CANCELLED` records for 366 days, ensuring external calendar applications (Google Calendar, Apple Calendar, Outlook) accurately remove cancelled or unpublished events.

### 3. Resumable, Non-Destructive Migration (`migrateToNative`)
- **Automated Migration Engine:** The `migrateToNative` MCP tool and admin endpoint read legacy Eventual storage and populate native EmDash collections.
- **Dry-run Preview:** Supports `dryRun: true` to inspect migration payloads, counts, and potential warnings with zero database writes.
- **Zero Data Loss:** Legacy records are never deleted or modified. Stable recovery tokens and unique indexed `legacy_id` fields guarantee idempotency across batch executions.
- **Portable Text Conversion:** Legacy Markdown descriptions and exception notes are converted to schema-safe Portable Text blocks, with raw source strings preserved in `legacy_metadata`.
- **Single Native Authority:** Once the native `events` collection exists, Eventual routes and feeds query native content exclusively, preventing split-brain storage while preserving legacy tables for fallback.

### 4. Admin Companion & Astro Integration
- **Deep-linked Companion Admin:** Replaces the legacy custom form editor with an informational dashboard that links directly to EmDash's core collection editor.
- **Astro Component Suite:** Enhanced `eventual/astro` helpers support native multilingual feeds, ISO civil dates, and structured JSON-LD generation with zero client-side JavaScript.

---

## Upgrade and Migration Guide

1. **Prerequisites:** Requires EmDash **1.0.1** or newer.
2. **Back up your database:** Take a snapshot of your site's database and media before upgrading.
3. **Install the 0.12.0 update:** Update the plugin via EmDash Admin → Plugins or run `npx emdash-plugin install @vermeulen.solutions/eventual`.
4. **Apply Collection Blueprints:** Register the `events` and `venues` collection schemas using `createEventsCollectionBlueprint` and `createVenuesCollectionBlueprint` from `eventual/schema`.
5. **Run Migration:** Execute `migrateToNative` via MCP or the companion admin endpoint. Start with a dry-run (`dryRun: true`), then run migration batches.
6. **Update Frontend:** If using `eventual/astro`, pass `{ locale, strict }` options to `fetchPublicFeed`.

See the [Native Modernization Guide](./native-modernization.md) for full operational steps.

---

## Trust Contract & Capabilities

Eventual requests the following capabilities:
- `content:read`, `content:write`, `content:publish`, `content:revisions:read`: Required for native event management, publication, and migration.
- `schema:read`: Detects active collection schemas.
- `hooks.content-policy:register`: Synchronizes invariant fields across language siblings and validates schedules.
- `media:read`, `media:bytes:read`: Serves cover images and legacy media.
- `allowedHosts: []`: Zero outbound network calls; all operations remain local to the site.

---

## Resolved Work

- **Calendar SEQUENCE migration ([#2](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/issues/2)):** Resolved in 0.12.0. Calendar feeds now emit RFC 5545 compliant integer sequence numbers with committed-state cancellation reconciliation.
- **Native collections adoption:** Fully resolved; plugin data now leverages EmDash native content storage.
