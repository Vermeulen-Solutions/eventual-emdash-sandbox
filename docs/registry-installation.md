# Eventual 0.14.0

Requires EmDash **>=1.2.0 <2.0.0**. In **Plugins → Registry**, find Eventual by **vermeulen.solutions**, review permissions and install it. Existing sites use the plugin's update action; review changed MCP tool consent.

Open **Eventual → Settings**, choose compatible event, venue and organizer collections, then **Save settings**. A collection is the place under **Content** where entries are edited. If none exists, ask your site builder to follow [setup](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/blob/main/docs/collection-setup.md). Installation and selection do not create schemas or migrate data.

**Old events:** keep **Show old events saved inside the plugin** off for native collections. Enable it and choose **Save switch** only to serve old plugin data when no native collection is connected. Native collections remain authoritative even while empty; a missing explicitly selected collection must be repaired. See [0.14.0 changes](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/blob/main/docs/release-notes-0.14.0.md).

**Editing:** save the announcement, open **Dates, venue & repeat**, save the changed sections, reload, then publish in EmDash. [Editor guide](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/blob/main/docs/user-guide.md).

**Earlier versions:** upgrading from 0.12.x or earlier needs a backup and [native-content migration](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/blob/main/docs/upgrade-0.13.0.md).

Your site builder connects feeds to visitor pages; Astro examples/helpers are optional. Enable intended agent tools separately under **Agent access**.
