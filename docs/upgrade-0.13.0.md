# Upgrade to Eventual 0.14.0

## From 0.13.x

Update Eventual in EmDash's plugin administration and review tool-consent changes. Native collections need no schema migration for 0.14.0. Keep **Show old events saved inside the plugin** off when native events are connected. Verify a published event, its image, and the JSON/calendar feeds. See the [0.14.0 changes](release-notes-0.14.0.md).

Sites without a native event collection now receive a setup error unless an administrator explicitly enables the old-events switch. That switch does not make old records editable or repair a disappeared explicitly selected collection.

## From 0.12.x or earlier — site-builder work

The native-content change introduced in 0.13.0 is a breaking upgrade. Back up the CMS/database, media, configuration, drafts and calendar state; rehearse on a copy of the site. Eventual's record export is not a complete backup.

1. Prepare EmDash **>=1.2.0 <2.0.0** and its sandbox runner. Remove historical `eventual/install`, `eventual/admin` and source-transform editor adapters targeting EmDash 1.0.1. Registry installations use one Registry backend; optional Astro helpers are separate site code.
2. Compare existing schemas with [setup](collection-setup.md). Preserve rich text, locale flags, reference targets/edges, and populated migration/calendar identity. A blueprint does not upgrade stored rows or revisions.
3. For legacy migration, export with **`--legacy-compatibility`**. The clean new-site blueprint omits migration identity/snapshot fields. Reused directories also need compatible fields.
4. Preview `migrateToNative` with `{"dryRun":true,"locale":"fr","limit":1}`. Review all results and preview cursors. Execute after review and follow the execution's own `nextCursor`; a preview cursor is not an execution checkpoint. Legacy records remain intact. Organizer directories and manual legacy translations may need separate preparation.
5. Connect the collections and check migrated entries, drafts, translations, recurrence, cancellation/restoration and existing subscriber UIDs before production.

A native collection becomes authoritative even while empty; coordinate schema creation, migration and source activation. The migrator defaults to 25 items and accepts 1–100, but those bounds do **not** guarantee a batch fits deployed RPC/CPU limits. Cloudflare and large migrations need a tested, host-appropriate plan; smaller batches alone may not resolve the limit.

Retain the backup until acceptance. Rollback may require matching host, schema, database and calendar state; reconcile later edits before restoring a database. Earlier implementation details are in [Git history](history.md).
