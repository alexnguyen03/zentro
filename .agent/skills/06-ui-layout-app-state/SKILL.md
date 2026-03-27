---
name: zentro-ui-layout-app-state
description: >
  Shell composition and app-state ownership rules for Wails + React desktop UX.
---

# Skill 06: UI Layout and App State

## Purpose

Keep shell behavior predictable by separating global session state from feature-local state.

## Boundary

- Global app store: session, active connection, global settings, notifications.
- Feature stores: editor tabs, query results, history panel, etc.
- Components should consume state and dispatch intents, not own workflow logic.

## Mandatory Rules

- Single source of truth per state domain.
- Derived UI state should be computed, not duplicated.
- Wails events/state sync points must be explicit.

## Verification

- Tests for key selectors/state transitions.
- Manual check for app boot and reconnect flow.
