# `features/editor`

This folder owns **editor domain orchestration**.

## What belongs here

- Feature-level hooks/components that coordinate editor domain flows.
- Query execution and cancel flow wiring.
- Tab/group management orchestration.
- Monaco editor domain integration such as SQL autocompletion setup.

## Current files

- `QueryTabs.tsx`: global query/result orchestration and tab-group DnD coordination.
- `QueryGroup.tsx`: per-group tab lifecycle and run/cancel/save orchestration.
- `MonacoEditor.tsx`: editor runtime behavior and context-aware completion registration.

## Boundary with `components/editor`

- `components/editor` is the rendering layer.
- `features/editor` composes rendering components and owns business logic decisions for editor workflows.
