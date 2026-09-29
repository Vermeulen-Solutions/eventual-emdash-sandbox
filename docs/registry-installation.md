## Install Eventual

Install the plugin from the EmDash **Registry** after configuring a sandbox
runner. Eventual adds **Events**, **Venues**, and **Settings** pages to the
admin. It requires EmDash 1.0.1 or newer. Users with `plugins:manage` can
manage one-off and recurring events.

The Events page provides Edit, Duplicate, and Delete actions. Select up to 25
events on the current page and choose **Delete selected** for a confirmed bulk
delete. Saving returns to the Events list, and **Back to events** leaves the
editor without saving.

Settings default admin time displays to 24-hour. The 12-hour option affects the
admin event list and dashboard widget only; stored values, public feeds, MCP,
and the consuming site's frontend are unchanged.

## Manage events with agents

Enable Eventual's MCP tools in EmDash under **Admin → Plugins → Plugin manager
→ Eventual → Agent access**. They manage events, exceptions, venues, and the
default timezone. Enable `eventual__listOccurrences` separately in MCP
settings.

## Show events to visitors

Eventual provides public JSON and iCalendar feeds. The repository also includes
a [server-rendered Astro example](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/tree/main/examples/astro-events).
Copy and adapt it in the site's Astro project; installing Eventual alone does
not create visitor pages. For a smaller integration, install the source
package and import `eventual/astro` or `eventual/astro/EventList.astro`.

The site-wide iCalendar subscription URL is
`/_emdash/api/plugins/eventual/calendar`.

## Permissions and data

Eventual requests `media:read` and `media:bytes:read` for event images. Events,
venues, and cancellations use plugin-owned storage; EmDash presents storage
deletion as a separate uninstall choice.
