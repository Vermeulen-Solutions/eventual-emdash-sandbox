# Eventual 0.7.5

Status: prepared and validated on 2026-09-27; **not published**. The current
package profile is awaiting review. The 0.7.0 release record has passed review,
but this does not approve the current package profile.

## Description editor

- The description now lives directly in the main event form as one multiline
  field. Editors no longer add, reorder, and save separate description sections.
- Plain text remains the default. Optional Markdown supports bold, italics,
  headings, bullet lists, and links, with a compact syntax guide beside the form.
- Saving event details and duplicating an event preserve the complete description.
  Existing imported HTML remains untouched unless an editor replaces it, and the
  form clearly identifies those legacy descriptions.
- Eventual stores description source unchanged. MCP and the public JSON route
  continue to use the same string field, so no storage migration is required.

## Limits

Block Kit does not provide a browser rich-text control or live Markdown preview,
so formatting remains visible as lightweight Markdown while editing. There is no
embedded image editor or visitor calendar UI. No dependencies, capabilities, or
storage migrations were added.

## Validation and bundle

Executed with Node v24.21.0, npm v10.5.0, and the pinned plugin CLI 0.12.0:

```powershell
npm run typecheck
npm test
npm run validate
npm run bundle
npm exec emdash-plugin -- bundle --validate-only
```

All passed; **77 tests in 10 files**. Focused coverage includes inline
descriptions, Markdown source preservation, imported HTML preservation,
duplication, validation, recurrence actions, and host response limits.

Exact final inspection output:

```text
i Bundle size: 155.9 KB across 3 files
√ Validation passed
```

| Package entry | Bytes |
| --- | ---: |
| backend.js | 107,276 |
| manifest.json | 35,287 |
| README.md | 17,068 |
| Total decompressed | **159,631** |

Backend limit: 131,072 bytes. Complete package limit: 262,144 bytes.
Preparation archive: `dist/eventual-0.7.5.tar.gz`, **41,399 bytes** compressed.
SHA-256:

```text
620f4e3430a95222823df80e46f605123b0946a48b9ad21b4a0e39e0cc148cb5
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
