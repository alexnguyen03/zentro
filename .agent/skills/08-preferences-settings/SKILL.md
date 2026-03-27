---
name: zentro-preferences-settings
description: >
  Standardized preference keys, defaults, and migration-safe settings behavior for
  Wails backend + React frontend.
---

# Skill 08: Preferences and Settings

## Purpose

Ensure settings are stable, validated, and backward-compatible across releases.

## Boundary

- Backend owns read/write persistence and migration.
- Frontend owns settings UI and validation hints.

## Mandatory Rules

- Define all keys in one place.
- Always apply fallback defaults.
- Validate before save.
- Document migration when key semantics change.

## Verification

- Tests for defaults and invalid-value fallback.
- Manual restart test to confirm persisted behavior.
