# Changelog

All notable changes to Eventual are documented here.

## 0.12.1

- Transition to native EmDash collections (`events`, `venues`/`locations`) with row-per-locale internationalization (`translation_group`, `locale`).
- Automatic synchronization of invariant schedule fields across translation siblings (`translatable: false`).
- Rich text editing using native Portable Text (`portableText`) instead of raw markdown textareas.
- Native translation rows and Portable Text are available to translation plugins. Live `@swiss.ky/linguadash` service acceptance remains untested; core drafts, revisions and publishing are covered separately.
- Separation of shared schedule exceptions (`exceptions`) and localized editorial overrides (`occurrence_content`).
- Inclusive civil dates (`start_date`, `end_date`) for all-day events and RFC 5545 exclusive DTEND conversion.
- Resumable non-destructive migration engine (`migrateToNative`) with dry-run preview, lease-based concurrency locking, and token-based recovery.
- Stable cross-locale and migration calendar UIDs, logical RFC SEQUENCE counters, and committed-state cancellation reconciliation.
- Single native authority: native collections are authoritative when installed, preventing stale legacy storage resurrection.
- Exported typed blueprints (`eventual/schema`) and localized Astro components (`eventual/astro`).
- Friendly recurrence/occurrence editing, grouped venue choices, human draft review and English/French admin presentation; optional fields are collapsed and technical metadata stays stored but hidden.
- A single `eventual/install` host integration, exact tested core/toolchain guards, compiled schema exports and an offline backed-up SQLite schema/reference upgrade tool. Backend and host packages must match.
- Browser acceptance against a freshly installed tarball; the final release evidence is in `docs/release-refinements-2026-10-07.md`.

## 0.12.0

- Initial native-collection modernization. The 0.12.1 recovery release restores editor workflows and fixes native references, installation and publication contracts; use its upgrade runbook.

## 0.11.1

- Allow EmDash Editors to manage Eventual events, venues, organizers, and settings through the Editor-level `content:edit_any` permission. MCP management tools and plugin installation remain restricted to administrators.

## 0.11.0

- Physical, virtual, and hybrid attendance with validated HTTP(S) meeting links.
- Draft, published, cancelled, postponed, and rescheduled event lifecycle states.
- Saved organizers directory and structured addresses (`addressParts`) for saved venues.
- Bounded schedule history and safer draft duplication.
- iCalendar lifecycle states (`STATUS:CONFIRMED`, `STATUS:TENTATIVE`, `STATUS:CANCELLED`) and virtual meeting URLs.
- Headless Schema.org `Event` JSON-LD generator with safe embedding and matching Astro detail pages.
- Strict MCP inputs without bundling Zod code into sandbox bundle; automated bundle size budgets.
- Paginated event, venue, and organizer exports; bounded, previewable, insert-only imports with retry protection.
- Host-side CSV and limited ICS conversion utilities in `eventual/transfer`.
- Comprehensive timezone coverage testing under UTC and America/New_York.

## 0.10.0

- Event list publication status and upcoming/past start date filters that persist during pagination.
- Stale event and venue editing detection to prevent concurrent overwrite collisions.
- Site integration guidance in Eventual Settings (public JSON feed and iCalendar paths, link to Astro example).

## 0.9.2

- Prominent save guidance banner near the top of the event editor to help users navigate long forms.
- Accurate form submit guidance for standard EmDash sandbox layouts.

## 0.9.1

- Correct registry installation guidance and event editor admin hints to match current EmDash plugin manager navigation (**Admin → Plugins → Eventual → Agent access**).

## 0.9.0

- EmDash 1.0.1 and Block Kit modernization.
- Paged Block Kit tables for event and venue lists.
- Clickable event titles, row actions (Edit, Duplicate, Delete), and confirmed bulk deletion (up to 25 events per page).
- Event forms retain submitted values after validation errors, with timezone search and schedule previews.
- Configurable admin time display (24-hour default or 12-hour AM/PM) for admin event list and dashboard widget.
- Public JSON, calendar, and MCP scans fail explicitly when matching records exceed 10,000 rather than silently truncating.
- Shared `eventual/astro` client export and unstyled `EventList.astro` component.

## 0.8.0

- Expanded Astro event browser example with seven responsive layouts (list, timeline, cards, schedule, dates, month, locations).
- Single multiline description field with lightweight Markdown formatting support (`**bold**`, `_italic_`, `## Heading`, bullet lists, links) preserving raw HTML safety.
- Improved event form layout, featured image placement near title, and save button discoverability.

## 0.7.5

- Streamlined description editor directly in the main event form replacing separate multi-section management.
- Markdown syntax guide beside form; preservation of imported HTML descriptions.

## 0.7.0

- **Manage occurrence dates** view for recurring events: paginated 90-day window to cancel, move, or restore individual dates.
- Added `eventual__listOccurrences` MCP tool (16 tools total) for agent inspection of recurrence exceptions.
- Recurrence interval support (1 to 52) for daily, weekly, and monthly series with wall-clock preservation across DST.
- Multi-weekday selection for weekly recurring events.
- Preservation of explicit day-of-month recurrence rules (e.g., 31st with February last-day fallback).

## 0.6.0

- 15 schema-backed MCP tools under `eventual__` namespace for events, publication, occurrence exceptions, venues, and timezones.
- Added `upcoming-events` dashboard widget for EmDash.
- Recurrence schedule validation rejecting changes that would orphan saved occurrence exceptions.
- Venue deletion protection rejecting venues assigned to events.
- Verification against EmDash 128 KiB backend and 256 KiB total package size limits.

## 0.5.0

- Initial MIT-licensed release of sandboxed Eventual plugin for EmDash CMS.
- Event and venue storage in plugin-owned SQLite KV database.
- Public JSON feed (`/_emdash/api/plugins/eventual/publicEvents`) and iCalendar subscription (`/_emdash/api/plugins/eventual/calendar`).
- Media library cover image integration (up to 8 MiB).
- Initial Astro event browser example with month calendar and single-event `.ics` export.
