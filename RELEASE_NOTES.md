# Zentro Early Access Release Notes (v0.2.0-beta)

## Release Scope
This Early Access cut includes work from commit `1e7db18e28ec96d4de27342aebb4102c801bfb3d` up to `1c16b10`.

## Summary
`v0.2.0-beta` is a major product and platform step focused on:
- Project-first workflow and workspace isolation
- Faster, safer query execution and result exploration
- Stronger editor productivity and SQL assist
- Reliable script persistence and tab recovery
- Architecture hardening and test coverage expansion

## Highlights
- Added full project hub workflow with multi-project sessions, project-aware connection flows, and environment switching stabilization.
- Upgraded query execution with guarded runtime state, deterministic compare behavior, incremental result handling, and export reliability improvements.
- Expanded SQL editor productivity with richer completion metadata, FK join snippets, alias-aware suggestions, scoped format/folding, and keyboard workflow upgrades.
- Improved result panel/table UX with virtualization-focused refinements, stable DnD column identity, sticky index behavior, and clearer edit/action gating.
- Delivered project-scoped Saved Scripts with autosave hardening, reopen-by-id, duplicate prevention, and improved New Query numbering logic.
- Added history-to-editor append behavior, plus shortcut and toolbar refinements across daily workflows.

## What Is New in This Beta

### Project and Workspace
- Introduced project foundation and project hub flows across multiple phases.
- Added project-aware state, session restore, and startup recovery behavior.
- Refactored connection setup to a project-centric model and compact provider-first flows.
- Added project deletion and improved project card/setup status behavior.
- Stabilized environment switch and reconnect behaviors in workspace transitions.

### Query Execution and Results
- Introduced a query runtime state machine with guarded execution paths.
- Added incremental result strategy and result virtualization-focused improvements.
- Added deterministic compare behavior and persistent tab query context.
- Improved export reliability and native save dialog behavior.
- Refined result exploration UX, result panel toolbar controls, and filter interactions.

### Editor and SQL Productivity
- Added SQL completion context optimization and stale cancellation handling.
- Added auto-alias table suggestions with driver-safe quoting.
- Added column data-type display in dot suggestions.
- Added FK-based join snippet suggestions.
- Added styled table suggestion docs and inline picker improvements.
- Added scoped format and SQL clause folding support.
- Added MRU `Ctrl/Cmd+Tab` switcher and `Ctrl+E` context quick open.
- Refined execution shortcuts (`Ctrl/Cmd+Enter`) and execute behavior consistency.

### Saved Scripts and History
- Saved Scripts are now scoped by `project + connection`.
- Reopen behavior now uses `savedScriptId` and focuses existing open tabs instead of duplicating.
- Close flows (`x`, `Ctrl+W`) now autosave before tab removal.
- `Ctrl+S` now triggers save for the current query script tab.
- New query naming now resolves from the max index across open query tabs plus saved scripts in current scope.
- Saved Script deletion now uses a one-click confirmation modal flow.
- Clicking history now appends SQL to the current editor instead of replacing content.

### UI and Interaction Refinements
- Refined toolbar alignment, environment visuals, and status bar simplification.
- Moved editor toolbar to a vertical layout and simplified related actions.
- Improved connection picker, project hub visuals, and modal transitions.
- Refined result-table sizing and sticky index presentation.

## Engineering and Quality
- Large frontend modularization split monolithic stores/components into feature-focused slices.
- Standardized modal system, design tokens, and command boundaries.
- Reduced legacy `any` usage and improved platform boundaries.
- Large backend decomposition split app/query/schema/driver services into modular units.
- Added typed v2 events and stronger backend guardrails.
- Improved cancellation and lifecycle coverage.
- Added and expanded tests across backend query/connection lifecycles and frontend store/session utilities.
- Added telemetry and policy/contribution groundwork for phase completion and release readiness.

## Behavior Changes
- Script visibility is now scoped; scripts outside the active project scope are hidden from the Saved Scripts list.
- New Query naming is monotonic in scope (max index + 1), rather than filling the first missing gap.
- History insertion now appends to the active editor content by default.
