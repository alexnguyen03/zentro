---
description: Create a detailed implementation plan for a new feature before coding
---

@model gemini-3-flash

STEP 1 — TASK NORMALIZATION

1. Read the user request.
2. Rewrite the feature request clearly and concisely.
3. Extract:

- feature goal
- user value
- constraints
- affected area of the system

Output format:

Feature Summary
User Problem
Expected Outcome
Constraints (if any)

Limit response to <= 120 tokens.

---

@model claude-sonnet-4.6

STEP 2 — ARCHITECTURE ANALYSIS

Analyze the repository and determine:

- which modules are affected
- whether the feature requires new components
- potential architectural changes
- dependencies between modules

Consider:

- maintainability
- separation of concerns
- minimal impact on existing code

Output:

Architecture Impact
Affected Modules
Required Components
Dependency Notes

Limit response to <= 250 tokens.

---

@model claude-sonnet-4.6

STEP 3 — IMPLEMENTATION STRATEGY

Create a clear strategy for implementing the feature.

Include:

1. high-level approach
2. key technical decisions
3. data flow
4. API or interface changes (if any)

Output format:

Implementation Approach
Data Flow
Interface Changes
Key Design Decisions

Limit response to <= 300 tokens.

---

@model claude-sonnet-4.6

STEP 4 — TASK BREAKDOWN

Break the feature into small implementation tasks.

Rules:

- tasks should be executable independently
- avoid tasks larger than 1 file change
- follow incremental development

Output format:

Task List

1. Task name
   - description
   - files to modify

2. Task name
   - description
   - files to modify

Limit to 6–10 tasks.

---

@model gemini-3-flash

STEP 5 — FINAL EXECUTION PLAN

Summarize the plan into a developer-friendly checklist.

Output:

Feature Plan

Goal
Key Modules
Implementation Tasks

Checklist format:

[ ] task 1
[ ] task 2
[ ] task 3

This plan must be directly usable by an implementation workflow.
Limit response <= 120 tokens.