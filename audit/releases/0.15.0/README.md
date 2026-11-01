# Eventual 0.15.0 — 1 November 2026

Release preparation authorized in this chat. This minor release adds opt-in
public-feed cache evidence and matching source helpers. The implementation audit
is [here](../../cache-integration/README.md); the [integration guide](../../../docs/public-feed-caching.md)
includes host limitations and the BBHC adoption checklist.

No BBHC files, production content or site deployment are part of this release.
Capabilities, MCP tools, content schemas, identities and existing rendering
compatibility remain unchanged. Caching integration uses EmDash >=1.4.0 <2.0.0,
explicit host eligibility, <=15-second remaining lifetime and no stale serving.

## Preparation

- Publisher: `did:plc:g2hei4vcwndrdl3gdbb6np6c` (`vermeulen.solutions`).
- Pinned CLI: `@emdash-cms/plugin-cli` 0.13.5; EmDash 1.4.0; Node 24.
- Registry section preview changes installation/changelog only; both remain
  below 2,000 graphemes and 20,000 UTF-8 bytes.
- Registry and source-package acceptance results and published record identities
  will be recorded below after their gates complete.

No new MCP tool or capability consent is required. A host may still show the
normal release-update confirmation; existing Agent access choices are retained.
