# Zentro v2 Task Breakdown

> Source of truth: `specs/zentro-v2-spec.md`
> Purpose: Implementation-ready backlog for product, frontend, and backend work
> Status: Draft

---

## 1. Implementation Strategy

Zentro v2 should be implemented in a staged migration, not a hard rewrite.

Execution order:

1. Introduce the project-centric domain model
2. Add new startup and workspace flow
3. Re-scope runtime and persisted state
4. Rework shell and action placement
5. Migrate assets and history
6. Add v2 visualization hooks
7. Harden for enterprise-ready behavior

General rules:

- Keep current query execution working during migration
- Prefer compatibility layers over abrupt removal
- Move from connection-first to project-first incrementally
- Keep user-visible flow simple even when internals are transitional

---

## 2. Phase 1: Domain Foundation

### Epic 1.1: Introduce v2 product model

#### Task 1.1.1

- Title: Add core project-centric types
- Goal: Define the base domain model for project, environment, workspace, asset, and execution context
- Area: Backend + Frontend types
- Dependencies: None
- Deliverables:
  - `Project`
  - `ProjectEnvironment`
  - `ProjectConnection`
  - `Workspace`
  - `ProjectAsset`
  - `ExecutionContext`
- Acceptance criteria:
  - Types exist in both Go and TypeScript-facing model layers
  - Fields align with the v2 spec
  - IDs are explicit and stable

#### Task 1.1.2

- Title: Add fixed environment taxonomy
- Goal: Encode `loc`, `tes`, `dev`, `sta`, `pro` as first-class semantics
- Area: Shared constants / model layer
- Dependencies: Task 1.1.1
- Deliverables:
  - Environment constants
  - Labels
  - Color mapping metadata
  - Safety defaults
- Acceptance criteria:
  - Environment semantics are not free-form
  - UI and backend can rely on the same fixed keys

#### Task 1.1.3

- Title: Define project-owned connection model
- Goal: Stop treating raw connection profile as the root object
- Area: Backend persistence + frontend types
- Dependencies: Task 1.1.1
- Deliverables:
  - Project-owned connection schema
  - Mapping from environment to owned connection
- Acceptance criteria:
  - Each environment can resolve one connection definition in v1
  - Connection definitions include quick and advanced fields

### Epic 1.2: Add persistence layer for v2 objects

#### Task 1.2.1

- Title: Create local storage shape for projects
- Goal: Persist projects, environments, workspaces, and assets locally
- Area: Backend persistence
- Dependencies: Epic 1.1
- Deliverables:
  - File layout or JSON schema for projects
  - Read and write helpers
- Acceptance criteria:
  - A project can be created, saved, and loaded
  - Workspace metadata can be associated with a project

#### Task 1.2.2

- Title: Keep credential storage separated from project metadata
- Goal: Preserve security hygiene and future enterprise portability
- Area: Backend storage
- Dependencies: Task 1.2.1
- Deliverables:
  - Stable secret lookup keys
  - Mapping between stored secrets and project-owned connections
- Acceptance criteria:
  - Secrets are not embedded directly in project metadata files
  - Existing keyring strategy remains compatible or migratable

---

## 3. Phase 2: Startup and Project Flow

### Epic 2.1: Replace startup with Project Hub

#### Task 2.1.1

- Title: Build Project Hub surface
- Goal: Replace the current connection-first startup with project selection
- Area: Frontend shell
- Dependencies: Phase 1
- Deliverables:
  - Project list view
  - Recent project list
  - Create project CTA
- Acceptance criteria:
  - App can open into Project Hub
  - User can select a project without entering the old workspace modal first

#### Task 2.1.2

- Title: Add create-project flow
- Goal: Let users bootstrap a new project without leaving the hub
- Area: Frontend + Backend
- Dependencies: Task 2.1.1
- Deliverables:
  - Project creation UI
  - CreateProject backend method
- Acceptance criteria:
  - New project can be created successfully
  - New project persists after restart

### Epic 2.2: Resume last workspace by default

#### Task 2.2.1

- Title: Add project open and workspace resume logic
- Goal: After selecting a project, land directly in the most recent workspace
- Area: Frontend routing/state + backend project service
- Dependencies: Phase 1
- Deliverables:
  - `OpenProject`
  - `ResumeWorkspace`
  - last workspace persistence
- Acceptance criteria:
  - Opening a project resumes the last workspace when available
  - New projects fall back to first-workspace setup

#### Task 2.2.2

- Title: Add project setup gate
- Goal: Handle incomplete projects gracefully
- Area: Frontend
- Dependencies: Task 2.2.1
- Deliverables:
  - Setup gate UI
  - Recovery paths for missing environment connection
- Acceptance criteria:
  - Incomplete projects do not drop the user into a broken empty state
  - Recovery path is obvious and minimal

---

## 4. Phase 3: State Refactor

### Epic 3.1: Introduce v2 stores

#### Task 3.1.1

- Title: Create `projectStore`
- Goal: Track project list, selected project, and recent selection state
- Area: Frontend state
- Dependencies: Phase 1
- Acceptance criteria:
  - Selected project state survives app reload where appropriate
  - Hub and workspace can read the same selected project state

#### Task 3.1.2

- Title: Create `environmentStore`
- Goal: Track active environment, environment status, and environment switching
- Area: Frontend state
- Dependencies: Phase 1
- Acceptance criteria:
  - Active environment is explicit
  - UI can read environment semantics and safety posture from one store

#### Task 3.1.3

- Title: Create `workspaceStore`
- Goal: Track workspace list, active workspace, and snapshot lifecycle
- Area: Frontend state
- Dependencies: Phase 1
- Acceptance criteria:
  - Workspace selection and restore behavior are centralized
  - Active workspace can own editor and result context

### Epic 3.2: Re-scope existing stores

#### Task 3.2.1

- Title: Refactor `connectionStore` to runtime-only responsibility
- Goal: Make connection state reflect active transport/session instead of global product identity
- Area: Frontend state
- Dependencies: Epic 3.1
- Acceptance criteria:
  - `connectionStore` no longer acts as the app root domain state
  - Project and environment context stay outside connection runtime concerns

#### Task 3.2.2

- Title: Make editor state workspace-aware
- Goal: Scope tabs, groups, and active editor state to a workspace
- Area: Frontend state
- Dependencies: Task 3.1.3
- Acceptance criteria:
  - Opening another workspace restores its own tab state
  - Workspace switching no longer feels like one global editor session

#### Task 3.2.3

- Title: Make result state workspace-aware
- Goal: Scope results and result actions to workspace and execution context
- Area: Frontend state
- Dependencies: Task 3.2.2
- Acceptance criteria:
  - Result panels remain consistent after workspace restore and environment switch

---

## 5. Phase 4: Environment and Connection Experience

### Epic 4.1: Add project-owned environment flow

#### Task 4.1.1

- Title: Create environment switcher
- Goal: Make current environment explicit and easy to change
- Area: Frontend shell
- Dependencies: Phase 3
- Acceptance criteria:
  - User can switch between enabled project environments
  - Current environment is clearly visible in the shell

#### Task 4.1.2

- Title: Apply environment visual system
- Goal: Use fixed tags and colors consistently across the app
- Area: Frontend UI
- Dependencies: Task 1.1.2
- Acceptance criteria:
  - `loc/tes/dev/sta/pro` badges render consistently in key UI surfaces
  - Environment meaning is visually obvious

### Epic 4.2: Split quick and advanced connection setup

#### Task 4.2.1

- Title: Build quick environment setup flow
- Goal: Let users connect a project environment with minimal fields and minimal friction
- Area: Frontend + Backend
- Dependencies: Phase 2, Phase 3
- Acceptance criteria:
  - User can connect an environment through a short setup flow
  - Advanced connection fields are not shown by default

#### Task 4.2.2

- Title: Build advanced connection settings screen
- Goal: Expose SSH, SSL, socket, version, and policy configuration without polluting the fast path
- Area: Frontend + Backend
- Dependencies: Task 4.2.1
- Acceptance criteria:
  - Advanced fields are available in a dedicated surface
  - Quick flow remains visually clean

#### Task 4.2.3

- Title: Add environment connection validation and testing
- Goal: Ensure each project environment can validate connectivity cleanly
- Area: Backend + Frontend
- Dependencies: Task 4.2.1
- Acceptance criteria:
  - User can test environment connection
  - Invalid environment shows a recovery path

---

## 6. Phase 5: Workspace and Shell Rework

### Epic 5.1: Rebuild shell around workspace execution

#### Task 5.1.1

- Title: Update top shell to project/environment-aware breadcrumb
- Goal: Replace connection-first shell identity with project and environment identity
- Area: Frontend shell
- Dependencies: Phase 3, Phase 4
- Acceptance criteria:
  - Toolbar and status bar show project and environment context first
  - Connection detail becomes secondary context

#### Task 5.1.2

- Title: Add workspace lifecycle actions
- Goal: Support create, rename, restore, and switch workspace actions
- Area: Frontend + Backend
- Dependencies: Task 3.1.3
- Acceptance criteria:
  - User can create and resume workspaces per project
  - Workspace switch preserves independent state

### Epic 5.2: Lean toolbar migration

#### Task 5.2.1

- Title: Reduce primary toolbar to core actions
- Goal: Keep only execution-critical actions visible by default
- Area: Frontend shell
- Dependencies: Task 5.1.1
- Acceptance criteria:
  - Toolbar keeps only the agreed lean action set
  - UI feels less crowded than the current shell

#### Task 5.2.2

- Title: Move secondary actions into contextual surfaces
- Goal: Preserve power while reducing chrome density
- Area: Frontend
- Dependencies: Task 5.2.1
- Acceptance criteria:
  - Compare, transactions, export variants, and advanced actions remain reachable
  - They no longer dominate the default execution surface

---

## 7. Phase 6: Assets, History, and Migration

### Epic 6.1: Re-scope saved artifacts

#### Task 6.1.1

- Title: Migrate saved scripts to project-scoped assets
- Goal: Replace raw connection-name scoping for scripts
- Area: Backend + Frontend
- Dependencies: Phase 1, Phase 3
- Acceptance criteria:
  - Saved scripts load inside project context
  - Scripts are no longer rooted only in connection identity

#### Task 6.1.2

- Title: Re-scope bookmarks to workspace context
- Goal: Make bookmarks durable per workspace and tab
- Area: Backend + Frontend
- Dependencies: Task 3.2.2
- Acceptance criteria:
  - Bookmarks survive workspace restore
  - Bookmarks are not keyed by connection name

#### Task 6.1.3

- Title: Re-scope history to project and environment
- Goal: Preserve execution history in a meaningful product context
- Area: Backend + Frontend
- Dependencies: Phase 3, Phase 4
- Acceptance criteria:
  - History entries include project and environment dimensions
  - History remains easy to filter and restore from

### Epic 6.2: Compatibility migration

#### Task 6.2.1

- Title: Add migration path from connection-centric data
- Goal: Avoid data loss while moving to the v2 model
- Area: Backend migration
- Dependencies: Phase 1
- Acceptance criteria:
  - Existing connections and saved data can be mapped into projects
  - Old users are not forced to rebuild everything manually

#### Task 6.2.2

- Title: Add transitional compatibility layer in runtime logic
- Goal: Keep current query flow working while the app adopts project context
- Area: Backend + Frontend
- Dependencies: Task 6.2.1
- Acceptance criteria:
  - Query execution remains stable during migration work
  - Transitional state is isolated and removable later

---

## 8. Phase 7: Result Flow and Visualization Hooks

### Epic 7.1: Result-first action model

#### Task 7.1.1

- Title: Reorganize result actions into a cleaner contextual surface
- Goal: Make result exploration more fluid and less toolbar-dependent
- Area: Frontend result panel
- Dependencies: Phase 5
- Acceptance criteria:
  - Sort, filter, export, save query, and row detail actions remain smooth
  - Result actions feel local to the result surface

#### Task 7.1.2

- Title: Add saved-query entry points from result flow
- Goal: Let users preserve useful work at the right moment
- Area: Frontend + Backend
- Dependencies: Phase 6
- Acceptance criteria:
  - Query can be saved from the execution/result flow
  - Saved query lands in project asset storage

### Epic 7.2: Visualization preparation

#### Task 7.2.1

- Title: Add `Visualize` action placeholder to result flow
- Goal: Create a stable UI insertion point for v2 charting
- Area: Frontend result panel
- Dependencies: Task 7.1.1
- Acceptance criteria:
  - Result panel has a clear but lightweight visualization entry point
  - The shell does not need redesign later to host visualization

#### Task 7.2.2

- Title: Capture result metadata needed for chart suggestions
- Goal: Preserve enough shape information to support future inline visualization
- Area: Frontend + Backend
- Dependencies: Task 7.2.1
- Acceptance criteria:
  - Result metadata can distinguish categorical/numeric/time-like columns
  - Visualization v2 can build on this without redesigning query execution

---

## 9. Phase 8: Enterprise Hardening

### Epic 8.1: Environment safety

#### Task 8.1.1

- Title: Add protected environment behavior
- Goal: Enforce stronger safety for `sta` and `pro`
- Area: Frontend + Backend
- Dependencies: Phase 4
- Acceptance criteria:
  - Protected environments are visually distinct
  - Risky actions in protected environments trigger the correct confirmation flow

#### Task 8.1.2

- Title: Add read-only environment support
- Goal: Support safer enterprise usage patterns
- Area: Frontend + Backend
- Dependencies: Task 8.1.1
- Acceptance criteria:
  - Read-only environments block editing and risky mutation actions appropriately

### Epic 8.2: Audit-ready metadata

#### Task 8.2.1

- Title: Add audit-friendly metadata to core entities
- Goal: Prepare the system for future enterprise controls without changing UX now
- Area: Backend model + persistence
- Dependencies: Phase 1
- Acceptance criteria:
  - Projects, workspaces, assets, and execution history can store identity and timestamp metadata cleanly

#### Task 8.2.2

- Title: Add acceptance and regression coverage for v2 shell flow
- Goal: Prevent breakage in the new project-first experience
- Area: Frontend + Backend tests
- Dependencies: All prior phases
- Acceptance criteria:
  - App launch, project open, environment switch, workspace restore, and query execution all have coverage or repeatable verification scripts

---

## 10. Cross-Functional Task List

### Product / UX

- Refine Project Hub information hierarchy
- Define setup gate empty and recovery states
- Finalize environment badge visual system
- Finalize lean toolbar action policy
- Define result-surface action ordering

### Frontend

- Add new stores
- Rework startup shell
- Introduce workspace-aware editor and result state
- Refactor toolbar and status bar
- Build new setup and settings surfaces

### Backend

- Add project-centric model and persistence
- Add project/environment/workspace-aware APIs
- Add migration logic from old state
- Keep query execution compatible while context evolves

### QA / Validation

- Validate startup to query flow latency
- Validate workspace restore reliability
- Validate environment safety behavior
- Validate migration from existing user state

---

## 11. Suggested Execution Order

The recommended implementation order is:

1. Domain types and persistence
2. Project Hub and project selection
3. Workspace restore and store refactor
4. Environment switcher and quick setup
5. Lean toolbar migration
6. Asset and history migration
7. Result-surface cleanup
8. Visualization hooks
9. Enterprise safety and hardening

---

## 12. Definition of Done

Zentro v2 implementation is ready for internal validation when:

- Project Hub is the new startup entry
- Project selection resumes the last workspace
- Query execution works inside explicit project and environment context
- Current environment is always visible
- The toolbar is visibly leaner than the current one
- Scripts, history, and bookmarks no longer depend on raw connection-name scoping
- Quick setup is fast and advanced settings are isolated
- Result flow has a clean hook for future inline visualization
- Protected environments behave safely and predictably
