> **Historical record:** Current behavior is documented in [0.13.0 release notes](release-notes-0.13.0.md) and the [breaking upgrade guide](upgrade-0.13.0.md). Host-package, hidden-field and publication-status statements below describe superseded work, not current instructions.

# Eventual 0.12.0 release candidate

This release candidate moves event content into native EmDash collections while restoring friendly recurrence and occurrence editing. It has not been published by the audit/refinement work. The backend registry archive and matching Astro host package must be delivered together.

## Editing and localization

Events use core Portable Text, media, drafts, revisions and publishing. Editorial content belongs to each locale; shared schedule/reference fields use core `translatable: false` semantics. Eventual hooks validate schedules and publication dependencies; they do not implement core translation synchronization.

The Dates, venue & repeat panel supplies local dates, time zones, daily/weekly/monthly rules, grouped venue/organizer choices and a 90-day occurrence inspector. Cancel, restore, reschedule and localized announcement changes go through the core draft-review receipt flow. Editing a draft does not change live feeds until publication. Technical JSON/identity/history fields stay stored but hidden. Optional editorial settings are collapsed.

English and French UI follow the admin language independently of the content language. Venue translations occupy one choice; the selected row ID remains stable. Names, addresses, draft warnings and native create/edit links explain the selection. Publication requires published dependencies.

## Public content and migration

Multilingual JSON/ICS feeds select published native content, with language-tagged fallbacks unless strict filtering is requested. UIDs survive translation/migration, all-day DTEND is exclusive, SEQUENCE is a logical integer, and cancellations use committed state. Protocol output/parser tests do not establish actual refresh behavior in Google, Apple or Outlook subscriptions; those clients remain an external acceptance step.

Migration preserves legacy storage and original metadata, remaps dependencies, keeps drafts as drafts and supports resumable batches. Preview is structural: it cannot predict generated native IDs, concurrent changes or other plugins' policies. Batches are not a database-wide transaction. Markdown conversion supports common syntax, not complete CommonMark. Installing the native events schema switches feed authority immediately, including when empty.

## Installation and upgrades

Tested versions: Node 24; EmDash, Admin and Block Kit 1.0.1; Astro 7.3.2/7.3.5; Vite 8.3.x; React 19. The host integration rejects unsupported versions rather than applying uncertain source transforms.

1. Back up the database and media. Read [editor-upgrade.md](editor-upgrade.md).
2. Install the backend and matching host tarball. Use `eventual/install` in the existing Astro config, keeping the runner/database/storage. Registry installations must not add a second source backend.
3. Upgrade existing SQLite schemas/reference snapshots offline with the supplied preview/apply CLI and a new consistent backup. A blueprint or registry update alone does not upgrade installed schemas.
4. For new collections, apply reviewed compiled `eventual/schema` blueprints; for legacy records, preview then execute administrator-only migration batches. Follow [native-modernization.md](native-modernization.md).
5. Run the installation doctor, Astro check/build and editorial acceptance before opening the site to editors.

The CLI is not a deployed D1 migration tool. Existing relation-bound D1 installations require an equivalent reviewed host migration. Core translation data is ready for translation plugins, but live LinguaDash service acceptance was not performed.

## Permissions and limits

Backend capabilities cover content reads/writes/publication/revision reads, schema reads, content policies, scoped editor-draft reads/patch proposals and media. It has no schema-write capability or outbound hosts. MCP/migration requires `plugins:manage`; the panel/workspace uses `content:edit_any`. The frontend companion has no backend capabilities. Core review and publication remain explicit.

Legacy storage and old reference edges are retained for recovery and traceability; they are not a second write authority. Generic relationship consumers must adopt canonical ID columns after a bound-reference upgrade. Do not delete these records as routine cleanup.

Detailed changes, verification results, artifact checksums and remaining deployment acceptance are recorded in [release-refinements-2026-10-07.md](release-refinements-2026-10-07.md).
