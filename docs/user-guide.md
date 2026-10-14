# Managing events

Use this guide once Eventual is connected to your site's event collection. A **collection** is the list of entries under **Content** in EmDash. Its name may be Events, Activities, or a name chosen for your site. For installation, see [setup](collection-setup.md).

## Create and publish

1. Open **Eventual → Events** and choose **Create event**, or open your collection under **Content**.
2. Write the title and description, choose an image, and save the draft.
3. Open **Dates, venue & repeat**. Under **When**, enter dates and times and choose the event's time zone. For all-day events, the end date is the **last day included**.
4. Under **Where**, choose a saved venue or organizer. Online meeting links belong in the main event form.
5. Save each panel section you change, reload the editor, review the announcement and schedule, then choose **Publish** in EmDash.

Panel saves update a draft; publication makes it visible to visitors. Save announcement changes before using the panel. New events must be saved before their panel can work.

Some schedule, reference and JSON fields also appear in EmDash's main form. Use the panel for repeat schedules and individual-date changes; you do not need to write JSON.

## Repeat or change one date

Under **Repeat**, choose daily, weekly or monthly, set the interval, and choose the **Last repeat date**. Weekly schedules can use several weekdays; monthly schedules can use a day number or a weekday position, such as the second Tuesday. Save, reload, and publish.

Under **Individual dates**, display the period you need, then cancel, restore, reschedule, or change the announcement for one date. The inspector shows a 90-day window; move it to see other dates. These changes also need publication.

To reuse an announcement, choose **Duplicate** in Eventual's event list. The copy starts as a draft.

## Venues, organizers and languages

**Eventual → Venues** and **Organizers** link to their collections. Create and publish referenced entries before publishing an event that uses them. Published meeting/contact URLs appear in public feeds; use links intended for visitors.

Use EmDash's translation controls for other languages. Each language has its own title, description and individual-date announcement. Published schedules and venue/organizer selections are shared across translations. Your site's translation service is a separate choice.

## When the calendar looks wrong

| What you see | What to do |
| --- | --- |
| An event is missing | Check publication, displayed dates, language/category filters and publication of referenced venues/organizers. |
| An empty calendar | No published events may match. A connected collection stays authoritative even while empty. |
| “Connect Eventual to content types” or a feed error | Ask an administrator to select compatible collections in **Eventual → Settings**. A disappeared selected collection must be restored or reconnected. |
| You need events stored inside an older plugin | An administrator can enable **Show old events saved inside the plugin**, then choose **Save switch**. This permits old data only when no native event collection is connected. Prefer the [upgrade path](upgrade-0.13.0.md) to make those entries editable. |

An **Add to calendar** download copies one event. A **subscription** lets the calendar app fetch updates; refresh timing depends on that app. Public feeds may be cached for up to five minutes. If the website calendar or subscription stays wrong after publication, ask your administrator to check the feed.
