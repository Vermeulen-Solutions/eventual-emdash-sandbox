# Eventual 0.14.0

Released 14 October 2026. Requires EmDash **>=1.2.0 <2.0.0**.

## The change

When no native event collection is connected, public reads now report a setup problem instead of automatically showing old events stored inside the plugin. Those copies can lack language information and appear with an unexpected `[EN]` title prefix.

| Your site | What to do |
| --- | --- |
| Events are editable in an EmDash collection | Update normally; keep **Show old events saved inside the plugin** off. |
| Events remain only in old plugin storage | Prefer [copying them into a collection](upgrade-0.13.0.md). Temporarily, enable the switch in **Eventual → Settings**, then choose **Save switch**. |
| A selected collection has disappeared | Restore or reconnect it. The switch does not override a broken explicit selection. |

Native collections remain authoritative even while empty. The switch neither merges both sources nor makes legacy rows editable.

The unconfigured-feed error is:

> Eventual is not connected to a content type. Choose one under Eventual settings, or turn on "Show old events saved inside the plugin".

## For administrators and developers

Existing 0.13.x native schemas need no migration. Earlier versions require the [native-content upgrade](upgrade-0.13.0.md). Review changed MCP tool consent; installation does not enable agent access.

The setting is `legacyReads` in `getSettings`/`updateSettings`; the admin action is `save-legacy-reads`. Stored values enable reads only when strictly boolean `true`, and both save paths invalidate the request memo. The gate covers JSON, calendar reconciliation and subscriptions; disabled legacy images return 404. Administrative inspection, migration and legacy write tools retain their existing permissions.

Acceptance restored French weekday labels and refreshed the settings screenshot. See [using Eventual](user-guide.md), [developer integration](native-modernization.md) and the [release evidence](../audit/releases/0.14.0/README.md).
