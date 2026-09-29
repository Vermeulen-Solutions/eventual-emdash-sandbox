# Eventual 0.9.1

Status: prepared and validated on 2026-09-29; ready to publish.

## Agent access guidance

- Correct the registry installation instructions to match the current EmDash
  plugin manager: open **Admin → Plugins**, click the arrow next to **Eventual**
  to expand its details, then toggle the **Agent access** switch.
- Update the same guidance in the Eventual event editor's admin hint.

## Compatibility

This patch release keeps the Eventual 0.9.0 compatibility requirements and
storage format. It requires EmDash 1.0.1 or newer. No migration is required.

## Verification

Manifest validation, typecheck, and the full test suite pass: 85 tests in 11
files.
