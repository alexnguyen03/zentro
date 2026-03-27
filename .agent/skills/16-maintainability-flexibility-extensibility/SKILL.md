---
name: maintainability-flexibility-extensibility-guardrails
description: >
  Guardrails for maintainable, flexible, and extendable code in Zentro (Go + Wails + React).
---

# Skill 16: Maintainability, Flexibility, Extensibility Guardrails

## Purpose

Keep code easy to understand, safe to change, and practical to extend.

## Core Outcomes

Improve at least 3 of 5 outcomes in non-trivial changes:
- Clarity
- Change isolation
- Replaceability
- Testability
- Operability

## Decision Framework

1. Define boundary.
- What behavior changes?
- Which module owns it?
- Which modules should stay unaware?

2. Identify variation.
- What may change in 1-3 months?
- Which provider/platform differences matter?
- What is stable vs volatile?

3. Choose smallest useful abstraction.
- Keep concrete code for one-off flows.
- Add interface only for real variability or test seams.
- Keep interfaces owned by consumers.

4. Protect contracts.
- Preserve public behavior unless intentionally changed.
- Validate boundary inputs.
- Return contextual errors.

5. Verify quality.
- Add/update targeted tests.
- Add regression tests for bug fixes.
- Run focused checks first.

## Mandatory Rules

- Keep Wails-exposed methods thin.
- Backend services should not leak DB-driver details to frontend.
- Frontend business logic lives in features/services/stores.
- Avoid hidden global mutable state.
- Avoid speculative abstraction without volatility evidence.
