# Eventual 0.13.0 - breaking native-content release

Release date: 7 October 2026. **Breaking upgrade from 0.12.x and earlier. Requires EmDash >=1.2.0 <2.0.0.** Back up and follow [the upgrade guide](upgrade-0.13.0.md) before changing a live site.

Events, venues and organizers are edited as native EmDash content types. Core supplies Portable Text, media, locale rows, drafts, revisions and publication. The self-contained sandbox supplies schedule validation, recurrence, occurrence controls and feeds. No Eventual frontend companion, renderer patch or second runtime package is required. Source/schema tools and Astro helpers are optional developer facilities.

## Changes

- Select existing event, venue and organizer collections in Eventual Settings, including custom names and compatible locations directories.
- Saved-entry Dates, venue & repeat panel for timed/all-day dates, native directories, daily/weekly/monthly rules and 90-day occurrence cancellation, restoration, rescheduling and localized copy.
- Clean default event schema: 19 fields instead of 29. No default prototype IDs/metadata, organizer snapshots, external image URLs, separate history fields, short summaries or redundant series display overrides. Existing schemas are not stripped automatically.
- One comma-separated category input in core; no duplicate panel control. Venue/organizer saves preserve categories and Portable Text. Older JSON-array categories remain readable.
- Shared schedule/reference/recurrence/exception fields and localized title/description/occurrence copy use native translatable flags.
- Configured sources drive hooks, media, feeds, MCP inspection/export, dependency guards, safe duplication and explicit legacy migration. Missing explicit collections fail closed.
- Optional schema-only exporter and core MCP setup prompt. Prototype migration requires explicit --legacy-compatibility schemas.
- Multilingual strict/fallback JSON/ICS, stable translation-group UIDs, cancellation notices, logical SEQUENCE, UTF-8 folding, rich descriptions and optional localized Astro/JSON-LD helpers.

## Breaking changes for existing installations

Upgrade the host to EmDash 1.2.x. Remove historical eventual/install and frontend/source-transform compatibility adapters; those target 1.0.1. Back up and review/apply compatible schemas through core administrator tools, configure locales, then select collections in settings. Updating the plugin neither creates schemas nor migrates data.

Legacy records remain intact, but private-storage forms are no longer the editor. Explicitly preview/migrate older data with compatible migration schemas. Native sources become authoritative even when empty, so plan source activation and migration together. Preserve populated legacy/calendar identity fields on migrated sites; the clean default schema is not a destructive upgrade script. JSON-to-text category conversion and translatable-flag changes need reviewed content migrations.

Review changed capability consent and intended MCP access. Editing requires content:edit_any; settings/MCP management require plugins:manage. Eventual has schema read only and no outbound hosts.

## Known limits and verification scope

Stock EmDash 1.2 still displays internal schedule/reference/JSON fields. Use the friendly panel for recurrence/exceptions; no hidden Advanced renderer is claimed. Save announcement changes before panel actions, reload afterward, and publish through core. New entries must be saved first.

Native revisions retain history. The clean schema omits optional previousStartDate metadata unless a compatible field exists. Simultaneous writes lack an atomic expected-revision API; stale-form preflights are not a complete transaction lock. Documented stock development renderer diagnostics remain; acceptance rejects unexpected errors.

Local checks do not certify external calendar-client refresh, live translation services, deployed D1 upgrades or unrelated production themes. Existing styling is preserved. See [installation](registry-installation.md), [collection setup](collection-setup.md), [upgrade guide](upgrade-0.13.0.md) and [implementation handoff](native-collection-handoff.md).
