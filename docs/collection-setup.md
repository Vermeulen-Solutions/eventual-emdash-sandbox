# Install and connect Eventual

Eventual **0.14.0** requires EmDash **>=1.2.0 <2.0.0**. Editors can use the [event guide](user-guide.md) once an administrator completes this setup.

## In the EmDash admin

1. Open **Plugins** and browse the **Registry**. Find **Eventual**, published by **vermeulen.solutions**, review its permissions, and install it. Existing installations use the plugin's update action.
2. Open **Eventual → Settings**, select the event and venue/organizer collections, and choose **Save settings**. Selection connects collections; it does not create them or move entries.
3. Create a draft, save it, set its schedule in **Dates, venue & repeat**, and publish it. Check it on your site's calendar.

A **content type/collection** is simply the place under **Content** where entries are listed and edited. If compatible collections are missing, ask your site builder to create them with the blueprint below. Your builder adds visitor pages using Eventual's feeds; the [Astro showcase](../examples/astro-events/README.md) is an optional website design.

## The old-events switch

Leave **Show old events saved inside the plugin** off for native collections. Enable it and choose **Save switch** only to serve old plugin data while no native event collection is connected. It never combines old rows with native events or repairs a missing explicitly selected collection.

To make old entries editable, follow [upgrading and migration](upgrade-0.13.0.md). An empty connected collection may produce an empty calendar; an unconfigured source produces a clear error instead.

## For the site builder

After `npm ci` and `npm run build` in this repository, using Node 24+:

```sh
node scripts/export-native-schema.mjs --locale fr --output eventual-schema.json
```

From an installed source package, use `node node_modules/eventual/scripts/export-native-schema.mjs` with the same options. The exporter writes schema JSON only and refuses to overwrite an output file.

Defaults are `events`, `venues`, and `organizers` (19/8/3 fields). Custom names and directory reuse:

```sh
node scripts/export-native-schema.mjs --event-collection activities --venue-collection locations --reuse-venues --locale fr --output activities-schema.json
```

`--reuse-venues` and `--reuse-organizers` omit existing directories. Use a locale already configured on the site. Inspect and apply the exact blueprint through authenticated EmDash schema tools or the site's supported schema deployment process. Re-read the fields, then select the collections in Eventual Settings. Eventual has read-only schema permission.

For a **new local SQLite** schema, the installed EmDash CLI supports:

```sh
npx emdash seed eventual-schema.json --validate
npx emdash seed eventual-schema.json --database ./data.db --no-content --on-conflict error
```

Use the actual database path. Remote D1 uses the site's remote schema workflow. For populated collections, compare the blueprint and apply reviewed additive changes instead of recreating them.

Preserve Portable Text, shared schedule/reference flags, localized title/description/occurrence copy, and exact reference targets. An event reference requires its corresponding directory selection. Column-backed and relation-bound references differ: keep the exporter's definition intact. See the [developer guide](native-modernization.md).
