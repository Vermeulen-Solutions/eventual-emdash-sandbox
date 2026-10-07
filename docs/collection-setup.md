# Optional collection setup

Eventual stores events in native EmDash content types. Its sandbox has read-only schema access; creating schemas is a one-time administrator task. The setup tool produces a schema-only seed and never connects to a database or overwrites an output file. It installs no frontend code.

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

In Eventual → Settings, select the three collections and save. The settings route validates Portable Text, schedule field types, localization flags and exact reference targets. Selection does not move data. Choose no directory only when the corresponding event reference field is absent. Missing explicitly selected collections fail closed until repaired.

Create a native draft, enter rich text, save, then open Dates, venue & repeat. Pick a native venue, save schedule changes, reload, and publish through core. Verify the JSON and ICS feeds contain the event only after publication. For localization, create a core translation row and verify shared dates/reference IDs and localized text. Preview any legacy migration separately before executing it.
