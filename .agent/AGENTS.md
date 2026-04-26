# AGENTS.md

## Mission
Build and maintain a focused, calm, high-performance desktop data tool for developers and data analysts.
The product emphasizes:
- fast query workflows
- reliable database exploration
- maintainable data visualization
- minimal distraction, high clarity UX
- predictable desktop behavior

When making tradeoffs, prefer:
1. correctness
2. maintainability
3. performance
4. UX clarity
5. implementation speed

---

## Product Intent
This app is similar in spirit to DBeaver, TablePlus, and Beekeeper Studio, but more focused and zen.
The user should feel:
- calm
- in control
- never overwhelmed
- able to query and inspect data quickly
- able to visualize data without friction

Do not introduce noisy UX, unnecessary animation, or feature sprawl.
Prefer simple, crisp, low-cognitive-load interactions.

---

## Core Engineering Principles
Always write code with SOLID principles in mind:

- Single Responsibility:
  each package, type, component, and function should have one clear reason to change.
- Open/Closed:
  prefer extension points over modifying stable core flows repeatedly.
- Liskov Substitution:
  abstractions must be safely replaceable.
- Interface Segregation:
  prefer small focused interfaces over large general-purpose ones.
- Dependency Inversion:
  high-level modules should depend on abstractions, not concrete infrastructure.

Also prefer:
- high cohesion
- low coupling
- explicit boundaries
- composition over inheritance
- readability over cleverness
- deterministic behavior over hidden magic

---

## Pattern Policy
Always consider whether an established design pattern would improve maintainability, testability, or clarity.

Commonly acceptable patterns in this repository:
- Strategy
- Factory / Abstract Factory
- Adapter
- Facade
- Repository
- Command
- State
- Observer / event-driven pub-sub
- Dependency Injection
- Presenter / ViewModel style UI separation
- Pipeline for query/result transformation

Rules for patterns:
- apply a pattern only when it reduces complexity or isolates change
- do not introduce patterns speculatively
- do not add extra abstraction for one-off code with no realistic extension need
- prefer concrete code first, then extract abstractions when duplication or volatility is real
- explain the chosen pattern briefly in the final summary when the change is architectural

Anti-patterns to avoid:
- god objects
- fat services
- fat React/Wails UI components
- hidden global mutable state
- tight coupling between UI and database drivers
- leaking transport or persistence concerns into domain logic
- broad interfaces used by unrelated consumers
- utility dumping grounds

---

## Architecture Goals
Maintain clear separation between:

1. Desktop shell / Wails integration
2. Application services / use cases
3. Domain logic
4. Infrastructure adapters
5. Frontend UI
6. Visualization logic
7. Query execution and result shaping

Keep business logic out of:
- Wails bootstrap / wiring files
- UI components
- route-like handlers or view glue code

Frontend should not directly encode database-driver-specific behavior.
Driver-specific behavior belongs behind backend/domain or adapter boundaries.

---

## Preferred High-Level Structure
Use or preserve a structure conceptually similar to:

### Backend (Go)
- `backend/app`:
  application services / use cases / orchestration
- `backend/domain`:
  core domain models, policies, domain services, interfaces
- `backend/infrastructure`:
  DB drivers, persistence, OS integration, filesystem, logging, external adapters
- `backend/presentation` or `backend/bridge`:
  Wails-exposed methods / DTO mapping / request-response shaping
- `backend/bootstrap`:
  startup wiring, dependency graph construction

### Frontend (TS / Vite)
- `frontend/src/features`:
  feature-oriented modules
- `frontend/src/components`:
  reusable presentational components
- `frontend/src/screens` or `pages`:
  composition-level UI
- `frontend/src/state`:
  state containers, stores, query state
- `frontend/src/services`:
  frontend service facades / bridge calls / API wrappers
- `frontend/src/visualization`:
  chart config, transforms, visual encodings
- `frontend/src/hooks`:
  reusable hooks only, not business dumping ground
- `frontend/src/lib`:
  focused shared utilities

If the existing repository uses different names, follow the existing layout but preserve the same boundary intent.

---

## Backend Rules (Go)
For Go code:
- keep packages small and cohesive
- define interfaces where they are consumed, not where they are implemented, unless a shared contract is truly central
- prefer explicit constructors with dependencies injected
- avoid package-level mutable state
- return rich errors with context
- propagate `context.Context` where relevant
- keep Wails-exposed methods thin
- map infrastructure models to domain/application DTOs explicitly
- isolate database dialect or driver quirks behind adapter boundaries
- avoid mixing query execution, formatting, caching, and presentation in one type

For concurrency:
- be explicit about ownership, cancellation, and lifecycle
- avoid goroutine leaks
- make long-running query execution cancellable
- prefer predictable concurrency over aggressive parallelism

---

## Frontend Rules (TypeScript / Vite)
For frontend code:
- prefer feature-first organization
- keep components small and composable
- separate container logic from presentational rendering
- avoid giant components with data fetching + transformation + rendering + interaction mixed together
- keep chart data transformation outside presentation components
- use strong TypeScript types; avoid `any`
- prefer explicit state transitions over scattered boolean flags
- derive view state from source state whenever possible
- minimize re-renders in data-heavy views
- preserve keyboard-friendly, focused workflows

UI should feel:
- quiet
- intentional
- dense but readable
- professional
- fast

Do not add visual clutter, ornamental animation, or unnecessary modal interruptions.

---

## Query and Data Visualization Rules
Because this product centers on querying and visualizing data:

- query execution must be separable from result shaping
- result shaping must be separable from chart rendering
- visualization config should be testable without rendering the whole UI
- large result sets must be handled carefully for memory and responsiveness
- preserve correctness of types, nullability, precision, and date/time semantics
- avoid hidden coercions
- prefer explicit transform stages:
  raw result -> normalized rows -> semantic dataset -> visualization model

When adding chart support:
- keep chart library specifics behind a thin adapter layer where practical
- avoid spreading chart-specific assumptions across unrelated UI code
- preserve a path for future chart-system replacement

---

## Maintainability Rules
Every change should aim to improve or preserve:
- clarity
- replaceability
- testability
- local reasoning
- observability

Before introducing a new abstraction, ask:
- what volatility does this isolate?
- what dependency does this invert?
- what testability gain does this create?
- does this reduce duplication or just move it around?

If the answer is weak, keep the code simpler.

---

## File and Change Boundaries
Do not perform large cross-cutting refactors unless explicitly asked.
Prefer the smallest coherent change that solves the problem fully.

When editing:
- preserve public contracts unless the task explicitly allows changing them
- preserve stable UX patterns unless improving consistency
- avoid opportunistic rewrites
- avoid renaming files/symbols without strong value
- do not move code across layers unless it clearly improves architecture

If a requested change conflicts with existing architecture, prefer:
1. minimal safe patch now
2. note recommended follow-up refactor in final summary

---

## Testing and Verification
All non-trivial changes should be verified.

### Backend
Prefer:
- unit tests for domain/application logic
- integration tests for repository/driver behavior when appropriate
- focused tests for query normalization, parsing, mapping, and transformation
- tests for cancellation/error handling in long-running operations when relevant

### Frontend
Prefer:
- unit tests for state logic, data transforms, and visualization mapping
- component tests for critical UI behavior
- avoid brittle snapshot-heavy testing unless the repository already uses it intentionally

### Required verification behavior
After making a change, run the smallest relevant verification first.
Examples:
- targeted backend test
- targeted frontend test
- typecheck
- lint
- relevant build check

If broader verification is warranted, say so and run it when practical.

If you cannot run verification, explicitly say:
- what you could not run
- why
- what should be run next

---

## Definition of Done
A task is not done until:
- the requested change is implemented
- the code follows existing architecture and naming conventions
- SOLID and maintainability were considered
- unnecessary abstraction was avoided
- relevant tests were added or updated when warranted
- appropriate verification was run
- final summary explains what changed, where, why, and any remaining risks

---

## Required Working Style
For meaningful tasks, follow this order:

1. understand the relevant code path first
2. identify the architectural boundary involved
3. decide whether an existing pattern already solves the problem
4. implement the smallest maintainable change
5. verify with targeted tests/checks
6. summarize the result and risks clearly

For bug fixes:
1. identify root cause
2. reproduce via test when practical
3. implement minimal fix
4. add regression protection
5. verify affected areas

For feature work:
1. identify extension points
2. avoid contaminating stable core abstractions
3. preserve separation of concerns
4. add tests for happy path and important edge cases

For refactors:
- preserve external behavior
- state clearly what pattern or architectural improvement is being applied
- do not mix refactor with unrelated feature changes

---

## Communication Style for Final Responses
In final summaries, include:
- root cause or intent
- files/modules changed
- architectural reasoning
- pattern used, if any
- verification run
- remaining risks or follow-ups

Be concise, specific, and engineering-focused.

---

## Commands
Use the repository’s actual commands if available. If commands differ, prefer the existing project standard.

Typical examples:
- backend test: `go test ./...`
- backend focused test: `go test ./... -run TestName`
- frontend test: `pnpm test`
- frontend lint: `pnpm lint`
- frontend typecheck: `pnpm typecheck`
- frontend build: `pnpm build`
- app build: use existing Wails project build command

Do not invent new commands if project scripts already exist.

---

## Do-Not Rules
- do not introduce unnecessary frameworks
- do not add abstractions without a clear reason
- do not bypass established boundaries for convenience
- do not mix UI concerns with domain or infrastructure concerns
- do not bury important logic inside helpers with vague names
- do not use `any` unless absolutely unavoidable and explicitly justified
- do not create giant interfaces
- do not silently change behavior of query execution or data typing
- do not degrade perceived responsiveness in large-data workflows
- do not add noisy UX

---

## If Unsure
If requirements are ambiguous:
- infer from existing architecture first
- follow the calm, focused product direction
- choose maintainability over novelty
- choose explicitness over magic
- choose reversible changes over invasive redesign