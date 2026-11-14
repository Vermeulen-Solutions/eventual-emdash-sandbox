# Eventual RSVP – Core 0.18.1

Requires EmDash **>=1.2.0 <2.0.0** for event management. **1.4.0 is recommended** for nested forms and Cloudflare plugin mutations, and required for the optional cache integration.

In **Plugins → Registry**, find **Eventual RSVP – Core** by **vermeulen.solutions**, review permissions and install or update. Version 0.18.1 asks for no new permissions; since 0.18.0 Core uses `network:request` to `cdn.jsdelivr.net` for the admin's language packs. It adds no MCP tools. Enable intended tools separately under **Agent access**.

Open **Event settings**, select compatible event, venue and organizer collections, then **Save settings**. Installation does not create schemas or migrate content. Site builders: [collection setup](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/blob/main/docs/collection-setup.md).

Save an announcement, open **Dates, venue & repeat**, save changed sections, reload, then publish in EmDash. [Editor guide](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/blob/main/docs/user-guide.md).

Keep **Show old events saved inside the plugin** off for native collections. Enable it only to serve legacy plugin data without a connected collection. Upgrades from 0.12.x or earlier need a backup and [native migration](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/blob/main/docs/upgrade-0.13.0.md).

Your site builder connects visitor pages, optionally with the npm helpers `@vermeulen.solutions/eventual` at the same version. **Caching stays opt-in**: Core supplies dependencies and a maximum 15-second expiry, not site-wide cache rules. Use matching source helpers, explicit eligibility and no stale serving. Read the [integration guide and host limitations](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/blob/main/docs/public-feed-caching.md) before enabling it.
