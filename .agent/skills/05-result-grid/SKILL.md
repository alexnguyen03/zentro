---
name: zentro-result-grid
description: >
  Rules for result rendering, type fidelity, paging, and edit workflows in React-based grids.
---

# Skill 05: Result Grid

## Purpose

Render large SQL results clearly and performantly with predictable editing/export behavior.

## Boundary

- Backend returns typed row/column DTOs.
- Frontend grid handles display formatting and interaction state.
- Commit/update actions flow through service contracts.

## Mandatory Rules

- Preserve column order and value fidelity.
- Keep display formatting separate from raw values.
- Track pending edits explicitly.
- Make virtualization/pagination strategy explicit.

## Verification

- Tests for formatting and edit tracking.
- Manual check on large mixed-type datasets.
