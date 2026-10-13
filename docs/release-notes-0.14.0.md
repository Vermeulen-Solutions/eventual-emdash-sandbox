# Eventual 0.14.0 — legacy public reads are opt-in

## What changes

Until 0.13.x, a site without a configured event collection silently fell back to Eventual's private
plugin storage: the pre-0.13 event records. That storage has no locale rows, so a request for a
locale that the records never carried is answered by the non-strict fallback — a title prefixed with
the record's assumed locale (`[EN] …` on a French site). The admin panel meanwhile says
"Connect Eventual to content types", so editors cannot see or fix the events while the public site
keeps serving them.

0.14.0 makes that fallback explicit:

| Situation | Before | Now |
| --- | --- | --- |
| Configured collection exists | Native records | Native records (unchanged) |
| Configured collection is missing | Hard error (`The selected event collection is missing.`) | Unchanged |
| **No collection configured and none named `events`** | Legacy records served, wrong locale labels | **Error**: `No Eventual event collection is configured. Choose one in Eventual settings, or enable legacy reads to serve the pre-0.13 plugin data.` |

Enable **Read legacy events** in Eventual settings → the previous behaviour returns. The same flag is
available through MCP as `legacyReads` on `getSettings` / `updateSettings`.

## Who is affected

- **Sites with a configured (or default `events`) collection:** nothing changes. The flag is not read
  on that path.
- **Sites still on private plugin storage only:** the public JSON feed, the calendar feed and the
  calendar-state reconciliation stop answering until an administrator either selects a collection or
  turns the flag on. Migration tooling, the MCP legacy write tools and admin listing are unaffected —
  they exist for exactly this transition.

## Upgrade

1. Check the state: Eventual settings → **Settings** shows the collection selects and the new
   **Read legacy events** toggle; MCP `getSettings` returns `legacyReads`.
2. Preferred: choose the native collections (see
   [collection-setup.md](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/blob/main/docs/collection-setup.md))
   and migrate with `migrateToNative`, which retains legacy data.
3. Interim: turn **Read legacy events** on. Feeds keep working exactly as before, including the
   locale-prefixed titles; this is a deliberate, visible choice rather than a silent fallback.
4. Nothing is deleted or rewritten by this release.

## Design notes

- The gate lives in `readEventSource`, so it covers every public consumer (`publicEvents`, the
  calendar feed and the calendar reconciliation) and nothing else. MCP/admin paths read storage
  directly and are unchanged.
- The flag is read through the same request-scoped memo as the collection bindings, and
  `updateSettings` clears the memo after a write so the response reports the new value.
- Fail-closed is the default because a missing collection is a configuration error: a loud failure is
  diagnosable in minutes, while the silent fallback produced wrong-locale content and an unusable
  editor without any signal. Sites that need the old behaviour keep it with one documented toggle.
