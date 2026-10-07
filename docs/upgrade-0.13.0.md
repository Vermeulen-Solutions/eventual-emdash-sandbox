# Upgrade to Eventual 0.13.0

**Breaking upgrade from 0.12.x and earlier. Requires EmDash >=1.2.0 <2.0.0.** The runtime is a self-contained sandbox plugin. Schema setup is a separate one-time administrator operation; no second frontend/runtime package is required.

## 1. Back up and rehearse

Take a complete CMS/database/media/configuration backup and rehearse on staging. Eventual export is not a complete disaster-recovery backup. Record collection names/types/localization/reference bindings, saved drafts, locales, calendar URLs/UIDs and plugin capability/MCP consent. Retain the previous plugin and matching host/database/configuration for rollback.

## 2. Prepare the host

Upgrade EmDash/Admin to a compatible 1.2.x stack through the host's supported migration procedure. Source/tooling checks use Node 24. Preserve the database, media storage, sandbox runner and unrelated integrations.

Remove historical eventual/install, eventual/admin and source-transform frontend compatibility registrations; restore the normal emdash/astro integration. Those adapters target 1.0.1 and reject 1.2. A registry-managed site must not register a second source Eventual backend. Optional Astro helpers can be retained at the matching version when the site's public theme uses them; they are not an editor requirement.

## 3. Prepare native schemas

Follow [collection setup](collection-setup.md). Compare existing fields first; create missing schemas through authenticated core administrator tools or the optional schema-only exporter. Reuse compatible directories and point event references at the exact chosen collections. Do not recreate populated collections or blindly apply on-conflict updates.

Keep description as portableText and preserve blocks/marks. Dates, timezone, recurrence, exceptions and reference IDs are shared; title/description and occurrence_content are localized. Field-type and translatable-flag changes require content migrations. Existing relation-bound references need compatible column-backed selections; do not discard edges or rebind casually. Directories need a string name or title.

The default blueprint omits prototype metadata and uses string categories. **It does not remove or convert existing fields.** Older JSON-array categories remain supported. Convert live/draft/revision values through a reviewed migration before changing their field type. Retain populated legacy_id, legacy_metadata and calendar_uid fields needed for traceability/recovery or existing subscriber identity. Do not delete calendar_uid merely because new events derive UIDs from translation groups.

## 4. Handle private legacy records explicitly

Private records remain intact but private-form editing is removed. Export/back them up, then follow [native modernization](native-modernization.md). Export schemas with --legacy-compatibility or provision equivalent migration identity/snapshot fields manually. Reused directories need compatible migration fields too.

Call migrateToNative with dryRun:true; review errors, warnings and venue mappings. Execute bounded batches and follow nextCursor. Core generates real IDs on execution; planned IDs are placeholders. Venues/events migrate non-destructively. Organizer directories, custom required fields and manual legacy translations may need separate administrator preparation. The clean new-site schema is not migration-compatible by default.

Plan a maintenance window. A conventional native events schema can become authoritative as soon as it exists; a selected native source stays authoritative while empty. Activating an empty source can temporarily empty feeds. Missing explicit selections fail closed rather than reviving stale private data.

## 5. Update and connect

In EmDash Admin → Plugins, update Eventual to 0.13.0 when the registry resolves the approved release. Review changed capability consent. Open Eventual → Settings, select the actual event/venue/organizer content types and save. Settings validate schema/localization/reference compatibility; selection does not migrate data.

If agents need Eventual tools, open Eventual → Agent access and enable the intended MCP access after administrator review. Installing a plugin does not itself enable MCP. Management requires plugins:manage. Native mutations use core content tools; legacy writes are rejected when native sources are authoritative. Editors need content:edit_any and cannot change collection bindings.

## 6. Accept before production

- Save rich text in a native draft, select a venue/organizer in Dates, venue & repeat, save/reload dates/recurrence, and verify categories and Portable Text survive.
- Publish referenced directories before the event. Check drafts remain private, published JSON/ICS output, cancellation/restoration and existing subscriber UIDs.
- Create a core translation row. Verify shared schedule/reference fields, localized text, strict filtering and fallback language prefixes.
- Verify the actual frontend/theme, endpoints and optional Astro integration. Local fixtures do not certify that deployed site or real calendar clients.

Stock core still renders internal fields; there is no hidden Advanced section. Save announcements before panel actions, reload afterward, and publish in core. Keep the verified backup until production acceptance. Rollback can require restoring the matching host/schema/data backup, not just downgrading the plugin.
