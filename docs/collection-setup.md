# Optional collection setup

Eventual stores events in native EmDash content types. Its sandbox has read-only schema access; creating schemas is a one-time administrator task. The setup tool produces a schema-only seed and never connects to a database or overwrites an output file. It installs no frontend code.

## Start here (no technical knowledge needed)

**What "content type" means:** the place in your EmDash admin where events are listed and edited. A club whose events live there can edit them like any other page.

**Which situation are you in?**

| What you see | What it means | What to do |
| --- | --- | --- |
| Open **Content** in the admin and the events are there; you can edit them | Nothing to do — the site is set up correctly | Leave **Show old events saved inside the plugin** off. Editing happens in **Content**. |
| The calendar on the public site shows events, but you cannot find them anywhere in the admin | Your events are the old ones kept inside Eventual itself (the plugin's own storage, used before 0.13). They cannot be edited there because Eventual no longer writes to it. | Best: choose or create the content type that holds events, then move the old events across (ask whoever set up the site, or see **Moving old events across** below). Quick fix: turn on **Show old events saved inside the plugin** in **Eventual → Settings** so the calendar keeps working exactly as it does today. |
| The public calendar shows nothing and mentions an error | Eventual is not connected to a content type, and old events are not being served either | In **Eventual → Settings**, choose the **Event collection** (or create one), or turn on **Show old events saved inside the plugin** if this site's events still live inside the plugin. |

**What the switch does, in one sentence:** with it **off** (the normal setting), a site that has no event content type refuses to show events and says so clearly; with it **on**, Eventual quietly shows the old events saved inside the plugin — the same behaviour as before version 0.14.

**How to check what a site is using:** open **Eventual → Settings**. The switch shows its current state, and **Eventual → Events** shows either your editable events or the message *"Connect Eventual to content types"* when nothing is connected.

## Moving old events across (needs technical help)

Old events can be **copied** into a content type — nothing is deleted or changed in the old copies. Eventual previews the copy first, then works through it in small batches, and every copied event keeps the same calendar identity, so people who subscribed to the calendar keep their existing entries.

Ask whoever set up your site to run the migration (the steps are in [native-modernization.md](native-modernization.md) and [upgrade-0.13.0.md](upgrade-0.13.0.md)), or hand them the [copyable prompt for an administrator's MCP agent](#copyable-prompt-for-an-administrators-mcp-agent).

Afterwards, open **Eventual → Events**: if the events you can edit are the ones you expect, leave **Show old events saved inside the plugin** off. Turn it on only if you deliberately want the old copies served as well.

## Export the schema

From this source package after `npm run build`, or from an optionally installed source package:

```sh
node scripts/export-native-schema.mjs --locale fr --output eventual-schema.json
# Installed source package:
node node_modules/eventual/scripts/export-native-schema.mjs --locale fr --output eventual-schema.json
```

The installed command is also available as `eventual-schema`. Defaults create events, venues and organizers. Custom names and an existing locations directory:

```sh
node scripts/export-native-schema.mjs --event-collection activities --venue-collection locations --organizer-collection hosts --reuse-venues --locale fr --output eventual-schema.json
```

`--reuse-venues` omits creation of the existing directory. `--reuse-organizers` does the same for organizers. These flags do not alter existing schemas. Reference targets in the event schema still use the chosen slugs. Use distinct lowercase collection slugs. The locale must be a configured canonical locale. The seed locale does not enable new site languages.

## Apply through the host

New installations omit prototype migration IDs/metadata, custom calendar IDs, organizer snapshots, external image URLs and duplicated schedule history. Calendar identity is derived from native translation groups; history remains in EmDash revisions. Categories use one optional comma-separated text field in the main editor, without a duplicate schedule-panel control. Existing JSON-array category schemas remain readable.

The sandbox panel still needs the shared date/time/reference/recurrence/exception fields and localized `occurrence_content` field. Stock EmDash 1.2 renders all declared fields in its main form; the schema exporter cannot hide those fields or create an Advanced section. Do not advertise that limitation as solved by this cleanup.

Only for importing private-storage records from an older prototype, explicitly export with `--legacy-compatibility`. That opt-in includes the migration identity, snapshot and history fields expected by `migrateToNative`; it is not the schema for new sites. The TypeScript equivalent is `legacyCompatibility:true` on each blueprint factory. Reused directories need compatible migration identity fields too. Removing populated old fields requires a reviewed backup and conversion plan; the exporter never alters an existing database.

Inspect the JSON first. On a local SQLite host with EmDash's CLI:

```sh
npx emdash seed eventual-schema.json --validate
npx emdash seed eventual-schema.json --database ./data.db --no-content --on-conflict error
```

Replace the database path with the actual site's database. Do not run this SQLite example against a remote Cloudflare D1 deployment. Use the site's supported schema deployment process or its authenticated core MCP schema tools instead. `--on-conflict error` prevents silently replacing existing collections. For an existing events schema, compare fields and make explicit additive updates; do not recreate collections or convert existing rich text to a plain string.

## Copyable prompt for an administrator's MCP agent

> Configure Eventual's native collections on this EmDash 1.2.x site. Use authenticated core schema tools with administrator/schema-management permission. First call schema_list_collections and inspect existing field definitions. Use the schema-only JSON produced by Eventual's export-native-schema.mjs as the exact blueprint. Desired slugs: events, venues (or existing locations), organizers. If desired names differ, generate the blueprint with those names first. Create missing collections with schema_create_collection; create missing fields with schema_create_field. Preserve blueprint supports, routability, required/default/index/unique flags, validation/options and translatable flags. Do not delete collections, overwrite content, publish entries, migrate legacy data, change site locales, or use historical eventual-editor widget names. Reuse existing directory schemas containing a string name or title. Ensure event venue and organizer_ref references target the chosen directories and are translatable:false. Verify title and description are translatable:true and description is portableText; recurrence/exceptions/date/timezone fields must be translatable:false, occurrence_content translatable:true. Stop and report incompatible existing fields instead of coercing data. Re-read all created fields to verify types, flags and reference targets. Finally call Eventual's settings/update tool with {defaultTimezone:"Europe/Paris",collections:{events:"events",venues:"venues",organizers:"organizers"}} (substitute the actual slugs), or select these through Eventual → Settings. Report changes and unresolved incompatibilities.

Core tool parameter names and available operations must be checked through that site's tool schemas; the JSON is the source of truth, not an abbreviated manually invented field list. The sandbox Eventual tools do not grant schema mutation permission.

## Connect and verify

In Eventual → Settings, select the three collections and save. The settings route validates Portable Text, schedule field types, localization flags and exact reference targets. Selection does not move data. Choose no directory only when the corresponding event reference field is absent. Missing explicitly selected collections fail closed until repaired. A site with no collection configured at all also fails closed: public JSON/ICS reads serve private plugin storage only after an administrator enables **Read legacy events** (0.14.0+).

Create a native draft, enter rich text, save, then open Dates, venue & repeat. Pick a native venue, save schedule changes, reload, and publish through core. Verify the JSON and ICS feeds contain the event only after publication. For localization, create a core translation row and verify shared dates/reference IDs and localized text. Preview any legacy migration separately before executing it.
