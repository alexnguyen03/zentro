---
description: Implement a feature based on an existing execution plan
---

@model gemini-3-flash

STEP 1 — PLAN EXTRACTION

1. Read the previous Feature Plan.
2. Extract:

- goal
- modules
- tasks

3. Convert tasks into an ordered execution list.

Output:

Execution Plan
Target Modules
Task Order

Limit <= 120 tokens.

---

@model gemini-3.1-pro-low

STEP 2 — FEATURE IMPLEMENTATION

Execute the implementation tasks sequentially.

MANDATORY ENGINEERING RULES

Follow SOLID principles:

- Single Responsibility Principle
- Open/Closed Principle
- Liskov Substitution Principle
- Interface Segregation Principle
- Dependency Inversion Principle

Architecture rules:

- avoid god classes
- avoid tight coupling
- separate domain logic from infrastructure
- keep functions small and focused

Design pattern guidance (apply when appropriate):

- Factory
- Strategy
- Repository
- Adapter
- Dependency Injection

Implementation rules:

- modify only necessary files
- prefer extending existing abstractions
- follow project coding style
- keep minimal diffs
- avoid introducing unnecessary dependencies

Output:

Task Completed
Files Modified
Code Changes
Applied Design Patterns

Avoid long explanations.

---

@model gemini-3.1-pro-high

STEP 3 — ARCHITECTURE VALIDATION

Review the implemented code for architectural quality.

Check:

- SOLID violations
- unnecessary coupling
- duplicated logic
- incorrect abstraction boundaries

If needed:

- refactor the code
- introduce better abstractions
- apply appropriate design patterns

Output:

Architecture Issues
Refactor Applied
Design Improvements

Limit <= 200 tokens.

---

@model gpt-oss-120b

STEP 4 — CODE REVIEW

Perform strict review:

Check:

- bugs
- edge cases
- concurrency problems
- performance issues
- security concerns

Output:

Issues Found
Suggested Fixes
Risk Level

Limit <= 250 tokens.

---

@model gemini-3-flash

STEP 5 — FINAL SUMMARY

Summarize the implementation.

Output:

Feature Implemented
Files Modified
Design Patterns Used
Next Steps

Limit <= 100 tokens.