# Zentro Release Notes (v0.3.0)

## Release Scope
This release rolls up the full product line from `v0.2.0-beta` to `v0.3.0`, including the final cross-platform packaging pass for Windows, macOS, and Linux.

## Summary
`v0.3.0` turns the Early Access baseline into the first stable `0.3.x` release, carrying forward everything introduced in `v0.2.0-beta` and adding stronger search, schema workflows, source control tooling, UI cleanup, and release packaging.

## Highlights
- Added universal saved-script search in Context Search with `#` prefix.
- Added matched-line search results with click-to-jump line navigation.
- Strengthened ResultTable reliability with modularized hooks and safer rerun/filter synchronization.
- Expanded table constraints and foreign key CRUD workflows in Table Info.
- Improved SQL-oriented Git tracking with timeline, manual commit, and diff workflows.
- Continued broad UI modernization and guardrail/performance hardening.

## What Is New in v0.3.0

### SQL Editor, Search & Productivity
- Universal script search via `#` in Context Search.
- Matched-line display and direct jump-to-line behavior.
- Saved scripts preview improvements with hover card UX.
- Better multi-result labels and SQL helper actions (insert/update/copy utilities, definition navigation).

### Result Grid & Data Workflows
- Refactored and modularized `ResultTable` and related hooks.
- Improved filtering and order-by builder flows.
- Added richer result context actions (`Copy Cell`, `Copy with Headers`, `Copy as JSON`, SQL copy helpers).
- Fixed dirty-cell edge cases and post-rerun synchronization issues.

### Schema Explorer & Table Info
- Unified key/constraint workflows in Table Info.
- Added full foreign key CRUD flow.
- Extended explorer context menu operations (drop/truncate/export).
- Improved DDL and index operation correctness across drivers.

### Source Control & Project Safety
- Added SQL-oriented Git timeline and manual commit capabilities.
- Added close-flush/exit commit hardening for project source control.
- Hardened write-safety confirmations for high-risk environments.

### UI System, Architecture & Stability
- Migrated major frontend surfaces to shadcn/radix primitives.
- Improved design token consistency across toolbar/sidebar/settings/project hub.
- Continued decomposition of large frontend modules into focused units.
- Fixed multiple guardrail, accessibility, lifecycle, and performance issues (including Monaco stability).

### Packaging & Distribution
- Added Windows NSIS installer output to the official release assets.
- Standardized release packaging across Windows, macOS, and Linux targets.
- Aligned release metadata and app version stamping with the Git tag used for the build.

## Upgrade Notes
- If you previously used `v0.2.0-beta`, this release preserves the same project-first and script-tracking direction while adding stronger search and constraints tooling.
- Refresh local docs and workflow references to use `v0.3.0` naming.
