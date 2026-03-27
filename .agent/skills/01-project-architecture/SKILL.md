---
name: zentro-project-architecture
description: >
  Architecture guardrails for Go + Wails + React + TypeScript: folder structure,
  dependency direction, and ownership boundaries.
---

# Skill 01: Project Architecture

## Purpose

Define clear module boundaries so features are easy to change and safe to extend.

## Canonical Structure

```text
cmd/zentro/main.go
internal/models
internal/adapters
internal/services
internal/app (wails-exposed facade)
frontend/src/{features,components,stores,lib}
```

## Ownership Rules

- `main.go`: composition root and dependency wiring only.
- `models`: shared DTO/value types, no Wails/UI imports.
- `adapters`: DB/provider/OS integration.
- `services`: business workflows using models + adapters.
- `internal/app`: thin facade for Wails bindings.
- `frontend`: render and interaction; business rules in features/stores, not pure view components.

## Dependency Rules

```text
models <- adapters <- services <- app(facade)
frontend -> generated bindings -> app(facade)
```

- Lower backend layers must not import upper layers.
- Frontend must not depend on DB-driver specifics.

## Definition of Done

- Boundary is explicit in package placement and imports.
- Wails facade remains thin.
- New code preserves dependency direction.
