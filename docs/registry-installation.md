# Eventual 0.14.0

Requires EmDash >=1.2.0 <2.0.0. Update in EmDash plugin administration. No new capabilities, schemas or permissions are required.

**What changes:** when Eventual cannot find the content type that holds your events, the public calendar now says so clearly instead of quietly showing the old events saved inside the plugin. Those old copies carry no language information, so a French site showed titles prefixed `[EN]` while the admin panel offered no way to edit them.

**If that is your site:** open **Eventual → Settings**. Connect the content type that holds events, or turn on **Show old events saved inside the plugin** to keep serving the old copies exactly as before. The switch is visible at all times and shows its current state; [collection setup](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/blob/main/docs/collection-setup.md) explains the choices without technical steps. Sites whose events already live in a content type see no change at all.

Read the [release notes](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/blob/main/docs/release-notes-0.14.0.md) for the before/after table and upgrade steps.

**Upgrading from 0.12.x or earlier is breaking:** back up and follow the [upgrade guide](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/blob/main/docs/upgrade-0.13.0.md). An update does not create schemas or migrate data. Preserve calendar and migration identity.

An administrator must create/review compatible native collections with the optional exporter or the [setup guide](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/blob/main/docs/collection-setup.md), then select event, venue and organizer collections under Eventual → Settings. Custom collection names are supported.

No Eventual frontend companion or second runtime package is required. Themes and Astro helpers are optional.
