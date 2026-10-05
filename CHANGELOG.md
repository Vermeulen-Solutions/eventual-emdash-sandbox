# Changelog

## 0.11.1

- Allow EmDash Editors to manage Eventual events, venues, organizers, and settings through the Editor-level `content:edit_any` permission. MCP management tools and plugin installation remain restricted to administrators.

## 0.11.0

- Physical, virtual and hybrid attendance, validated HTTP(S) meeting URLs, and draft, published, cancelled, postponed and rescheduled event states.
- Saved organizers, structured addresses, bounded schedule history and safer draft duplication.
- iCalendar lifecycle states and virtual locations; headless Schema.org Event output with safe JSON-LD embedding and matching Astro detail pages.
- Strict MCP inputs without bundling Zod schema code; smaller sandbox bundle with automated size budgets.
- Paginated event, venue and organizer exports; bounded, previewable, insert-only imports with retry protection. Host-side CSV and limited ICS conversion.
- Development and production integration checks, timezone coverage and registry icon/banner assets.

Requires EmDash 1.0.1+. Adds organizer storage and an event organizer index. Back up before upgrading and review the revised storage contract and new MCP tools. Public meeting URLs are public in feeds, calendars and JSON-LD. Transfer tools do not replace a full site backup.

## 0.10.0

- Event list publication/date filters that persist during pagination.
- Stale event and venue editing detection.
- Public feed and Astro integration guidance in Settings.

## Earlier versions

See the repository's tagged releases for earlier release notes.
