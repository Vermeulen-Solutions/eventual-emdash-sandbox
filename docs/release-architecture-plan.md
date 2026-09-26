# Eventual 0.6.0 architecture plan

## Scope and boundaries

All changes belong to this sandbox plugin repository. `C:\dev\eventual` is a read-only behavioral reference. Keep the Astro visitor calendar in the consuming site; the EmDash dashboard widget is editor-only.

## Module boundaries

- `src/domain/`: event schemas, validation, date/time conversion, recurrence and exceptions, venues, categories, and normalized public occurrence formatting.
- `src/storage.ts`: typed access to the declared EmDash plugin collections and cancellation tombstones.
- `src/admin.ts`: Block Kit admin pages and widget response, preserving current route behavior.
- `src/mcp.ts`: compact Zod tool schemas and private JSON route/tool declarations; delegate operations to domain/storage helpers.
- `src/routes/`: public JSON, iCalendar, and image endpoints and response formatting; preserve their current route contract.
- `tests/`: focused validation of MCP routes, recurrence/exception safeguards, dashboard response states, and time zone behavior.

## MCP contract

Expose only documented sandbox routes referenced by `mcp.tools`. Keep every tool private and permissioned, validate route input at the boundary, return small normalized JSON results, and mark delete/overwrite operations destructive. Event mutations must use existing date/time and recurrence domain logic and preserve cancellation tombstones. No raw route is exposed as a tool.

## Dashboard widget

Declare a single compact `upcoming-events` widget. Render a short list of upcoming published events with local date/time and venue/location, a useful empty state, and a link to Eventual's Events admin page. Use Block Kit only; do not add public calendar UI.

## Release path

Audit existing behavior against the older implementation, current EmDash documentation, and tests; implement focused fixes without breaking public routes or ordinary one-off events. Measure `backend.js` and full package after substantial changes, run requested validation, bump version based on the trust-contract change, commit in logical units, push the feature branch, then publish only after validation succeeds.
