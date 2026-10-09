# Eventual 0.13.3

Requires EmDash >=1.2.0 <2.0.0. Update in EmDash plugin administration. Existing 0.13.x installations need no new capabilities or schemas.

Sites supplying event links can request publicEvents with publicUrls=false to skip canonical URL RPCs. Default: true. Budget failures use EmDash's failed JSON response contract. Large feeds and legacy migrations remain constrained; local tests do not certify Cloudflare CPU limits. Read the [release notes](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/blob/main/docs/release-notes-0.13.3.md).

**Upgrading from 0.12.x or earlier is breaking:** back up and follow the [upgrade guide](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/blob/main/docs/upgrade-0.13.0.md). An update does not create schemas or migrate data. Native sources are authoritative even while empty. Preserve calendar and migration identity.

An administrator must create/review compatible native collections with the optional exporter or [MCP setup guide](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/blob/main/docs/collection-setup.md), then select event, venue and organizer collections under Eventual → Settings. Custom collection names are supported.

No Eventual frontend companion or second runtime package is required. Remove historical eventual/install adapters on EmDash 1.2. Themes and Astro helpers are optional.

Edit announcements in core. Save first, open Dates, venue & repeat, save schedule changes, reload, and publish in core. Dates/references are shared across languages. Internal fields remain visible in stock core.

Public JSON: /_emdash/api/plugins/eventual/publicEvents. ICS: /_emdash/api/plugins/eventual/calendar. Filters: locale, strict, category. JSON: publicUrls=false for sites supplying event links.

Enable intended tools under Eventual → Agent access. Editors need content:edit_any; settings/MCP management need plugins:manage. Schema access is read-only; no outbound hosts.
