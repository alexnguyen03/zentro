# Architecture Overview

Pattern: Clean Architecture (adapted)

Layers:
- UI (Wails / React Frontend)
- Application (use-cases, services)
- Domain (business logic)
- Infrastructure (DB, API)

## Rules

- UI must not access DB directly
- Business logic lives in domain layer
- Side effects must be isolated
- Shared logic must be reusable

## Data Flow

UI → Application → Domain → Infrastructure
