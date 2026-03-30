---
name: zentro-connection-management
description: >
  Guardrails for connection profile lifecycle, secure persistence, and provider-aware
  connection orchestration in Go + Wails.
---

# Skill 02: Connection Management

## Purpose

Manage DB profiles and connection lifecycle with predictable UX and safe backend rules.

## Boundary

- Frontend: collect/edit profile and display status.
- Wails facade: call service methods and map errors to stable DTOs.
- Services/adapters: validate profile, build DSN, open/test connection.

## Mandatory Rules

- Validate before persistence/connection attempt.
- Never return or log plaintext password.
- Use context timeout for test/ping.
- Keep provider-specific DSN logic inside adapter layer.

## Verification

- Tests for validation and DSN mapping.
- Tests for timeout/auth failure handling.
- Manual E2E: create/edit/test/connect/delete profile from UI.
