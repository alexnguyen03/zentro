---
name: go-wails-sql-client-definition
description: >
  Canonical skill index and design language for Zentro (Go + Wails + React + TypeScript SQL client).
  Read this first to pick the right skill and keep implementation decisions aligned.
---

# Go Wails SQL Client Definition

## Product Direction

- Stack: Go 1.22+, Wails v2, React + TypeScript, database/sql, pgx v5, go-mssqldb.
- Product shape: local-first desktop SQL client for fast and reliable daily querying.
- Priority order: reliability > maintainability > performance > visual polish.
- Design language: explicit, compact, practical; avoid hidden behavior and decorative complexity.

## Core Philosophy

- Keep boundaries explicit: frontend, binding facade, application services, adapters, models.
- Keep abstractions earned: add interfaces only for real variation or test seams.
- Keep behavior observable: contextual errors, structured logs, deterministic state transitions.
- Keep changes local: one feature should mostly touch one ownership boundary.
- Keep extension points intentional: modularity where real long-term variability exists.

## Dependency Direction

```text
models <- adapters <- services <- wails facade <- frontend
utils can be shared but must not become a god package
```

## Skill Map

| # | Skill | Use When |
|---|---|---|
| [01](../01-project-architecture/SKILL.md) | Project Architecture | Defining folders, boundaries, import rules |
| [02](../02-connection-management/SKILL.md) | Connection Management | Working with profiles, connect/test/open flows |
| [03](../03-async-query-execution/SKILL.md) | Async Query Execution | Running/canceling SQL safely with context |
| [04](../04-multi-tab-editor/SKILL.md) | Multi-Tab Editor | Managing tab lifecycle and editor state |
| [05](../05-result-grid/SKILL.md) | Result Grid | Rendering, paging, editing, and selection |
| [06](../06-ui-layout-app-state/SKILL.md) | UI Layout and App State | Shell composition and state ownership |
| [07](../07-export-and-history/SKILL.md) | Export and History | CSV export and query history retention |
| [08](../08-preferences-settings/SKILL.md) | Preferences and Settings | Keys, defaults, migration-safe settings |
| [09](../09-logging/SKILL.md) | Logging | Structured observability and error context |
| [10](../10-cross-platform-build/SKILL.md) | Cross-Platform Build | Packaging and release workflows |
| [11](../11-zentro-framework-builder/SKILL.md) | Framework Builder | Designing extension points and modular growth |
| [12](../12-zentro-design-patterns-enforcer/SKILL.md) | Patterns Enforcer | Choosing minimal patterns with clear tradeoffs |
| [13](../13-commit/SKILL.md) | Commit Convention | Writing clear conventional commits |
| [14](../14-flow/SKILL.md) | Delivery Flow | Planning and shipping in safe increments |
| [15](../15-frontend-design/SKILL.md) | Frontend Design | React desktop UI language and interaction design |
| [16](../16-maintainability-flexibility-extensibility/SKILL.md) | Maintainability Guardrails | Architecture and change-quality gate |

