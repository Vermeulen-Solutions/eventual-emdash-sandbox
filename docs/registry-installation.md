## Install Eventual

Install the plugin from the EmDash **Registry** after configuring a supported
sandbox runner. Eventual adds **Events**, **Venues**, and **Settings** pages to
the admin. EmDash 1.0.1 or newer is required. Users with `plugins:manage` can
create and publish one-off or recurring events, reuse saved venues, and write
plain text or Markdown descriptions.

The Events page provides Edit, Duplicate, and Delete actions. Select up to 25
events on the current page and choose **Delete selected** for a confirmed bulk
delete. Saving returns to the Events list, and **Back to events** leaves the
editor without saving.

## Manage events with agents

Enable Eventual's MCP tools in EmDash under **Admin → Plugins → Plugin manager
→ Eventual → Agent access**. The tools manage events, recurrence exceptions,
venues, and the default timezone. Updating to 0.7.0 or later adds the
read-only `eventual__listOccurrences` tool; enable it separately in MCP
settings.

## Show events to visitors

Eventual provides public JSON and iCalendar feeds. The repository also includes
a [server-rendered Astro example](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/tree/main/examples/astro-events)
with list, timeline, cards, daily schedule, date strip, month calendar,
location, detail, and individual calendar-download views. Copy and adapt it in
the site's Astro project; installing Eventual alone does not create visitor
pages or frontend code. For a smaller integration, install the source package
and import `eventual/astro` or `eventual/astro/EventList.astro`.

The site-wide iCalendar subscription URL is
`/_emdash/api/plugins/eventual/calendar`.

## Permissions and data

Eventual requests `media:read` and `media:bytes:read` for media-library event
images. Events, venues, and cancellation records use plugin-owned storage.
Uninstalling does not delete these records automatically; EmDash presents
storage deletion as a separate uninstall choice.
