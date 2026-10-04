# Eventual 0.11.0

Eventual adds physical, virtual and hybrid attendance and explicit event lifecycle states. HTTP(S) meeting URLs are validated across admin, MCP and storage transformations. Calendar output and Astro JSON-LD reflect attendance and cancellation/postponement/rescheduling, with safe HTML serialization.

Saved organizers and structured addresses flow through admin, MCP and public responses. Draft duplication resets publication and schedule history. History retains ten prior series schedules; moved occurrences expose their original start, while whole-series rescheduling does not automatically map each occurrence to its former date.

Data transfer provides paginated exports and previewable, insert-only imports capped at ten records and 64 KiB per request. Retry keys prevent duplicate replay. Host-side CSV and limited ICS conversion stay outside the sandbox archive. Unsupported recurrence/timezone constructs are rejected explicitly.

## Upgrade and privacy

Requires EmDash 1.0.1 or newer. Existing events remain readable through defaults; the storage contract adds an organizers collection and organizerId event index. Back up the site's database, media and encryption key before upgrading. Review EmDash's storage declaration changes and enable only the new MCP tools you want agents to use.

Meeting links are intentionally public in JSON, calendars and JSON-LD. Do not enter private meeting credentials. Transfer exports omit settings, media and calendar cancellation tombstones; use a complete CMS backup for recovery.

The manifest documentation recommends a major version for broadened trust contracts. This approved pre-1.0 iteration is prepared as 0.11.0 with its additive storage changes explicitly disclosed; it requests no new capabilities or outbound hosts. Registry approval and an actual registry-installed upgrade still need verification before calling the release installable.

## Deferred work

- [Sandbox-safe extensions](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/issues/1): RSVP, private access, full recurrence conversion, measured indexing/cache work and complete restore.
- [Calendar SEQUENCE migration](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/issues/2): replace the existing millisecond revision values without breaking subscriber updates.
- [Test-stack maintenance](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/issues/3): retire the Windows runner workaround and upgrade pinned tooling dependencies.

These are not included in this release. In particular, the existing iCalendar SEQUENCE limitation remains open.
