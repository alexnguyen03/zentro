---

name: code-process-optimizer

description: "Enforce a structured development workflow: mandatory task breakdown, deep requirement analysis, progressive planning, and automatic progress tracking after each completed feature. Optimized for Golang + Wails + ReactJS + Tailwind projects."

risk: safe

source: "internal"

date_added: "2026-03-05"

---

# Code Process Optimizer Skill

Standardize and optimize the coding workflow by enforcing:

- Mandatory task creation for multi-feature work
- Deep analysis before implementation
- Open-ended exploratory questioning
- Structured planning with phases
- Automatic project progress updates after each feature
- Clear visibility of project state at all times

Optimized for:
- **Golang (backend / services)**
- **Wails (desktop app binding layer)**
- **ReactJS (frontend)**
- **TailwindCSS (UI styling)**

---

## When to Use This Skill

Use this skill when:

- Starting a new feature or module
- Implementing multiple related features
- Refactoring architecture
- Designing new APIs (Go + Wails bindings)
- Planning MVP or multi-phase roadmap
- Feeling unclear about scope or direction
- Needing structured execution instead of ad-hoc coding

---

## Core Principles

### 1️⃣ No Multi-Feature Coding Without Task Breakdown

If a request includes multiple features:
- Automatically create:
  - Parent Task
  - Subtasks (by domain: backend / binding / frontend / state / UI)
- Each subtask must include:
  - Scope
  - Constraints
  - Acceptance criteria
  - Risks

No direct coding before planning is approved.

---

### 2️⃣ Mandatory Deep Analysis Phase

Before writing any implementation:

#### A. Clarify Context
- Is this MVP or production-grade?
- Does it affect existing architecture?
- Is backward compatibility required?
- Is performance critical?
- Is it local-first or sync-enabled?

#### B. Ask Expansion Questions
Generate open-ended questions such as:
- What edge cases could break this?
- What is the failure mode?
- What happens if backend returns invalid data?
- How does this impact Wails bindings?
- Do we need caching?
- Is concurrency involved?
- Do we need rollback strategy?

Minimum: 5 meaningful questions per complex task.

---

### 3️⃣ Structured Planning Format

Every major feature must follow this structure:

#### 📌 Feature Overview
Short explanation of what we are building.

#### 🧠 Technical Design
- Backend (Golang)
  - Data structures
  - Interfaces
  - Error handling
  - Concurrency model (if any)
- Wails Binding Layer
  - Exposed methods
  - DTO shape
- Frontend (ReactJS)
  - Components
  - State management
  - API interaction
- UI (Tailwind)
  - Layout
  - Reusable components
  - Responsive considerations

#### ⚠️ Risk Analysis
- Technical risks
- Performance risks
- UX risks

#### ✅ Acceptance Criteria
Clear measurable outcomes.

---

### 4️⃣ Implementation Discipline

Rules:

- Never mix planning and implementation in one step.
- Always confirm plan before coding.
- Keep functions small and composable.
- No business logic in React components.
- No UI logic in Go backend.
- Binding layer must stay thin.

---

### 5️⃣ Progress Tracking System

After each completed feature (in feature.md):

Update project state in this format:


```markdown
## Project Progress

### Current Phase
Phase X – [Name]

### Completed
- [x] Feature A
- [x] Feature B

### In Progress
- [ ] Feature C

### Next Up
- Feature D
- Feature E

### Technical Debt
- Item 1
- Item 2