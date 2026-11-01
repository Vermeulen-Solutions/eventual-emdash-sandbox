# Eventual 0.15.0 — 1 November 2026

Release preparation authorized in this chat. This minor release adds opt-in
public-feed cache evidence and matching source helpers. The implementation audit
is [here](../../cache-integration/README.md); the [integration guide](../../../docs/public-feed-caching.md)
includes host limitations and the BBHC adoption checklist.

No BBHC files, production content or site deployment are part of this release.
Capabilities, MCP tools, content schemas, identities and existing rendering
compatibility remain unchanged. Caching integration uses EmDash >=1.4.0 <2.0.0,
explicit host eligibility, <=15-second remaining lifetime and no stale serving.

## Release record

- Publisher: `did:plc:g2hei4vcwndrdl3gdbb6np6c` (`vermeulen.solutions`).
- Pinned CLI: `@emdash-cms/plugin-cli` 0.13.5; EmDash 1.4.0; Node 24.
- Registry profile sections changed installation/changelog only. The exact
  current profile CID is `bafyreibe6tcbedio46np2qwt6ulkvferpouju6hqqts64gzi2iss4b5ydm`,
  indexed and `listing-passed`.
- Registry release CID:
  `bafyreiaoq2ymqc3gvprqy22yw65bca7cjoxmgvcgipqhcvvocct5grq75q`, indexed and
  `listing-passed`. The signed package checksum is
  `bciqfl42bulrvlmpxzonnoh6yro72zoxom5g46u5ijh644ynd7aqxooy`; its downloaded
  47,500-byte archive exactly matches SHA-256
  `55f341a2e355b1f7cb9ad71fd88bbfacbaee674dcf53a849fdce61a3f821773b`.
- GitHub release: [v0.15.0](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/releases/tag/v0.15.0),
  tag points at source commit `72203747d33ca82b9647d85604abc16fd14be678`.
  The source package is 140,637 bytes with SHA-256
  `069de899f64f1c5e2e80f252be0c9ed41260a97519095f78b11f17fd606409f1`.
  The GitHub release asset digests match both local artifacts.
- The CDN checked all seven published images. There are no limit violations;
  the banner is 958,008 bytes and emits the existing near-1-MiB warning.

## Acceptance

- `npm run validate`, both timezone full suites (28 files, 247 tests each),
  tooling (24 checks), EmDash 1.2 host compatibility, bundle/budget and local
  media checks passed.
- The packed Astro consumer, all eight production cached-HTML scenarios and all
  three editor/browser workflows passed against the exact source package SHA
  above. Hosted Cloudflare acceptance remains unverified.
- GitHub Actions run `41326266831` passed Windows UTC, Windows America/New_York
  and EmDash 1.2 host jobs. Its two Ubuntu runners remain in
  `npm run test:cache`. The tag-triggered run `41345516516` is progressing
  through its CI matrix; it has not completed yet.
- Publication did not overwrite an existing version. No BBHC files or site
  deployment were changed.

Public verification records and acceptance JSON are in [`evidence/`](evidence/).

No new MCP tool or capability consent is required. A host may still show the
normal release-update confirmation; existing Agent access choices are retained.
