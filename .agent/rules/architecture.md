---
trigger: always_on
---

# Architecture Rules

These rules define the architectural standards for the Zentro project.
All generated or modified code MUST follow these guidelines.

---

# 1. Architectural Principles

The project must follow these core principles:

- Maintain **modular architecture**
- Prefer **composition over inheritance**
- Keep components **loosely coupled**
- Ensure **high cohesion**
- Write **testable and maintainable code**

Every module must have a **clear responsibility**.

---

# 2. SOLID Principles (Mandatory)

All implementations must follow SOLID.

## Single Responsibility Principle (SRP)

Each component should have only one responsibility.

Examples:

GOOD
- QueryExecutor handles query execution
- HistoryRepository handles history persistence

BAD
- QueryManager that executes queries, saves history, and logs errors

---

## Open/Closed Principle (OCP)

Components should be open for extension but closed for modification.

Prefer:

- interfaces
- composition
- strategy pattern

Avoid modifying existing stable components when adding new behavior.

---

## Liskov Substitution Principle (LSP)

Derived types must be replaceable for their base abstractions.

Interfaces must represent **true capabilities**.

Avoid "fake interfaces" created only to satisfy architecture.

---

## Interface Segregation Principle (ISP)

Prefer **small focused interfaces** instead of large ones.

GOOD

QueryRunner
HistoryStore

BAD

DatabaseManager
(with 10+ unrelated methods)

---

## Dependency Inversion Principle (DIP)

High level modules must not depend on low level modules.

Depend on **interfaces**, not implementations.

Example:

QueryService
depends on
QueryRepository interface

---

# 3. Project Layering

The codebase should follow layered separation.

Typical structure:

internal/
    domain/
    service/
    repository/
    infrastructure/
    ui/

Layer responsibilities:

Domain
- core entities
- pure business logic

Service
- orchestration
- use cases

Repository
- data persistence abstraction

Infrastructure
- database
- filesystem
- external integrations

UI
- Fyne UI components
- user interaction logic

UI must never contain business logic.

---

# 4. Design Patterns

When appropriate, prefer established patterns.

Common patterns used in this project:

Repository
- database abstraction

Factory
- object creation logic

Strategy
- interchangeable algorithms

Adapter
- adapting external APIs

Dependency Injection
- decoupling modules

Patterns must be used **only when they improve clarity**.

Avoid unnecessary complexity.

---

# 5. Code Structure Rules

Functions should be:

- small
- focused
- readable

Recommended limits:

Function length
< 40 lines

File size
< 400 lines

Avoid:

- deep nesting
- large switch statements
- complex condition chains

---

# 6. Error Handling

Errors must be:

- explicit
- propagated upward
- meaningful

Avoid silent failures.

Use structured error messages.

---

# 7. Logging

Logging must be:

- structured
- contextual
- non-intrusive

Logging should not pollute domain logic.

Prefer centralized logging utilities.

---

# 8. Anti-Patterns (Must Avoid)

The following are prohibited:

God objects
Large utility classes
Tightly coupled modules
Business logic inside UI
Duplicated logic across modules

If duplication appears, extract reusable abstractions.

---

# 9. Refactoring Policy

When adding features:

- prefer extending existing abstractions
- avoid breaking existing APIs
- refactor when complexity grows

If code becomes difficult to understand,
refactor before adding more logic.

---

# 10. Architectural Integrity

Before finalizing any change, verify:

- SOLID principles are respected
- layering is preserved
- no tight coupling introduced
- responsibilities remain clear

Architecture quality is more important than quick implementation.