## 0.14.0

Public reads use old plugin storage only when an administrator enables **Show old events saved inside the plugin** (MCP legacyReads). An unconfigured source reports a clear error; native collections stay authoritative. Disabled legacy images return 404. Settings saves invalidate the read memo. Acceptance restored French weekday labels and refreshed the settings screenshot.

[Release notes](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/blob/main/docs/release-notes-0.14.0.md).

## Earlier releases

- **0.13.4:** replace an oversized Registry screenshot; add media-budget checks.
- **0.13.3:** publicUrls=false skips native canonical-URL lookups; JSON budget failures use the host error contract.
- **0.13.2:** memoize request reads, commit one calendar snapshot, resolve images directly and contain RPC budget failures. Large sources and migration jobs remain limited.
- **0.13.1:** serve featured images through the public plugin route.
- **0.13.0:** breaking native-content change: Portable Text, locale rows, drafts, revisions, saved directories and shared schedules; EmDash >=1.2.0 <2.0.0.

[Full changelog](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/blob/main/CHANGELOG.md). Upgrades from 0.12.x or earlier still need the native-content migration.
