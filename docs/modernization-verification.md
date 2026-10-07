> **Historical record:** Current behavior is documented in [0.13.0 release notes](release-notes-0.13.0.md) and the [breaking upgrade guide](upgrade-0.13.0.md). Host-package, hidden-field and publication-status statements below describe superseded work, not current instructions.

# Recovery audit verification — 7 October 2026

Follow-up installation/French/venue acceptance and final release artifacts are recorded in [release-refinements-2026-10-07.md](release-refinements-2026-10-07.md). Counts below describe the earlier recovery pass, not the final separated plugin/example runs.

This replaces the earlier blanket “WP0–WP10 complete / complete product parity” claim. The editor/reference repairs were checked against EmDash 1.0.1, Block Kit 1.0.1, plugin CLI 0.13.1 and plugin-test 0.2.6 on Windows/Node 24.21.0.

See [the detailed audit/handoff](recovery-audit-2026-10-07.md) and [the installation/upgrade runbook](editor-upgrade.md). This working tree is unreleased; registry-only installation does not install the frontend companion or upgrade existing collections.

## Automated checks

| Check | Result | Local evidence |
| --- | --- | --- |
| Manifest + full Vitest suite | 196 passed in 25 files | `reports/recovery-tests.log` |
| Strict TypeScript | Passed, zero errors | `npm run typecheck` |
| Tooling tests | 9 passed, including real SQLite upgrade/backfill/rollback and renderer compatibility | `reports/recovery-tooling.log` |
| Packed npm consumer | Passed: editor companion/compat exports plus Astro native/Live adapters and en/fr/ar/th pages | `reports/recovery-package.log`, `reports/packed-astro.json` |
| Astro example diagnostics | 23 files; zero errors, warnings or hints | `reports/recovery-example-check.log` |
| Astro example tests | 29 passed in 5 files | `reports/recovery-example-tests.log` |
| Built example event page | Passed: JSON-LD escaping, links, locations, images and localization | `reports/recovery-example-page.log` |
| Local EmDash host diagnostics | 28 files; zero errors, warnings or hints | `reports/recovery-site-check.log` |
| Local host production build | Passed with editor widgets and Vite compatibility transform; core chunk-size advisory remains | `reports/recovery-site-build.log` |
| UI mechanical detector | No findings on the three changed UI implementations | Impeccable detect JSON: `[]` |
| Plugin workspace npm audit | Zero vulnerabilities after compatible tooling patch updates | `reports/recovery-npm-audit.json` |
| Archive + budget | Backend 112,271 bytes (target 112,640); total 175,940 bytes (target 225,280); 3 files; no budget errors | `reports/recovery-bundle.log`, `reports/recovery-budget.json` |
| Whitespace | Passed | `git diff --check` |

Meaningful regressions use the production EmDash runtime, not only mock-returned patches: host-attested draft effects, live-versus-pending venue selection and localized descriptions, safe duplication, reference publication policies, translated venue/organizer names, migration recovery, subscription identity/cancellations and image aliases. The renderer transform also checks the actual installed dependency source; unknown shapes fail explicitly.

## Browser and data checks

Browser checks used an isolated SQLite backup on localhost port 4337. Panel submissions no longer reload the containing event form. A venue was cleared, accepted through core review, saved/reopened, selected again and published. The public JSON returned the selected venue on all three monthly occurrences; the ICS contained it too. Recurrence controls loaded the actual saved monthly weekday rule. Desktop and 390 px mobile views were inspected; native mobile Settings gives access to the same panel.

Screenshots: `reports/editor-desktop.jpg`, `reports/editor-mobile.jpg`. Feed assertion: `reports/recovery-browser-venue-feed.json`. No browser fixture edits were written to the original site database.

The original local test-site schema was previewed and upgraded with a consistent backup at `C:/dev/eventual-em/eventual-emdash-test-site/data.db-before-eventual-editor-20261007.bak`. Seven event rows and six reference revisions were backfilled without warnings. A separate comparison verified all seven original event rows, all nine revisions and ninety other tables retained their existing content. Only added canonical reference data and expected schema/derived media-index records changed. See `reports/recovery-original-preservation.json` and the upgrade preview/application reports.

## What this verification does not claim

- A new Git commit, registry publication, remote deployment or deployed BBHC/D1 schema migration.
- Actual Apple/Google/Outlook subscriber acceptance or a live LinguaDash AI-translation exercise.
- Native Eventual legacy write/import parity; those operations remain blocked in native mode. Use core tools.
- A full-restorable native transfer backup; its format includes saved content/metadata, not all revision/media/site state.
- A platform transaction that atomically locks event publication against concurrent venue/organizer deletion.
- Automatic host frontend/schema installation from a registry sandbox update, or support for untested renderer versions.

These boundaries are documented in the audit report. They must not be silently relabeled as completed workpackages.
