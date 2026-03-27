---
name: zentro-multi-tab-editor
description: >
  Query tab lifecycle and state-isolation rules for React/TypeScript editor workflows.
---

# Skill 04: Multi-Tab Editor

## Purpose

Support multi-context querying with isolated per-tab state and predictable close behavior.

## Boundary

- Store owns tab state and lifecycle.
- Editor components render state and emit intents.
- Query run/cancel always scoped to active tab.

## Mandatory Rules

- One isolated state object per tab.
- Unsaved-change confirmation before close.
- Running query close policy must be explicit.
- Keyboard shortcuts centralized, not scattered across components.

## Verification

- Tests for create/select/close/restore behavior.
- Manual check for Ctrl/Cmd+Enter and cancel on active tab only.
