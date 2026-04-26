---
name: zentro-async-query-execution
description: >
  Cancellable async SQL execution patterns across backend services, Wails facade,
  and frontend state updates.
---

# Skill 03: Async Query Execution

## Purpose

Run SQL without blocking UX while preserving cancellation, timing, and deterministic state.

## Boundary

- Service executes query with context.
- Wails facade exposes thin run/cancel methods.
- Frontend stores manage running/result/error states.

## Mandatory Rules

- Every run has `context.Context` + cancel path.
- Keep select/non-select result contracts explicit.
- Include duration and metadata in response DTO.
- Avoid implicit timeout behavior; make it configurable/documented.

## Verification

- Unit tests for run path, cancel path, timeout path.
- Frontend test for state transition: idle -> running -> success/error/canceled.
