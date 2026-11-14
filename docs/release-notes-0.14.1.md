# Eventual 0.14.1

Released 30 October 2026. Requires EmDash **>=1.2.0 <2.0.0**.

This is a compatibility release. It changes no runtime API, capability, schema, route or MCP tool. Existing sites need no data migration.

## Host compatibility

| EmDash | Status | Notes |
| --- | --- | --- |
| 1.2.0 | Supported, unit-tested | The schedule panel's Enter key and validation are scoped to the surrounding entry form; Cloudflare plugin mutations can fail across Worker isolates. |
| 1.3.x | Supported, untested | Same form and Cloudflare limitations. Includes the plugin-storage cursor fix. |
| 1.4.x | Supported, full acceptance | Recommended. Fixes nested Block Kit forms and Cloudflare plugin mutations. |

**Use EmDash 1.4.0 or later for the corrected schedule-panel form behaviour and reliable create/publish across Cloudflare Worker isolates.** The Registry install range stays `>=1.2.0 <2.0.0`; 1.2/1.3 remain installable but retain the host limitations above.

## What changed

- The source `eventual/install` editor transform handles both Block Kit renderers:
  - 1.2/1.3 render plugin forms as `<form>` inside the content editor's form.
  - 1.4 renders `div[role="group"]` with its own Enter handling.
- The transform keeps Eventual's form-value resync, stable field keys and date-label association, which the host renderer does not provide.
- The source editor version gate accepts EmDash/Admin/Block Kit 1.2.0 and 1.4.0.
- The local test site is on EmDash 1.4.0 and now runs a native-collection gate in development and production.

Registry installs never execute the source transform; their rendering comes from the host's `@emdash-cms/blocks`. That is why the 1.4.0 host upgrade, not a Registry-time patch, delivers the form fix.

## Verification

- Full plugin suite on EmDash 1.2.0 and 1.4.0: 26 files, 228 tests, plus 24 tooling tests.
- Packed-consumer packaging and editor acceptance on EmDash 1.4.0.
- Local test site on EmDash 1.4.0 in development and production: plugin registration, MCP consent, admin pages/widget, public feed, event detail and JSON-LD, per-event ICS, native `getEvent`, and draft duplication through native content creation (six groups).

### Known limitation

The full-year calendar subscription can exceed EmDash's ten-bridge-call sandbox budget on a larger native dataset. The local 1.4.0 site recorded a 503 for `/_emdash/api/plugins/eventual/calendar` with five native events; the JSON feed and per-event ICS route were unaffected. Narrower feeds, background jobs and bulk APIs remain open work ([Eventual #5](https://github.com/Vermeulen-Solutions/eventual-rsvp-core/issues/5), [EmDash #4004](https://github.com/emdash-cms/emdash/issues/4004)).

## Upgrade

Update normally in **Plugins → Registry**. No capability consent, schema or data change is required. Sites on EmDash 1.2/1.3 can update Eventual but should upgrade EmDash to 1.4.0 for the form and Cloudflare fixes. Earlier Eventual versions still need the [native-content upgrade](upgrade-0.13.0.md).
