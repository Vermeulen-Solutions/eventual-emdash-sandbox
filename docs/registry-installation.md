## Install and upgrade

Requires EmDash 1.0.1+ with a sandbox runner. Install Eventual from the Registry. Admin users with `plugins:manage` get Events, Venues, Organizers and Settings pages.

Before upgrading, back up the database, media and encryption key. Version 0.11.0 adds organizer storage and an event organizer index. Review the updated storage contract. Existing events remain readable with compatible defaults.

Create one-off or recurring events, choose physical/virtual/hybrid attendance and set their lifecycle status. Meeting URLs must use HTTP or HTTPS. Draft duplication resets publication and schedule history. Admin forms detect stale edits; bulk deletion requires confirmation.

## Agent access and transfer

In Admin → Plugins, expand Eventual and enable Agent access. Review and enable the MCP tools you need, including new organizer and transfer tools.

Exports are paginated. Imports support preview, insert-only writes and retry protection, capped at ten records and 64 KiB per request. They omit settings, media and calendar cancellation tombstones and do not replace a complete site backup.

## Visitor pages

Eventual serves public JSON and iCalendar. The subscription URL is `/_emdash/api/plugins/eventual/calendar`.

Installing the plugin does not create public pages. Adapt the [Astro example](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/tree/main/examples/astro-events), or use the source package's `eventual/astro` helpers and EventList component. Event detail pages can include Schema.org JSON-LD.

## Permissions and privacy

The plugin requests `media:read` and `media:bytes:read` for event images, with no outbound hosts. Events, venues, organizers and cancellations use plugin-owned storage. EmDash offers storage deletion separately during uninstall.

Meeting links appear publicly in feeds, calendars and JSON-LD. Do not store private credentials in these links.
