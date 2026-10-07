# Eventual 0.13.0 - breaking upgrade

**Breaking from 0.12.x and earlier. Requires EmDash >=1.2.0 <2.0.0.** Back up and follow the [upgrade guide](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/blob/main/docs/upgrade-0.13.0.md).

Install the sandbox plugin. An administrator must create/review compatible native schemas using the optional exporter or [MCP setup guide](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/blob/main/docs/collection-setup.md), then select event, venue and organizer collections in Eventual → Settings. Custom names and compatible existing locations are supported. No Eventual frontend companion or second runtime package is required; remove historical eventual/install adapters from 1.2 hosts.

Updating the plugin does not create/convert schemas or migrate data. Private records remain intact but private forms are removed. Explicit legacy migration needs --legacy-compatibility schemas. Native sources are authoritative even while empty; plan activation/migration together. Preserve populated migration/calendar identity. Older JSON categories remain readable.

Edit announcements with native Portable Text. Save first, then use Dates, venue & repeat for dates, directories, recurrence and individual dates. Save announcement edits before panel actions, reload afterward, and publish in core. Stock core still displays internal fields; no hidden Advanced renderer is claimed.

English/French controls follow admin locale. Core owns translations, drafts, revisions, media and publishing. JSON: /_emdash/api/plugins/eventual/publicEvents. ICS: /_emdash/api/plugins/eventual/calendar. Filters: locale, strict, category. Themes/Astro helpers are optional.

Review capability consent and enable intended tools under Eventual → Agent access. Editors need content:edit_any; settings/MCP management need plugins:manage. Schema access is read-only; no outbound hosts.
