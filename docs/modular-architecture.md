# Eventual: Modular Architecture, Core Preparation & Expansion Plan

## 1. Executive Summary & The Monolithic Limit

Eventual was conceived as a comprehensive event management solution for EmDash CMS. However, as features grew to include recurring occurrences across DST boundaries, iCalendar feeds with monotonicity and stable sequence tracking, timezone engines, and native collection synchronization, it encountered the hard physical ceilings of the **EmDash / Cloudflare sandbox**:

1. **The 10-Subrequest / RPC Invocation Limit**:
   Every bridge call (`content.get`, `content.list`, `content.getPublicUrl`, `schema.listCollections`, `settings.get`, `media.*`, `storage.*`, `kv.*`, `log.*`) is charged against a strict **10-call quota per invocation**. Eventual already expends 6 to 9 calls on normal public and admin requests. In the 0.14.1 audit, cold calendar feed requests reproduced `HTTP 503 ("The sandbox RPC budget is exceeded")` when attempting to hydrate entries and public URLs within a single request.
2. **The 50 ms CPU Ceiling**:
   Date mathematics, recurrence calculations, timezone conversions, and Portable Text serialization run close to the 50 ms limit.
3. **The Capability / Trust Boundary**:
   Eventual Core currently requests 8 capabilities with `allowedHosts: []`. Bundling external payments (Stripe) or transactional email (confirmations) into Core would require `network:request` and `email:send`, creating an intrusive consent barrier for site owners who simply want an event calendar.
4. **Bundle & Memory Budget**:
   Cloudflare isolate startup and EmDash registry verification enforce tight limits on bundle size (~130 KB uncompressed). Adding extensive third-party SDKs or multi-megabyte translation dictionaries directly into `backend.js` is non-viable.

**Conclusion**: Attempting to add Attendance, Ticketing, and Integrations into the single Eventual sandbox plugin will either force features to be stripped or guarantee catastrophic runtime failures. The monolithic model must transition to a **Modular Suite**.

---

## 2. EmDash Publisher Benchmark

Reviewing leading multi-plugin publishers on the EmDash platform reveals an industry consensus:

- **`@dinkuskit.com` (Domain Core + Satellite Add-ons)**:
  - *DinkusKit Commerce*: Core data model (products, prices, orders).
  - *DinkusKit Payments*: Dedicated Stripe integration (`allowedHosts: [payments.dinkuskit.com]`).
  - *DinkusKit Ship*: Dedicated USPS shipping label workflow.
- **`@pinnacleplugins.com` (Micro-Plugins + Pro Tiering)**:
  - 7 focused micro-plugins (*File Import*, *Feed Import*, *Sheets Sync*, *Backups*, *Export*, *Editorial Workflow*, *Bulk Editor*).
  - Clear monetization via an "EmDash Pro" license key unlocking advanced features (two-way sync, 15-minute crons).
- **`@moorage.dev` (Operational Decoupling)**:
  - Dedicated single-purpose tools (*Lead Delivery*, *Content Approval*, *Site Health*, *SEO*).
  - Webhook delivery and retries are completely isolated from form rendering.

---

## 3. The Target Eventual Architecture

- **Eventual (Core — Free / Open Source)**:
  - Native Events, recurrence engine, venues & organizers directories.
  - iCal subscription feed (.ics) & public JSON API.
  - Astro frontend integration and cache headers.
  - Zero scary permissions (`allowedHosts: []`).
- **Eventual Attendance & RSVP (Add-on — Paid / Freemium)**:
  - RSVP forms, capacity limits, waitlists, attendee management.
  - Check-in QR scanning UI.
  - Automated attendee confirmation emails (`email:send`).
  - Isolated 10-call RPC budget per registration submission.
- **Eventual Tickets & Checkout (Add-on — Paid)**:
  - Paid ticketing tiers, Stripe Checkout integration, receipt generation.
  - Dedicated network permissions (`allowedHosts: ["api.stripe.com"]`).
- **Eventual Sync & Integrations (Add-on — Pro)**:
  - Google Calendar, Outlook, and Eventbrite sync via scheduled crons.

---

## 4. The Localization Modernization in Core

### Root Causes of Previous Limitations
1. **Hardcoded French Gate**: `if (!locale.toLowerCase().startsWith('fr')) return ...` was hardcoded across `src/ui/localize.ts`, `src/ui/native-messages.ts`, and `src/ui/i18n.ts`.
2. **Duplicated & Disjoint Maps**: ~110 UI strings were split between an array-of-pairs `Map` in `i18n.ts` and a `Record` in `native-messages.ts`.
3. **In-Memory Zero Cost**: In-memory dictionary lookups consume zero RPC calls. A structured multi-locale dictionary (`en`, `fr`, `de`, `nl`, `es`) adds minimal footprint while removing all arbitrary language restrictions.

---

## 5. Core Groundwork for Add-ons (Single-Event Query)

Future add-ons (such as Attendance RSVP forms or Ticket Tier selectors) need to hydrate occurrences for a specific event without requesting an entire calendar date range:
- Support optional `eventId` in the public API (`/publicEvents?eventId=...`).
- Pre-filter before recurrence expansion and reference hydration.
- Drops RPC consumption for single-event occurrence hydration to **1–2 calls**, leaving ample headroom for add-on processing.
