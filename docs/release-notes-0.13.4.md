# Eventual 0.13.4

Patch release for EmDash >=1.2.0 <2.0.0. No new capabilities, outbound hosts, native schemas or data migrations.

## Changes

- Replace the Eventual registry gallery's public event detail screenshot. The 0.11-era `06-hybrid-event-detail.jpg` is retired from the release artifacts; `images/registry-0.13.4/public-event-detail-fr-desktop.png` (1440×1190, French, reproduced by `scripts/verify-public-visual.mjs`) is published instead.
- Add `npm run registry:media`. It estimates every registry CDN derivative (icon → 1000² avatar, banner → 3000×1000, screenshots → 2000 px `feed_thumbnail`, all lossless WebP) and fails when the projected bytes reach EmDash's 1 MiB per-image artifact cap. The check runs in CI and in `npm run release:prepare`.
- After publishing, `node scripts/check-registry-media.mjs --published <version>` measures the real CDN bytes of the release record instead of estimating.

## Why

EmDash's admin plugin page loads screenshots through its registry artifact proxy, which refuses image responses of 1 MiB or more with `ARTIFACT_TOO_LARGE`. The proxy prefers the CDN's `feed_thumbnail` preset, and that preset scales to a 2000 px box — upscaling smaller sources — and encodes lossless WebP, so derived bytes can far exceed the source file.

Measured on 2026-10-11: the published `06-hybrid-event-detail.jpg` blob is a 133 KB, 1004×1222 JPEG, but its `feed_thumbnail` derivative is a 1643×2000 lossless WebP of **1,196,250 bytes**, above the 1,048,576-byte cap. The blob was part of the registry screenshots from 0.11.0 through 0.13.3, so those releases show the failing image in the admin gallery. The new 0.13.4 capture derives to roughly 483 KB. The icon (451 KB) and banner (958 KB, 91% of the cap) pass and now warn.

Published release records are immutable (their lexicon states a release at a given version cannot be modified or replaced), so older versions keep their bytes; 0.13.4 and later are clean.

## Upstream behavior

- The 1 MiB proxy cap, the upscaling `feed_thumbnail` preset and its lossless encoding are EmDash-side; a request that a publisher cannot predict from the source file.
- The reporter also observed the EmDash node sandbox crash after the oversized fetch when IPv6 connectivity failed during the fallback fetch. Not reproduced here.

Both were reported in [eventual-emdash-sandbox#4](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/issues/4).

## Consumer update

None. The plugin runtime, capabilities, schemas and routes are unchanged from 0.13.3; only registry artwork and release tooling changed. Existing 0.13.x installations need no action.
