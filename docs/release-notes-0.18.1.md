# Eventual RSVP – Core 0.18.1 — on npm

- **On npm**: the optional Astro, schema and transfer helpers are published as [`@vermeulen.solutions/eventual`](https://www.npmjs.com/package/@vermeulen.solutions/eventual). Site builders install them with `npm install @vermeulen.solutions/eventual@0.18.1` instead of downloading a source archive from GitHub.
- **New import paths**: `eventual/astro` becomes `@vermeulen.solutions/eventual/astro`, and likewise for `/schema`, `/transfer`, `/install`, `/admin` and `/astro/EventList.astro`. The schema exporter is `node_modules/@vermeulen.solutions/eventual/scripts/export-native-schema.mjs` (or `npx eventual-schema`).
- **Nothing changes for administrators**: the plugin ID stays `eventual`, so Registry installations update in place and routes, data, settings and permissions are unchanged.
- **Language packs** come from `@vermeulen.solutions/eventual-locales` 0.1.10. Core's own dictionaries are unchanged.
- **Compatibility**: EmDash `>=1.2.0 <2.0.0` (tested on EmDash 1.4.0). No schema changes and no new MCP tools.
