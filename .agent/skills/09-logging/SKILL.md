---
name: zentro-logging
description: >
  Structured logging and observability conventions for Go services/facade and
  actionable diagnostics in desktop runtime.
---

# Skill 09: Logging

## Purpose

Provide low-noise, context-rich logs for debugging and operations.

## Mandatory Rules

- Structured logs with operation, duration, connection/profile, and error kind.
- Redact secrets and sensitive payloads.
- Avoid duplicate multi-layer logging of the same error.
- Map backend errors to stable frontend-facing messages.

## Verification

- Unit tests for redaction.
- Smoke test with forced failures to verify context quality.
