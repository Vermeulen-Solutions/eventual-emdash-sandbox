# Eventual 0.16.0 — 2 November 2026

Release preparation authorized in this chat. This minor release adds parallelized
feed resolution, public media caching headers, and direct `imageMedia` metadata
for modern frontends and image optimization services.

No BBHC files, production content or site deployment are part of this release.
Capabilities, MCP tools, content schemas, identities and existing rendering
compatibility remain unchanged. Compatibility with EmDash `>=1.2.0 <2.0.0`
is preserved.

## Release record

- Publisher: `did:plc:g2hei4vcwndrdl3gdbb6np6c` (`vermeulen.solutions`).
- Pinned CLI: `@emdash-cms/plugin-cli` 0.13.5; EmDash 1.4.0; Node 24.
- Registry profile sections changed installation/changelog only. The exact
  current profile CID is `bafyreifiwo43cadj3esqdmy3uu5uycpmtix37hx4ce4exo32cew5dlsod4`,
  indexed and `listing-passed`.
- Registry release CID:
  `bafyreigyrch4yvirx4tu2ald4e6r64uzddl4qjj52cc7zuz6vhrqxpadgm`, indexed and
  `listing-passed`. The signed package checksum is
  `bciqgvgvuwp766ag3yk7ww767yvpnifghuk7o2whtf6n6jlxgchkzm7i`; its downloaded
  archive matches SHA-256
  `6a9ab4b3ffef00dbc2bf6b7fdfc55ed414c7a2beed58f32f9be4aee611d5967d`.
- Git release tag: `v0.16.0`,
  pointing at source commit `7ec0d2898ac2395fe1d1152b81b11105bbfe6d86`.
  The source package is 141,078 bytes with SHA-256
  `1c8d815895f125d1fcb89c2c0195186046ebc39c43e5e69b741cb05ff18d08d4`.
- The CDN checked all seven published images. There are no limit violations;
  the banner is 958,008 bytes and emits the existing near-1-MiB warning.

## Acceptance

- `npm run validate`, both timezone full suites (28 files, 249 tests each),
  tooling (24 checks), bundle/budget and local media checks passed.
- The packed Astro consumer, all eight production cached-HTML scenarios and all
  three editor/browser workflows passed against the exact source package SHA
  above.
- Publication succeeded cleanly and was verified against the PDS and Discovery Aggregator.
  No BBHC files or site deployment were changed.

Public verification records and acceptance JSON are in [`evidence/`](evidence/).

No new MCP tool or capability consent is required. A host may still show the
normal release-update confirmation; existing Agent access choices are retained.
