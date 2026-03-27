---
name: zentro-export-and-history
description: >
  Guardrails for CSV export and query-history retention with stable schema and low coupling.
---

# Skill 07: Export and History

## Purpose

Provide reliable export and actionable query history without leaking UI internals into persistence.

## Boundary

- Services produce export/history DTOs.
- Facade exposes simple export/history APIs.
- Frontend triggers actions and renders history.

## Mandatory Rules

- Export must preserve header order and escaping rules.
- History entry must include query, time, profile, duration, status.
- Retention policy must be explicit.

## Verification

- Tests for CSV correctness and history trimming.
- Manual check for export from filtered/edited view.
