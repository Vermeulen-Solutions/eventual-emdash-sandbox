# Eventual 0.7.5

Status: prepared and validated on 2026-09-27; **not published**. The current
package profile is awaiting review. The 0.7.0 release record has passed review,
but this does not approve the current package profile.

## Description editor

- Saved events have a separate description overview with Add paragraph, Add
  heading, and Add list actions. Editors write ordinary text without HTML or
  Markdown. Only the section being edited opens a form.
- A complete bullet list is one section, with one item per line. Paragraphs
  support normal, bold, or italic text. Sections can be edited, reordered, or
  removed with confirmation. Changes save on submission; Cancel discards the
  current edit.
- Validation retains submitted text. Stale edits are rejected when the event
  has changed since the editor was opened.
- Saving other event details and duplicating an event preserve the description.
  Unsupported existing HTML remains untouched unless the editor explicitly
  saves a replacement. There is no import or automatic HTML conversion feature.
- Domain parsing and serialization live in `src/domain/description.ts`;
  description admin rendering and actions live in `src/description-admin.ts`.
  Existing storage, public routes, and MCP description strings remain compatible.

## Limits

Descriptions support 12 sections, 5,000 characters per section, up to 100 items
per list, and 60,000 UTF-8 bytes of serialized HTML. Overview excerpts limit the
Block Kit response size. Formatting applies to a complete paragraph; there is
no word-selection toolbar, arbitrary HTML editor, embedded image editor, or
visitor calendar UI. No dependencies, capabilities, or storage migrations were
added.

## Validation and bundle

Executed with Node v24.21.0, npm v10.5.0, and the pinned plugin CLI 0.12.0:

```powershell
npm run typecheck
npm test
npm run validate
npm run bundle
npm exec emdash-plugin -- bundle --validate-only
```

All passed; **77 tests in 10 files**. Focused coverage includes serialization,
validation, grouped lists, section actions, retained drafts, stale edits,
unsupported HTML preservation, duplication, and host response limits.

Exact final inspection output:

```text
i Bundle size: 155.2 KB across 3 files
√ Validation passed
```

| Package entry | Bytes |
| --- | ---: |
| backend.js | 106,940 |
| manifest.json | 35,287 |
| README.md | 16,746 |
| Total decompressed | **158,973** |

Backend limit: 131,072 bytes. Complete package limit: 262,144 bytes.
Preparation archive: `dist/eventual-0.7.5.tar.gz`, **41,058 bytes** compressed.
SHA-256:

```text
7b072d68d2a7d5e9af2e29904b8723578853d4b483236c6d2b993d13caa11872
```

The publish command rebuilds the archive, so its final checksum must be recorded
after publication rather than assuming this preparation checksum is identical.

## Registry hold and release behavior

As checked on 2026-09-27:

- Current signed PDS profile CID:
  `bafyreiemauxipdfgvpq2pa3zuhzitb5guull2x5czjaqwavcw5dxgdwsu4`.
  Its active label is `listing-review`, with no approval on this CID.
- Aggregator profile CID:
  `bafyreihmhmy2enhoua54onvlbrfopqzvi6mzbphcpwvrs37tllygcwbwsy`.
  This older profile has `listing-passed` and `listing-overridden` labels.
- 0.7.0 release CID:
  `bafyreiahrhax5aeno3kvzrxdnno2iacqjqvtb4dsdwct3inutfjedbshly`.
  Publisher and aggregator agree, and this release has `listing-passed`.

`npm exec emdash-plugin -- update-package --json` reports no profile differences
and performs no write. However, inspection of the installed CLI 0.12.0 confirms
that direct publishing calls `stampLastUpdated` on the existing profile and
includes a profile update alongside the release creation. The new timestamp
changes the profile CID even when its descriptive metadata is unchanged.
Another review may therefore occur on a later publication; waiting for the
present review cannot guarantee that the next release becomes immediately
installable. No registry records were written while preparing this release.

Once the current profile has an applicable approval and matches the aggregator,
the authorized direct publication command is:

```powershell
Set-Location C:\dev\eventual-em\eventual-emdash-sandbox
npm run publish -- --json
```

After publication, inspect profile and release CIDs and labels separately:

```powershell
npm exec emdash-plugin -- info vermeulen.solutions eventual --version 0.7.5 --json
```

No site installation or update was performed. After registry records agree and
are approved, the Puplinge administrator can update Eventual to 0.7.5 through
the EmDash installed-plugin update action. This release adds no MCP tools or
capabilities requiring additional consent.
