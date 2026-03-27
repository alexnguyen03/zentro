---
name: zentro-framework-builder
description: >
  Guidance for evolving Zentro as a modular Wails application with explicit extension points.
---

# Skill 11: Zentro Framework Builder

## Purpose

Enable extensibility where needed while keeping core implementation simple and maintainable.

## Mandatory Rules

- Start as modular monolith; avoid premature plugin-runtime complexity.
- Define extension contracts from consumer needs.
- Keep core functional with built-in defaults.
- Version extension interfaces when exposed across modules.

## Verification

- At least one real replacement implementation per new contract.
- Tests prove replacement without core edits.
