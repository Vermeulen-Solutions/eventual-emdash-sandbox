# Eventual 0.14.0 — old plugin events are shown only when you ask for them

**In one line:** if Eventual cannot find the content type that holds your events, it now says so clearly
instead of quietly showing the old events that are saved inside the plugin itself.

## What you see in the admin

| What you see | What it means | What to do |
| --- | --- | --- |
| **Content → Events** lists your events and you can edit them | The site is set up correctly | Nothing. The switch **Show old events saved inside the plugin** stays off; do not touch it. |
| The public calendar shows events, but they are nowhere in the admin | Those are the old events saved inside Eventual itself (from before version 0.13). They cannot be edited there any more. | Either connect a content type and copy the old events across, or turn the switch on to keep showing them as before. |
| The public calendar shows an error | No content type is connected, and old events are not being served | In **Eventual → Settings**, choose the **Event collection**; if that is not possible yet, turn the switch on when this site's events still live in the plugin. |

**What the switch does, in one sentence:** off (the default) means "if there is no content type, stop and
say so"; on means "show the old events saved inside the plugin exactly like before version 0.14".

The switch lives in **Eventual → Settings**, is visible at all times, and shows its current state. The
same setting is available to automation as `legacyReads` on the MCP tools `getSettings` and
`updateSettings`.

## What changed for the public calendar

| Situation | Before 0.14 | From 0.14 |
| --- | --- | --- |
| A content type holds your events | Events shown from it | Unchanged |
| A content type is *selected* in Eventual but has gone missing | Clear error | Unchanged |
| **No content type at all** | Old events shown, without any language information — a French site shows titles prefixed `[EN]`, and nobody can edit the events in the admin | Clear error, unless the switch is on |

The error names the two ways out, so whoever sees it knows what to do:

> Eventual is not connected to a content type. Choose one under Eventual settings, or turn on "Show old events saved inside the plugin".

## Who is affected

- A site whose events are in a content type (normal installs, including sites that migrated to 0.13 or
  later): **nothing changes**.
- A site that still keeps its events only inside the plugin (typically an install from before 0.13 that
  never migrated): its calendar and feeds stop until an administrator either connects a content type or
  turns the switch on. That is the intended, visible choice — the old behaviour hid the missing setup.
- Even a brand-new site with no content type and no old events now gets the clear error instead of an
  empty calendar; the message points at the setup step.

## Upgrade steps

1. Open **Eventual → Settings**. The switch shows whether old events are being shown.
2. Prefer connecting a content type (**Event collection**) and copying the old events across — the copy
   is previewed first, changes nothing in the old records, and keeps every event's calendar identity.
   Steps for whoever helps with the site: [collection setup](collection-setup.md) and
   [native-modernization.md](native-modernization.md).
3. If migrating is not possible yet, turn the switch on. The calendar behaves exactly as in 0.13.
4. Nothing is deleted, moved or rewritten by this release.

## Notes for developers

- `readEventSource` gates the JSON feed, iCalendar feed and calendar-state reconciliation. The public
  image route also checks the setting before reading legacy storage and returns 404 when disabled.
  Administrative inspection, migration and legacy write tools remain available.
- The setting is read through the same request-scoped memo as the collection bindings, and
  both `updateSettings` and the admin `save-legacy-reads` action clear that memo after a write.
- Fail-closed is the default because a missing content type is a configuration mistake: a loud failure
  is diagnosable in minutes, while the silent fallback produced wrong-language content and an admin
  panel that told editors to connect content types while the site served records they could not edit.
