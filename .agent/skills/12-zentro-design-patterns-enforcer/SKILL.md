---
name: zentro-design-patterns-enforcer
description: >
  Pattern-selection guardrail for Wails architecture: choose the smallest pattern
  that improves maintainability and change safety.
---

# Skill 12: Design Patterns Enforcer

## Purpose

Apply patterns intentionally, not mechanically.

## Approved Patterns

- Dependency Injection
- Strategy
- Facade
- Factory
- Observer/Event
- Ports and Adapters

## Mandatory Rules

- Select only pattern(s) justified by current problem.
- Prefer one primary pattern per change.
- Document why chosen pattern is better than simpler alternatives.
- Reject speculative abstraction.

## Verification

- Design note: chosen pattern + tradeoff.
- Tests cover seam introduced by pattern.
