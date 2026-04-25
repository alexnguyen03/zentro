# `components/editor`

This folder owns **presentational editor UI**.

## What belongs here

- Reusable rendering components for editor screens and panels.
- UI-only behavior (focus, local view state, DOM interactions, styling).
- Components that receive callbacks/data from feature-layer orchestrators.

## What does not belong here

- Query execution orchestration.
- Tab/group lifecycle management.
- Monaco autocompletion registration or domain-specific editor logic.
- Backend command coordination.

## Boundary with `features/editor`

- `features/editor` composes these components and owns editor domain workflows.
- `components/editor` should remain usable as UI building blocks with minimal domain coupling.
