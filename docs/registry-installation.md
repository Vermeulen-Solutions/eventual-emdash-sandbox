## Install Eventual

Install Eventual from the EmDash **Registry** after the site has a supported
sandbox runner configured. The plugin adds **Events**, **Venues**, and
**Settings** pages to the EmDash admin. Use the Events page to create and
publish one-off or recurring events, and the Venues page to manage reusable
addresses.

The event form includes one multiline description field. Plain text works as-is;
optional Markdown adds headings, emphasis, lists, and links without opening a
separate section editor. Existing imported HTML remains unchanged until an
editor replaces it.

Recurring events support an interval and multiple weekly days. Select **Manage
occurrence dates** in the saved editor for Change, Cancel, and Restore actions. To let agents
inspect those dates, enable `eventual__listOccurrences` in EmDash MCP settings
after updating to 0.7.0. Other enabled Eventual tools keep working.

The plugin exposes a public JSON events route and an iCalendar subscription
route. These provide event data; they do not render a calendar or add pages to
the site.

## Show events to site visitors

An Astro site can render its own event list or month view by fetching the JSON
route. A site developer must add that visitor-facing UI to the site project;
the registry plugin does not install a theme component, page, or browser
script.

The iCalendar route can be added to calendar applications that support
subscriptions. Its fixed URL is `/_emdash/api/plugins/eventual/calendar`.

## Permissions and data

Eventual requests `media:read` and `media:bytes:read` so event editors can
select images from the EmDash media library and published event images can be
served to visitors. Events, venues, and calendar cancellation records are kept
in Eventual's plugin-owned storage. Uninstalling the plugin does not
automatically delete those records; EmDash offers storage deletion as a
separate uninstall choice.
