# Eventual 0.9.2

Status: prepared and validated on 2026-09-29; ready to publish.

## Event editor guidance

- Add a prominent **Save your changes** or **Create your event** banner near
  the top of the editor so users know how to submit a long form.
- Keep the instruction accurate for standard EmDash sandbox pages, where the
  form submit button appears at the bottom of the form.

## Compatibility

This patch release keeps the Eventual 0.9.1 compatibility requirements and
storage format. It requires EmDash 1.0.1 or newer. No migration is required.

## Verification

Manifest validation, typecheck, focused editor tests, and bundle validation
pass. The focused plugin test file contains 22 passing tests.
