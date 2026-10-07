> **Historical record:** Current behavior is documented in [0.13.0 release notes](release-notes-0.13.0.md) and the [breaking upgrade guide](upgrade-0.13.0.md). Host-package, hidden-field and publication-status statements below describe superseded work, not current instructions.

# Eventual 0.12.0: installation, French editing and release handoff

Date: 7 October 2026. Repository: `C:\dev\eventual-em\eventual-emdash-sandbox`. This is the follow-up to [the recovery audit](recovery-audit-2026-10-07.md), in the user's requested order: complete installation, French interface and venue polish, compatibility/upgrade checks, release acceptance and packaging.

## 1. Outcome and scope

The native collection architecture is retained. The intended editing experience is a normal EmDash content form for title, Portable Text and media, with a friendly Eventual panel for dates, venue, recurrence and individual dates. Nontechnical editors do not enter schedule JSON, migration IDs or database reference IDs.

This pass supplies a complete host integration, reduces optional-field clutter, translates Eventual's interface into French, improves venue selection and draft review, verifies the installed-package boundary and prepares matching local backend/host artifacts. No commit, push, registry profile write, npm publication, registry release or production-site deployment is performed. Version remains the unreleased `0.12.0` candidate. Pre-existing uncommitted recovery work is preserved.

The original untracked `eventual-0.12.0.tgz` at the repository root is an older artifact and is not the tested candidate. Use the final paths and checksums in the artifact section below. Do not distribute a tarball based only on its versioned filename.

## 2. Installation is now one host integration

Files: `astro/install.mjs`, `astro/install.d.mts`, `astro/descriptor.mjs`, `astro/admin.mjs`, `scripts/check-editor-installation.mjs`, `scripts/install.test.mjs`, package exports.

Replace the default EmDash integration import with `eventual/install` in the site's existing Astro configuration. The wrapper registers the frontend-only native companion and the Vite compatibility adapter together. It preserves the host's database, sandbox runner, media storage, adapters, other plugins and existing integration hooks.

- A source installation keeps a single `sandboxed: [eventual]` backend descriptor.
- A registry installation keeps its registry backend and does not add the source descriptor. Installing the host tarball does not register another backend automatically.
- Remove previous manual `eventualEditor(...)` and `eventualEditorCompatibility()` registrations when adopting the wrapper.
- Source backend and companion versions must match. Duplicate backends, mismatched companions and a nonsandbox source backend are rejected. Verify registry/backend versions in the site's Plugins page; the wrapper cannot inspect a registry installation at config construction time.
- The frontend companion declares no routes, hooks, storage, network hosts or backend capabilities. The domain backend remains sandboxed. Host frontend installation is trusted site configuration, not an additional sandbox isolation boundary.

The doctor checks installed versions and a configuration candidate without modifying the site. Static inspection cannot prove that a conditional config executed, that a schema upgrade happened or that the backend is installed. Run actual Astro diagnostics/build and an editor workflow as well.

Both release artifacts are necessary. The registry archive cannot install React renderers or upgrade a database; an npm/host tarball alone is not evidence that a registry-managed backend was updated.

## 3. Supported versions and adapter maintenance

| Component | Supported/tested contract |
| --- | --- |
| Node | 24 or newer required; acceptance executed on 24.21.0 |
| EmDash / Admin / Block Kit | Exactly 1.0.1 |
| Astro | 7.3.x starting at 7.3.2; checked with 7.3.2 and 7.3.5 |
| Vite | 8.3.x; verified host/package builds use this line |
| React | 19.x; clean consumer uses 19.2.4 |
| Kysely for offline upgrade | 0.29.x |
| Plugin CLI / plugin-test | Repository-pinned 0.13.1 / 0.2.6 |

Do not replace this matrix with “1.0.1 or later.” The host wrapper rejects other core/toolchain versions. The compatibility adapter recognizes the tested emitted source shapes and fails explicitly when major markers are missing. Future upstream upgrades require checking source guards, browser behavior, draft receipt flow and production builds before widening the matrix.

`astro/editor-compat.mjs` fixes embedded Block Kit forms without patching installed dependency files: a nested form becomes a grouped container; its buttons submit the panel action, not the surrounding content editor. Enter handling preserves multiline text, buttons, comboboxes and IME composition. Form state and uncontrolled input keys reset when new occurrence definitions arrive. Date inputs have associated labels; combobox options have stable keys.

Admin remains prebundled because it has CommonJS dependencies. The adapter runs before Vite 8 dependency optimization and during production transformation. Excluding Admin from optimization broke its dependencies and is not the shipped approach. The presentation helper is resolved relative to the installed adapter, which works in both linked-source and installed-package hosts.

## 4. French interface and a less confusing event form

Files: `astro/admin.mjs`, `astro/editor-i18n.mjs`, `astro/editor-compat.mjs`, `src/native/schedule-panel.ts`, `src/schema/blueprint.ts`.

The admin language drives UI labels; the content locale drives editorial data and directory translation preference. An English event in a French admin session keeps its English title and venue name while controls read in French. English and French are supplied; other UI languages fall back to English. Stored titles, entered values, IDs, patch operations, reference targets and localized copy are not translated by presentation code.

The main form retains native Portable Text, media and core publishing. Internal recurrence, exceptions, occurrence copy, identity, history and migration fields remain stored but use managed renderers. Optional text/URL fields start collapsed, including when populated; a “Renseigné” badge signals saved content. Helper text is associated with the input. URLs use URL inputs. Physical attendance hides the irrelevant online-link disclosure without clearing the saved URL; changing back reveals it. Business event status is explained separately from core publication status.

The panel is divided into Quand, Où, Répétition and Dates individuelles. Relevant groups open after actions/errors. Interval controls say days, weeks or months and only appear for the chosen pattern. Weekly days are Monday first. Monthly summaries explain weekday position and the skip/last-day policy instead of showing an opaque object.

The occurrence inspector uses compact original/current date rows and actions instead of a four-column table squeezed into the settings panel. It retains the same recurrence IDs and operations. Cancellation, restoration and rescheduling remain shared schedule changes; announcement copy remains per language.

Eventual's core draft-review presentation shows human field labels, dates, recurrence summaries, cancellation/rescheduling details and directory names. The real patch still contains stable IDs and goes through the host receipt/review mechanism. If a name cannot be resolved, the ID remains visible instead of guessing. Portable Text announcement values are summarized as text. The directory label cache is bounded and changes presentation only.

Known English fallbacks in the 1.0.1 French core catalog are filled through Lingui's public API. Existing French or host-customized translations are preserved. Core publication controls and Eventual policy errors are translated at presentation boundaries. Browser acceptance caught a local `i18n` variable containing the **content configuration** in ContentEditPage; publication errors now read the independent UI locale. This distinction must be preserved during future refactoring.

The main event description is rich text. The small per-occurrence announcement-description form is still plain text converted to Portable Text when deliberately changed; editing another announcement property preserves its existing rich blocks. It is not a second rich-text toolbar.

## 5. Venue and organizer selection

Files: `src/native/directory.ts`, `src/native/schedule-panel.ts`, directory tests and browser acceptance.

The installed event schema defines the target collection. A site using `locations` continues to use it; plugin settings cannot silently redirect references. Directory reads paginate defensively and fail rather than silently truncating oversized scans.

Choices group translation siblings into one venue/organizer. Prefer a published row in the event's language for display, but retain an already selected row ID. This avoids silently changing a shared reference merely because an editor switches languages or searches. Names, structured addresses, locale and draft warnings explain the choice. Search matches names and addresses without accent sensitivity; at most 80 matches are shown, with the current selection retained. The saved address is previewed. Create/edit links point at the actual host origin, open native directory forms in another tab and offer Refresh directories when returning.

Draft dependencies can be selected and saved in an event draft, but cannot satisfy event publication. The panel warns before publication; core policy rejects publishing or scheduling against an unpublished dependency. Browser acceptance covers a published venue selection surviving reload and a new draft event being prevented from publishing with a draft venue. Existing dependency guards remain covered by the real core/runtime suite.

Reference storage must remain canonical. Existing relation-bound references are storage-less in ordinary plugin content reads; the earlier recovery added column-backed aliases and live/draft/history backfill. This pass does not undo that repair. Public hydration may use a published translated venue/organizer while keeping the canonical saved ID unchanged. Old graph edges are retained as history, not a second reference authority.

## 6. Installed-package schema and tooling repair

Files: `scripts/build-host.mjs`, `astro/blueprint.mjs`, `astro/blueprint.d.mts`, `scripts/export-native-schema.mjs`, `scripts/upgrade-native-editor.mjs`, package exports/build/prepack.

Node refuses to strip TypeScript inside installed packages. The former schema export and host upgrade CLI worked from this checkout but could fail in `node_modules`. The build now generates compiled JavaScript and declarations from the blueprint; `eventual/schema` and shipped CLIs use those compiled files.

The packed consumer installs the tarball into a fresh project without `--legacy-peer-deps`, imports the host integration/descriptor and compiled schema, runs the installed schema-export CLI, and builds Astro pages. The browser harness also seeds its fresh real core database from the **installed** compiled blueprint and runs the installed upgrade CLI in preview. It verifies every packed installed file against the tarball's recorded hashes; no dependency/source edits are permitted in that acceptance installation.

When changing the blueprint, run `npm run build` to regenerate its host exports before testing or packing. `prepack` also regenerates them. Automated JSON pack consumers use `--ignore-scripts` only after an explicit build so npm lifecycle chatter cannot corrupt their JSON parsing.

## 7. Existing SQLite upgrade and actual local installation

Runbook: [editor-upgrade.md](editor-upgrade.md). Tool: `scripts/upgrade-native-editor.mjs`.

The offline upgrade uses the real core SchemaRegistry and a transaction. Preview rolls changes back. CLI apply requires an existing database, a new backup filename in an existing directory and the exact tested core version. Stop all writers first. It preserves custom types, required/default/index/unique settings and reference targets while updating recognized labels/widget metadata. It is idempotent when those cosmetics already match.

The previous reference repair preserves committed, pending and historical selections independently. A pending draft must not overwrite a live reference. Existing canonical aliases, including explicit empty values, survive reruns. Missing/ambiguous bindings fail rather than being guessed. Available historical snapshots are backfilled; insufficient snapshots produce warnings. Original content, revisions and edges are retained.

The actual local host is `C:\dev\eventual-em\eventual-emdash-test-site`. Its config uses `eventual/install`. The final cosmetic apply changed ten event field definitions, zero entries and zero revisions, with no warnings. A second preview returned an empty field list and zero changes.

Retained consistent backups, in chronological order:

1. `data.db-before-eventual-editor-20261007.bak`: original reference/schema recovery, described in the earlier audit.
2. `data.db-before-eventual-fr-20261007.bak`: French renderer/widget metadata preparation.
3. `data.db-before-eventual-release-20261007.bak`: final readable technical labels.

Do not commit or distribute these site databases. Upgrade evidence is in `reports/refinement-upgrade-*.json` and `reports/refinement-release-upgrade-*.json`. Functional browser mutations use separate freshly seeded acceptance databases under ignored `reports/packed-consumer-*`, not the original site's event content.

This is an offline **SQLite** upgrade, not deployed Cloudflare D1 tooling. The production-contract unit suite uses a real local D1/workerd runtime, but that does not prove a remote D1 deployment/upgrade. An existing D1 relation-bound site needs an equivalent reviewed host migration with its own backup/restore process.

## 8. Verification and what each check proves

Final check results and exact artifact measurements are appended below. Evidence remains in ignored local `reports` files.

- Root Vitest explicitly includes `tests/**/*.test.ts`: 21 plugin test files, 170 tests, run separately in UTC and America/New_York. The example has its own Node pool and 29 tests in five files. Earlier discovery accidentally included example tests in the Cloudflare pool and one combined UTC run had a worker-start bad-port error; that log is preserved and is not counted as a pass. Pool separation and both clean plugin runs replace that evidence.
- The core/runtime suite covers native authority, lifecycle/draft/publishing contracts, recurrence/DST/all-day semantics, cancellation identity/sequence, iCalendar escaping and octet folding, schema/Portable Text/adapters, migration/dependencies and native editor draft commands.
- Standalone tooling tests cover compatibility transforms, UI localization/data preservation, install/version guards, offline SQLite live/pending/history preservation and rollback, archive budgets and transfer conversions.
- Strict TypeScript, manifest validation and npm audit are separate checks. Npm audit reflects the tested lockfile at the time of the run, not a permanent vulnerability guarantee.
- A clean packed Astro consumer builds en/fr/ar/th pages and checks native/Live content adaptation, civil query dates, rich content, JSON-LD metadata/escaping and localized visible dates.
- Browser workflow 1 uses the real installed plugin, core editor, SQLite and workerd backend: French UI with English content, one choice for venue translations, saved selection after reload, recurrence, retained optional URLs, core review, publication, JSON/ICS, cancellation/restoration and stable UID. It captures desktop/mobile views and checks mobile overflow and browser page errors.
- Browser workflow 2 checks unauthenticated migration rejection, first-draft creation, local date entry through review, draft venue warnings and rejected publication while the item remains a draft.
- The existing local host runs the doctor, Astro diagnostics and a production build. The public example runs its own diagnostics/tests and built-page check. The profiling suite checks deterministic database-operation behavior; it is not a hosted large-site load test.
- Impeccable's detector ran once on the relevant interface modules and reported an empty finding list. Desktop/mobile visual review identified the narrow occurrence table and core French fallbacks; those were corrected in one batched pass. Functional reruns verify the corrected interface rather than opening another design iteration.

One browser failure during screenshot preparation tried to close animated, disappearing core notifications. Screenshot setup now reloads the saved entry, which proves persistence and clears transient messages. The publish-rejection check separately found and fixed the actual language-source bug described above. Neither failure is counted as successful acceptance; final logs must show both workflows passing.

## 9. Release budgets and packaging policy

The former soft per-file target was 110 KiB (112,640 bytes). The recovered directory/editor backend exceeds that former target. This pass explicitly adjusts the working soft limit to **116 KiB (118,784 bytes)**, retaining a 12 KiB reserve beneath the registry's **128 KiB hard per-file limit**. The soft total/count limits remain 220 KiB/16 files; hard limits remain 256 KiB/20 files. This is a budget tradeoff, not a claim that the former target passed. Measurements below are for the actual decompressed installation archive; compressed tarball size is reported separately.

`npm run release:prepare` builds and bundles local artifacts, checks soft and hard limits, verifies manifest/package version alignment and required host files, computes SHA-256 and refuses a host archive that differs from the browser-tested tarball. It also requires both clean timezone logs and both browser workflows. It does not publish, tag, commit or upload. If any packaged source/doc/metadata changes afterward, rerun packed-package acceptance and browser tests before sealing another archive.

CI now specifies Node 24 and Windows/Linux × UTC/New York, including tooling, profiling, package/editor acceptance and example checks. Only the local Windows jobs have been executed in this session. A configured workflow is not a remote green CI result.

Registry identity/profile inspection is read-only: publisher `vermeulen.solutions`, DID `did:plc:g2hei4vcwndrdl3gdbb6np6c`. The PDS signed profile and aggregator both return CID `bafyreig7aucyn7zmpgtvnr5z3kgbsrgibcturthhydks72w6nwuewhw6nu`; the aggregator has a `listing-passed` label for that exact CID. Older override/review labels refer to a different CID and do not certify a future profile revision. The public profile still describes the older release. `update-package` ran in default dry-run mode and recorded the truthful pending description/sections diff. No PDS record was written. Publication must follow the registry skill's exact-CID profile and release review workflow; release approval and package-profile approval are distinct. Applying the pending metadata creates another profile CID that must be checked separately. See `reports/refinement-registry-readiness.json` and `reports/refinement-profile-preview.log`.

## 10. What remains outside this local completion

1. **Publication and distribution:** Review the final working tree and publish the intended immutable version through the authorized release workflow. Deliver the matching host tarball and its checksum alongside the registry backend. If choosing another version, align backend/companion/package/lockfile and rerun acceptance. Never upload the older root tarball.
2. **Site-specific installation:** The local test site is upgraded. Other sites need their own backup, host config, schema/reference preview/apply and editorial acceptance. Registry update alone is insufficient. Existing D1 relation-bound sites need deployment-specific migration tooling.
3. **External subscribers:** In actual Google/Apple/Outlook clients, subscribe before migration, update a series, switch language, cancel/restore and inspect DST/all-day behavior. Confirm no duplicates and expected refresh/removal. Parsed ICS and stable UIDs cannot certify a third party's polling/caching behavior or recovery from old oversized SEQUENCE values.
4. **Live LinguaDash:** Run the installed translation plugin with that site's credentials/locales. Verify editorial translation, shared schedule preservation, Portable Text and publication. Core translation contracts alone do not establish an external AI service workflow.
5. **Remote CI and platform deployment:** Run the configured Linux/Windows matrix after submission. No production Cloudflare site, registry-installed frontend delivery or production calendar subscriber was exercised here. The clean host simulates a source-backed installation; registry constructor preservation is tested separately.
6. **Core transaction guarantee:** Dependency policy reads happen before writes. Simultaneous event publication and dependency deletion are not locked into one transaction by plugin hooks. If that concurrency guarantee is required, implement it in the host/core transaction layer; do not pretend a preflight scan is an atomic constraint.
7. **Large-site performance:** Scans and visible directory results are bounded and fail explicitly at limits. Measure actual content volume and host time budgets before increasing caps. The 500-exception count limit does not remove byte-size/patch/route constraints for especially large announcement content.
8. **Legacy retention and graph consumers:** Obsolete private editor code is removed by the recovery work. Legacy storage, migration metadata and historical relation edges are intentionally retained. A destructive purge requires a separate reviewed backup/retention plan and confirmation that no consumer uses those edges/IDs. New code must use the canonical reference column and native authority.
9. **Upstream adapters:** Replace source transforms only when a tested upstream version fixes embedded forms, refreshed initial values, labeling and native presentation. Preserve core review/receipts, callbacks and explicit publication. The current matrix is narrow by design.

These are specific external/deployment or architectural follow-ups, not unfinished local French form controls. Preserve the core/native model, shared schedule semantics, locale-specific editorial content, non-destructive migration and live-versus-draft separation when continuing this work.

## 11. Final measured acceptance

| Check | Final result | Evidence |
| --- | --- | --- |
| Plugin manifest | Passed during both unit runs and final build/bundle | `reports/refinement-unit.log`, `reports/refinement-release.log` |
| Plugin tests, UTC | 21 files / 170 passed, no unhandled errors | `reports/refinement-unit.log` |
| Plugin tests, America/New_York | 21 files / 170 passed, no unhandled errors | `reports/refinement-unit-new-york.log` |
| Standalone tooling | 17 passed | `reports/refinement-tooling.log` |
| Strict TypeScript | Passed, no errors | `reports/refinement-typecheck.log` |
| Profiling | 2 passed | `reports/refinement-profile.log` |
| Packed Astro consumer | en/fr/ar/th pages passed; 53 installed package files hashed | `reports/packed-astro.json`, `reports/refinement-packed.log` |
| Real packed editor workflows | 2 passed in 55.8 seconds; no skipped/flaky/unexpected tests | `reports/browser-acceptance.json`, `reports/refinement-browser.log` |
| Fresh installed upgrade CLI | Preview needs no schema/data changes | `reports/installed-upgrade-preview.json` |
| Existing host doctor | All prerequisites ready; actual version/config recorded | `reports/refinement-site-installation.json` |
| Existing host Astro diagnostics | 28 files, 0 errors/warnings/hints | `reports/refinement-site-check.log` |
| Existing host production build | Passed with final adapter | `reports/refinement-site-build.log` |
| Example Astro diagnostics | 23 files, 0 errors/warnings/hints | `reports/refinement-example-check.log` |
| Example tests | 5 files / 29 passed | `reports/refinement-example-tests.log` |
| Example built-page assertions | Passed JSON-LD, image/link safety, hybrid location and localization checks | `reports/refinement-example-page.log` |
| Npm audit | 0 known vulnerabilities in the checked root lockfile | `reports/refinement-audit.json` |
| Whitespace/diff check | Passed | `reports/refinement-diff-check.log` |
| Interface detector | No findings | `reports/refinement-ui-detector.json` |
| Registry profile preview/readiness | Dry-run only; current signed and aggregator CIDs match and current CID is labeled passed | `reports/refinement-profile-preview.log`, `reports/refinement-registry-readiness.json` |
| Local artifact preparation | Passed budgets, required files, version alignment and browser-tested host SHA | `reports/release-preparation.json` |

The production host build emits an advisory about a core frontend chunk over 500 kB. This is separate from the sandbox installation budgets; it is not an Astro diagnostic error or a plugin registry-size failure. The harness first retries a core setup request that can fail during initial media-index activation on a freshly seeded database. Its successful editor/API run is the acceptance evidence; the earlier bootstrap request is not described as an entirely clean server log.

Final decompressed registry installation payload:

| File | Bytes |
| --- | ---: |
| `backend.js` | 115,916 |
| `manifest.json` | 47,100 |
| `README.md` | 16,987 |
| **Total, three files** | **180,003** |

The backend is 3,276 bytes over the former 110 KiB soft target, 2,868 bytes under the revised 116 KiB target and 15,156 bytes under the hard 128 KiB limit. Total payload is 45,277 bytes under the unchanged soft total limit. No hard installation limit was relaxed.

## 12. Exact prepared artifacts

Prepared at `2026-10-07T08:25:35.007Z`, version `0.12.0`, `published: false`.

| Artifact | Absolute path | Compressed bytes | SHA-256 |
| --- | --- | ---: | --- |
| Registry backend | `C:\dev\eventual-em\eventual-emdash-sandbox\dist\eventual-0.12.0.tar.gz` | 45,882 | `767fa262b20f8dab136b0cfb79d0b301bfae94c9b5b21d247636793fb043cb11` |
| Matching host package | `C:\dev\eventual-em\eventual-emdash-sandbox\dist\host\eventual-0.12.0.tgz` | 121,228 | `1f1be335e5567f4d092c799643995b6cf828893c075fcc021c7835eae6fb0c08` |

Checksums: `C:\dev\eventual-em\eventual-emdash-sandbox\dist\SHA256SUMS`. Machine report: `C:\dev\eventual-em\eventual-emdash-sandbox\reports\release-preparation.json`. The host hash matches the clean packed consumer and browser acceptance. Registry bundle gzip metadata can change on a fresh bundle; use the checksum of the exact final archive you distribute rather than assuming a rebuild keeps the same hash.

French editor images are exported as `images/registry-0.12.0/editor-fr-desktop.png` and `editor-fr-mobile.png`, and referenced in the release manifest. The screenshot uses an English event deliberately to demonstrate independent UI/content languages. Existing public screenshots are retained as public-page examples, not proof of the new editor.

### Reproduce a changed candidate

From the plugin repository with Node 24:

```powershell
npm ci
npm run typecheck
npm run build
$env:TZ='UTC'
npm test *> reports/refinement-unit.log
# Stop here if the command failed; do not count a log containing unhandled errors.
$env:TZ='America/New_York'
npm test *> reports/refinement-unit-new-york.log
npm run test:tooling *> reports/refinement-tooling.log
npm run profile
npm run test:package
npx playwright install chromium
npm run test:editor
npm audit
git diff --check
npm run release:prepare
```

Create `reports` first in a clean checkout. Run example `npm ci`, `npm run check`, `npm test` and `npm run test:page` in `examples/astro-events`. For an installed host run its doctor, `npx astro check`, `npx astro build` and the site-specific upgrade/editor checklist. On Linux CI install Chromium system dependencies with `playwright install --with-deps chromium`. Inspect every exit code and stop at failures; the command list is a sequence of required checks, not a shell script that automatically stops for every native-command error. Restore the caller's `TZ` after the timezone checks if continuing interactive work.

Do not modify packaged files after package/browser acceptance and then publish an untested archive. `release:prepare` protects the host tarball identity; it does not replace external client acceptance, a reviewed deployment migration or registry publication authorization.
