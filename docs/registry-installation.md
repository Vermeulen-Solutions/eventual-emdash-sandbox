## Install Eventual

Install the plugin from the EmDash **Registry** after configuring a supported
sandbox runner. Eventual adds **Events**, **Venues**, and **Settings** pages to
the admin. Editors can create and publish one-off or recurring events, reuse
saved venues, and write plain text or Markdown descriptions.

## Manage events with agents

Administrators can enable Eventual's MCP tools in EmDash under **Admin →
Plugins → Plugin manager → Eventual → Agent access**. The tools manage events,
recurrence exceptions, venues, and the default timezone. Updating to 0.7.0 or
later adds the read-only `eventual__listOccurrences` tool; enable it separately
in MCP settings.

## Show events to visitors

Eventual provides public JSON and iCalendar feeds. The repository also includes
a [server-rendered Astro frontend example](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/tree/main/examples/astro-events)
with seven visitor views: list, timeline, cards, daily schedule, date strip,
month calendar, and locations. It includes event details, individual calendar
downloads, category filters, and safe Markdown rendering, without a calendar
library. Copy and adapt the example in the site's Astro project; installing
Eventual alone does not create visitor pages or install frontend code.

The site-wide iCalendar subscription URL is
`/_emdash/api/plugins/eventual/calendar`.

## Permissions and data

Eventual requests `media:read` and `media:bytes:read` for media-library event
images. Events, venues, and cancellation records use plugin-owned storage.
Uninstalling does not delete these records automatically; EmDash presents
storage deletion as a separate uninstall choice.
