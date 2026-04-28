# Zentro Release Notes (v0.3.0)

## Release Scope
This `v0.3.0` refresh republishes the current stable line with the latest code on `dev`, corrected release metadata, and the final release notes body used by GitHub Actions.

## Summary
`v0.3.0` is the first stable `0.3.x` release for Zentro, focused on:
- Faster SQL workflows and editor productivity
- Better result exploration and data actions
- Stronger schema/table tooling
- Safer source-control flows and release hardening
- Broader UI consistency through shadcn/radix migration

## Highlights
- Added universal script search with matched-line jump navigation.
- Improved result-grid workflows with richer copy/export/context actions.
- Expanded Table Info and schema operations with stronger consistency across constraint and object flows.
- Added SQL-oriented Git tracking and safer source-control interactions.
- Continued frontend design-system migration and architecture cleanup across toolbar, sidebar, settings, and project flows.

## What Is New in v0.3.0

### SQL Editor, Search & Productivity
- Added universal script search in Context Search using `#` prefix.
- Added matched-line search results with direct jump-to-line navigation.
- Polished saved scripts UX with content previews and hover cards.
- Improved multi-result labeling and SQL workflow helpers, including insert/update actions, copy helpers, and definition navigation.

### Result Grid & Data Workflows
- Modularized `ResultTable` and related hooks to improve maintainability and reload resilience.
- Improved result filtering flow and order-by builder behavior.
- Added richer result context actions such as copy value, copy with headers, copy as JSON, and SQL copy helpers.
- Fixed dirty-cell state edge cases and stabilized result sync loops after rerun.

### Schema Explorer & Table Info
- Expanded Table Info with unified key and constraint workflows.
- Added full foreign key CRUD flow in table constraints management.
- Added richer object operations from explorer context menu, including drop, truncate, and export flows.
- Improved DDL handling paths and index operation correctness across drivers.

### Source Control & Project Safety
- Added SQL-oriented Git tracking with timeline, manual commit flow, and diff preview.
- Added close-flush and exit-commit hardening in project source-control workflows.
- Hardened write-safety protections, including stronger confirmation behavior for high-risk environments.

### UI System, Architecture & Stability
- Migrated core frontend surfaces to shadcn/radix primitives and standardized control patterns.
- Introduced broader design-token and UI consistency updates across toolbar, sidebar, settings, and project hub.
- Continued decomposition of large frontend modules into focused units across editor, result, and table-info domains.
- Fixed multiple frontend guardrail, accessibility, lifecycle, and performance issues, including Monaco lifecycle stability.

## Release Fixes Included In This Republish
- Corrected version metadata that still referenced `v0.2.0-beta` in runtime and release scripts.
- Updated the GitHub release body source so the regenerated `v0.3.0` release notes match the stable release.
- Included latest app-menu and dropdown behavior refinements before retagging to rerun the release workflow.
