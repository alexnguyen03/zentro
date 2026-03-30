# Zentro v2 Specification

> Status: Draft
> Audience: Product, Frontend, Backend
> Document type: Master product and architecture spec

---

## 1. Product Intent

Zentro v2 is a lean, project-first SQL IDE built for developers and data analysts who need to execute queries quickly, inspect data smoothly, and grow into an enterprise-grade workflow over time.

Zentro v2 should not become a heavy all-in-one data platform. Its core promise is:

- Open a project.
- Resume work immediately.
- Run queries with minimal friction.
- Explore results smoothly.
- Add visualization as a natural extension of the result flow in v2.

The product should feel:

- Fast
- Focused
- Elegant
- Context-aware
- Enterprise-ready by architecture, not by UI heaviness

---

## 2. Product Principles

These principles are locked for v2:

1. Project-first only
   - Zentro is not a dual-mode connection browser.
   - Every meaningful session lives inside a project context.

2. Resume last workspace by default
   - After project selection, the user should land directly in the last active workspace.
   - Avoid forcing users through a dashboard on every launch.

3. Lean-by-default UI
   - Only the core actions stay visible at all times.
   - Secondary and advanced actions move into contextual surfaces.

4. Fixed environment semantics
   - Zentro uses a stable environment system:
     - `loc` = Local
     - `tes` = Testing
     - `dev` = Development
     - `sta` = Staging
     - `pro` = Production

5. Project-owned connections
   - Connections belong to the project.
   - A project is self-contained and easier to reason about.

6. Advanced setup is separated
   - Quick setup gets the user connected fast.
   - Advanced connection/security options live in a dedicated screen.

7. Visualization starts from results
   - Visualization in v2 begins inline from the result grid.
   - Do not introduce a separate top-level visualization shell first.

8. Enterprise scale comes from clean boundaries
   - Strong model boundaries, safety states, IDs, metadata, and extensibility matter more than exposing every enterprise concept on day one.

---

## 3. Target Users

### 3.1 Developers

Developers use Zentro to:

- Run queries against local, dev, staging, and production data sources
- Inspect schemas and data quickly
- Compare behavior across environments
- Save repeatable query workflows
- Recover context quickly after reopening the app

### 3.2 Data Analysts

Data analysts use Zentro to:

- Explore datasets
- Save useful queries
- Filter, inspect, and export results
- Organize work by project instead of raw connection lists
- Move from query execution to lightweight visualization in v2

---

## 4. Product Goals

### 4.1 Primary goals

- Minimize time from launch to first query execution
- Make environment context impossible to miss
- Keep query execution and result exploration smooth at all times
- Reduce UI clutter without removing capability
- Build the correct model for enterprise evolution

### 4.2 Non-goals for v2

- Full notebook product
- Heavy BI dashboard builder
- Shared cloud collaboration in the first release
- Full RBAC and approval workflows in v2
- Large plugin marketplace

---

## 5. Core Domain Model

Zentro v2 should use the following domain model.

### 5.1 Project

`Project` is the top-level working unit.

A project owns:

- Environments
- Connections
- Workspaces
- Saved assets
- Recent activity
- Preferences and defaults

Suggested fields:

- `id`
- `slug`
- `name`
- `description`
- `tags`
- `created_at`
- `updated_at`
- `default_environment_key`
- `last_workspace_id`

### 5.2 Environment

`Environment` defines the execution context within a project.

Each project can have zero or more of the fixed environment types:

- `loc`
- `tes`
- `dev`
- `sta`
- `pro`

Suggested fields:

- `id`
- `project_id`
- `key`
- `label`
- `badge_color`
- `is_protected`
- `is_read_only`
- `last_database`
- `last_schema`
- `last_catalog`

### 5.3 Connection

`Connection` is a project-owned infrastructure definition attached to an environment.

In v2, one environment maps to one owned connection definition.

Suggested fields:

- `id`
- `project_id`
- `environment_key`
- `name`
- `driver`
- `version`
- `host`
- `port`
- `database`
- `username`
- `password_policy`
- `save_password`
- `ssl_mode`
- `socket_path`
- `use_socket`
- `ssh_enabled`
- `status_color`
- `advanced_meta`

### 5.4 Workspace

`Workspace` is the main execution container.

A workspace stores:

- Editor tab groups
- Active tab
- Active environment
- Query and result context
- Layout state
- Filters
- Schema expansion state
- Lightweight notes
- Restore metadata

Suggested fields:

- `id`
- `project_id`
- `environment_key`
- `name`
- `type`
- `description`
- `layout_state`
- `active_group_id`
- `last_opened_at`

### 5.5 Asset

`Asset` is any reusable user artifact inside a project.

Initial asset types:

- Saved query
- Saved workspace
- Template
- Favorite table/view
- Result snapshot metadata

Suggested fields:

- `id`
- `project_id`
- `workspace_id`
- `type`
- `name`
- `description`
- `tags`
- `created_at`
- `updated_at`

### 5.6 ExecutionContext

Every query should run inside a clear execution context:

- `project_id`
- `environment_key`
- `workspace_id`
- `connection_id`
- `database`
- `schema`
- `tab_id`

This context should be explicit in both frontend state and backend execution APIs.

---

## 6. Environment System

Zentro v2 uses a fixed environment taxonomy.

| Tag | Label | Meaning | Default posture |
|---|---|---|---|
| `loc` | Local | Local machine or sandbox | least restrictive |
| `tes` | Testing | Temporary testing or QA-style validation | light warnings |
| `dev` | Development | Day-to-day development environment | normal execution |
| `sta` | Staging | Pre-production validation | confirmation for risky writes |
| `pro` | Production | Production environment | protected, strong confirmation |

### 6.1 Rules

- Semantics are fixed across all projects.
- Labels may be customized slightly, but the semantic meaning should remain stable.
- Badge color should be consistent across the app.
- Policies and warnings should attach to environment semantics, not only connection names.

### 6.2 Visual system

Suggested defaults:

- `loc`: green or muted safe accent
- `tes`: purple
- `dev`: blue
- `sta`: yellow
- `pro`: red

These badges should appear in:

- Project Hub
- Workspace header
- Environment switcher
- Status bar
- Result context
- Saved assets metadata

---

## 7. Main Product Flows

### 7.1 App launch flow

Default flow:

1. Launch app
2. Show Project Hub
3. User selects a project
4. Resume the last workspace automatically

If the selected project is not ready:

- show a setup gate
- guide the user to connect the missing environment
- return to workspace immediately after success

### 7.2 New project flow

Create project steps:

1. Enter project name and description
2. Choose which environments to enable
3. Configure the first environment connection using quick setup
4. Create the first workspace
5. Land in the workspace

### 7.3 Resume flow

When reopening an existing project:

- restore the last workspace
- restore editor tabs and layout
- restore the last environment
- restore the last active connection state where possible

### 7.4 Query execution flow

The default query flow should be:

1. Open project
2. Resume workspace
3. Write or edit query
4. Run query
5. Inspect result
6. Save query, export, filter, or visualize from the result surface

This flow should avoid unnecessary modal interruptions.

### 7.5 Environment switch flow

When the user switches environment:

- keep workspace structure
- update runtime connection state
- update badges and safety affordances
- make the current environment extremely obvious
- preserve last-used database/schema for that environment

### 7.6 Recovery flow

If a connection is broken or invalid:

- do not dump the user into a dead end
- show one recovery surface with clear next actions:
  - reconnect
  - edit quick setup
  - open advanced settings

---

## 8. UI Architecture

Zentro v2 should have four main surfaces:

1. Project Hub
2. Workspace
3. Project Settings
4. Advanced Connection Settings

### 8.1 Project Hub

Project Hub should be lightweight and operational.

It should contain:

- Recent projects
- Create project
- Open project
- Last opened time
- Environment readiness hint

It should not become a heavy dashboard.

### 8.2 Workspace

Workspace is the main product surface.

It should include:

- Top execution toolbar
- Left project-aware sidebar
- Editor and tabs
- Result panel
- Optional secondary context surfaces
- Status bar

### 8.3 Project Settings

Project Settings should manage:

- Project metadata
- Environment enablement
- Workspace defaults
- Project-level asset organization

### 8.4 Advanced Connection Settings

This screen should manage:

- SSH
- SSL and certificates
- socket options
- password policy
- advanced driver settings
- future enterprise metadata

---

## 9. Lean Action Placement

One of the core v2 goals is reducing visible clutter without reducing power.

### 9.1 Core actions that remain visible

The primary toolbar should keep only:

- Project / environment switch
- New tab
- Run
- Cancel
- Search or command palette
- Minimal layout toggles

### 9.2 Actions that move out of the main toolbar

These should move into contextual UI, overflow menus, or command palette:

- Transaction controls
- Compare query tools
- Deep explain variants
- Export variants
- Deep data editing actions
- Advanced connection controls

### 9.3 Placement rules

- Query actions belong near the editor or result context
- Data actions belong in the result surface
- Infrastructure actions belong in settings
- Rare actions should not compete visually with execution actions

---

## 10. Connection Experience

Connection UX is split into two levels.

### 10.1 Quick Environment Setup

Quick setup should include only what is needed to get connected fast:

- Driver
- Host
- Port
- Database
- Username
- Password
- Basic test / connect actions

This is the default path in setup gates.

### 10.2 Advanced Connection Settings

Advanced setup should include:

- Version
- Status color
- SSL mode
- SSL key, cert, CA
- Socket usage
- SSH or tunnel controls
- Credential policy
- Advanced engine options

### 10.3 Quick principles

- Fast path first
- Deep path available
- Never overload the first-run setup screen with advanced controls

---

## 11. Workspace Model

Workspace should become the durable unit of task continuity.

### 11.1 Workspace types

Recommended initial types:

- `scratch`
- `analysis`
- `inspection`

### 11.2 Workspace state

Workspace state should include:

- Open tab groups
- Active tab
- Active environment
- Result state references
- Filter expressions
- Layout toggles
- Notes
- Last-opened metadata

### 11.3 Restore behavior

On resume:

- restore tabs and layout
- restore the active tab
- restore the active environment
- restore the relevant result state where useful

---

## 12. Asset Model

Assets should belong to the project model, not to raw connection names.

### 12.1 Initial asset types

- Saved query
- Saved workspace
- Template
- Favorite table/view
- Result snapshot metadata

### 12.2 Scope rules

- Assets are project-scoped
- Workspaces are project-scoped and environment-aware
- History is project-aware and environment-aware
- Bookmarks should become workspace-scoped instead of connection-scoped

### 12.3 Why this matters

This lets users think in terms of work and context, not raw infrastructure entries.

---

## 13. Result and Visualization Direction

### 13.1 Result surface in v2

The result panel should remain the primary post-query surface.

It should support:

- Sort
- Filter
- Export
- Save query
- Row detail
- Lightweight result actions

### 13.2 Visualization direction

Visualization in v2 should begin from the result grid.

Flow:

1. Run query
2. Inspect results
3. Trigger `Visualize`
4. Generate quick chart suggestions from result shape
5. Open chart inline or in split view

### 13.3 Constraints

- No separate top-level visualization workspace in the first step
- No heavy dashboard builder in initial v2 scope
- Visualization must feel like a continuation of query execution

---

## 14. Enterprise-Ready Foundations

Zentro v2 should prepare for enterprise growth without exposing enterprise complexity too early.

### 14.1 Required foundations

- Deterministic IDs for projects, environments, connections, workspaces, and assets
- Audit-friendly metadata
- Protected environment states
- Read-only and confirmation policies
- Separation between domain model and runtime connection state
- Storage shape that can evolve toward sync later

### 14.2 Not included in the first v2 cut

- RBAC
- Approval workflows
- Shared cloud workspaces
- Real-time collaboration
- Full notebook system
- Full BI/dashboard suite

---

## 15. Technical Architecture Impact

This spec has direct implications for the current codebase.

### 15.1 Frontend store evolution

Add or evolve stores toward:

- `projectStore`
- `environmentStore`
- `workspaceStore`
- `connectionStore` as runtime transport state only

Existing stores should become workspace-aware where needed.

### 15.2 State migration direction

The current app is largely connection-centric.

Migration direction:

- move from connection-rooted state to project-rooted state
- re-scope scripts, history, and bookmarks away from raw connection name
- make environment context explicit everywhere

### 15.3 Backend / bridge implications

Backend methods should stop assuming one implicit global connection is enough for the full product model.

Execution and persistence APIs should gradually accept:

- project context
- environment context
- workspace context

---

## 16. Recommended Public Interfaces

These are the main types that should exist in the product model:

- `Project`
- `ProjectEnvironment`
- `ProjectConnection`
- `Workspace`
- `ProjectAsset`
- `ExecutionContext`

Suggested application APIs:

- `ListProjects()`
- `CreateProject(input)`
- `OpenProject(projectID)`
- `ListProjectEnvironments(projectID)`
- `ConnectProjectEnvironment(projectID, envKey)`
- `UpdateProjectConnection(projectID, envKey, patch)`
- `ResumeWorkspace(projectID)`
- `SaveWorkspace(workspaceID, snapshot)`
- `ListProjectAssets(projectID, filters)`
- `SaveProjectQuery(input)`

---

## 17. Rollout Plan

### Phase 1: Product model and persistence

- Introduce project, environment, workspace, and asset types
- Keep compatibility with current connection-centric data where possible

### Phase 2: Project Hub and project selection

- Add Project Hub
- Add project creation flow
- Route startup through project selection

### Phase 3: Workspace resume flow

- Resume last workspace after project selection
- Restore editor context cleanly

### Phase 4: Project-owned environment connections

- Replace raw connection-first entry logic
- Add quick setup and advanced setup separation

### Phase 5: Asset migration

- Move scripts, history, bookmarks, and similar state into project/workspace scope

### Phase 6: Lean toolbar and contextual actions

- Reduce default chrome
- Re-home advanced actions into contextual surfaces

### Phase 7: Visualization hooks

- Prepare result metadata and UI entry point for inline visualization

### Phase 8: Enterprise hardening

- Add stronger safety policy support
- Add richer audit metadata

---

## 18. Acceptance Criteria

Zentro v2 is successful when:

- A user can launch the app, pick a project, and run a query with minimal navigation.
- The current project and environment are always obvious.
- The default toolbar feels clean and focused.
- Advanced capability still exists without polluting the fast path.
- Workspaces restore reliably.
- Assets feel project-based, not connection-based.
- Visualization can be added to the result flow without redesigning the shell.
- The architecture can evolve toward enterprise features later without rewriting the core model.

---

## 19. Summary

Zentro v2 should be:

- Project-first
- Execution-first
- Lean by default
- Smooth for developers and data analysts
- Structured for enterprise evolution

The product should not try to win by feature volume. It should win by clarity, speed, and elegance of flow.
