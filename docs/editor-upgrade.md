# Install the friendly Eventual editor on an existing site

This runbook covers the 0.12.1 recovery release on EmDash 1.0.1, Admin 1.0.1 and Block Kit 1.0.1, tested with Node 24, Astro 7.3.2/7.3.5, Vite 8.3.x and React 19. The integration accepts Astro 7.3.x starting at 7.3.2, Vite 8.3.x and React 19.x, and rejects other core/toolchain versions. The backend registry archive and the matching installable host package are separate artifacts. A registry update alone cannot install frontend widgets or upgrade an existing schema. The host tarball is attached to the repository's v0.12.1 GitHub release; it is not an npm-registry publication.

## 1. Configure the Astro host

Install the matching host tarball supplied with the release (or use this source checkout):

```sh
npm install https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/releases/download/v0.12.1/eventual-0.12.1.tgz
```

Use `eventual/install` instead of the default EmDash integration import. It registers the frontend-only companion and the scoped compatibility adapter together, checks the supported versions, and preserves existing storage, adapters, plugins and backend registration:

```js
import eventual from 'eventual';
import emdash from 'eventual/install';

// Merge these into your existing config; retain your adapter, runner and storage.
emdash({
  sandboxed: [eventual],
  // ...existing database, media storage, sandboxRunner, etc.
});

// Keep other Astro integrations and Vite plugins as configured.
```

On a registry-managed host, keep its registry installation and omit `sandboxed: [eventual]` and the `eventual` descriptor import above. Do not register a second backend. Update the registry backend and host package to the same version. The source backend version is checked automatically; verify registry versions in EmDash's Plugins page. Remove the previous manual `eventualEditor(...)`/`eventualEditorCompatibility()` registrations when adopting this single integration.

Run the read-only setup check from the site directory, then verify execution with the host build:

```sh
node node_modules/eventual/scripts/check-editor-installation.mjs --site .
npx astro check
npx astro build
```

The setup check detects installed versions and configuration candidates; it is not proof that the configuration executed or that the database is upgraded. The build verifies the actual frontend modules and recognized renderer sources. A site administrator performs this one-time integration; editors subsequently use native forms without editing Astro configuration or JSON.

The frontend companion declares no routes, storage, network hosts, hooks or capabilities. It supplies supported native field renderers: routine schedule data is edited in the panel, migration/identity/history fields remain stored but are hidden, optional text fields use disclosures, and attendance/status use readable labels. Portable Text, core images and core publication controls remain native.

The compatibility adapter fixes confirmed Block Kit defects: embedded nested forms, stale form state after switching occurrences, missing combobox item keys and unassociated date labels. Its additional admin presentation adapter translates marked Eventual blocks, the schedule-panel title, publication controls and patch review using EmDash's **admin language**, independently of the event's content language. English and French are supplied; other admin languages fall back to English. Occurrences use compact date/action rows that fit the narrow panel. Known English fallbacks in the core French catalog are filled through Lingui's public API without replacing existing custom translations. Stored IDs, input values, patches, reference targets and editorial content are preserved. The transforms recognize the exact tested core builds; unknown versions/shapes fail explicitly. They never edit `node_modules` or change RPCs, permissions, receipts or publication behavior. Remove these adapters only after validating supported upstream replacements.

## 2. Upgrade existing SQLite schemas and reference snapshots

Changing a blueprint does **not** update an installed collection. On an existing site, stop its application and all database writers, then run the offline tool with Node 24 or newer. It uses EmDash's SchemaRegistry for schema changes and a transaction for reference backfills. The CLI checks EmDash 1.0.1. The programmatic function is for tests and deliberate host integrations, not a sandbox MCP endpoint.

From the Eventual source checkout:

```powershell
node scripts/upgrade-native-editor.mjs --database C:/path/to/site/data.db
node scripts/upgrade-native-editor.mjs --database C:/path/to/site/data.db --apply --backup C:/path/to/backups/before-eventual-editor.db
```

The first command runs the proposed changes inside a transaction and rolls them back. The second requires a new backup filename in an existing directory and creates a consistent SQLite backup before changing anything. Keep the JSON output with the backup. Review warnings before resuming writers.

For an installed package, the script is `node_modules/eventual/scripts/upgrade-native-editor.mjs`. It needs EmDash 1.0.1 and Kysely 0.29.x available as peers. React is needed by the frontend companion. The shipped schema export is compiled JavaScript with declarations; the CLI does not execute TypeScript inside `node_modules`. No schema or data upgrade happens automatically at plugin initialization.

The upgrade:

- Preserves existing field types, defaults, required/unique/index flags and custom reference targets; updates recognized labels and widget assignments.
- Creates the default organizers directory if needed and adds a missing organizer reference field.
- Adds **column-backed** `venue_id`/`organizer_id` fields when the old reference is bound to a core relation. These fields are shared (`translatable: false`). New blueprints default to unbound reference fields, which are also column-backed.
- Backfills published IDs from committed reference edges, pending IDs from each revision's `_references`, and historical IDs from available snapshots. A pending selection must never overwrite the live selection. Uses a consistent canonical ID across locale siblings.
- Preserves entry IDs, locale/group, publication state, timestamps, versions, revision IDs/pointers, all editorial content and all old reference edges. Reruns preserve existing canonical IDs, including an explicit empty selection.
- Rejects missing/ambiguous groups or incompatible bindings instead of guessing. Historical revisions without enough information are left unchanged and reported as warnings.

After upgrading a relation-bound schema, Eventual reads and writes the added ID column. Old relation edges are retained as historical data; they are not kept in sync with later ID-column edits. Generic graph/relationship consumers must use the canonical column or be adapted separately. Do not re-enable the old bound picker. Do not delete the old reference fields/edges as part of routine cleanup.

This CLI is an **offline SQLite upgrade**. It is not a Cloudflare D1 deployment tool. Fresh D1 installations can use the unbound blueprints; an existing D1 relation-bound installation requires an equivalent reviewed host migration and backup using its deployment tooling. Do not run this SQLite CLI against D1 or pretend a seed file upgrades an existing site.

## 3. Check the editor

1. Restart the site. Existing events should show Title, Portable Text, media and readable status/attendance controls; no recurrence, exception, identity or history JSON inputs.
2. Save a new event's first draft, then open **Dates, venue & repeat**. Pick local dates/times and a time zone; use Other time zone for any valid IANA zone not in the common list.
3. Expand Repeat (Répétition). Set daily, weekly or either monthly pattern. Only relevant controls and interval units should appear. Save/reopen and confirm the rule survives.
4. Expand Where (Où). Choose a saved venue; translations form one choice, with the event's language preferred. Search by name or address if needed (80 visible matches). Existing IDs remain stable, selected addresses are shown, and draft venues are identified. Native create/edit links open a separate tab; use Refresh directories on returning. Confirm EmDash's draft review, then save. A venue must be published before its event can publish or be scheduled.
5. Confirm a saved draft has not changed the live JSON/ICS feed. Publish, then confirm the venue/address and organizer appear. Test clearing the reference, too.
6. Manage a date: cancel, restore or reschedule using local date/time controls; edit localized announcement copy. Confirm only that language's copy changes and the recurrence UID remains stable.

The host presentation adapter formats Eventual's core patch review with human field labels, dates, recurrence summaries and cached venue/organizer names. Unknown reference IDs remain visible if no directory label is available; the actual patch retains the ID. Cancellation and rescheduling reviews identify original dates and replacement times. This is presentation of the core dialog, not a replacement for its approval mechanism. Review remains required by the host receipt mechanism; do not bypass it by writing directly from the panel.

Core drafts and live content remain separate. On the tested host the editor can autosave an accepted patch; publishing remains explicit. The panel's effect is a proposal, not a direct database update. Keep the event page open while applying changes and allow autosave to finish before switching languages or publishing.

## 4. Roll back safely

Stop all writers. Restore the consistent backup as a complete database using the site's normal recovery process; do not replace a live SQLite file while its WAL is open. Restore the prior host/plugin code as well. A full backup restore loses edits made after that backup, so take a new backup before rollback and reconcile later editorial work deliberately. The upgrade never deletes legacy plugin storage.
