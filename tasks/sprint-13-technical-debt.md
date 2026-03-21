---
sprint: S13
title: Technical Debt & Polish
weeks: 12-13
status: In Progress
depends_on: S12
---

# Sprint 13 - Technical Debt & Polish

> Muc tieu: Giai quyet technical debt va hoan thien truoc release.

---

## Task 13.1 - Password Encryption

**File**: `internal/utils/prefs.go`

- [x] Replace base64 encoding with AES-GCM encryption
- [x] Use keyring for storing encryption key
- [x] Migrate existing passwords safely
- [x] Add "Encrypt password" option in connection form

**Done when**: Passwords stored securely, not just encoded.

---

## Task 13.2 - Error Logging Middleware

**File**: `frontend/src/stores/logger.ts`

- [x] Create Zustand middleware for error logging
- [x] Log state changes and errors in instrumented stores
- [x] Integrate with shared frontend logger
- [x] Add error boundary in React

**Done when**: Logged errors include stack traces.

---

## Task 13.3 - Unit Tests - Backend

**File**: Various

- [x] Add unit tests for `internal/db/executor.go`
- [x] Add unit tests for `internal/app/query_service.go`
- [x] Add tests for driver interfaces/contracts
- [x] Coverage reported (soft gate)

**Done when**: Backend test coverage and benchmarks available.

---

## Task 13.4 - Unit Tests - Frontend

**File**: `frontend/src/**/*.test.tsx`

- [x] Add tests for `editorStore.ts`
- [x] Add tests for `resultStore.ts`
- [x] Add tests for error boundary + logger middleware
- [x] Use Vitest + React Testing Library

**Done when**: Frontend test pipeline runs with coverage report.

---

## Task 13.5 - Performance Optimization

**File**: `internal/db/executor.go`

- [x] Replace `fmt.Sprintf` hot path with builder in pagination fallback
- [x] Optimize row scanning with buffer pooling
- [x] Add profiling points/logging in query stream path
- [x] Add benchmark cases for key paths

**Done when**: Query hot path allocations reduced and benchmark baseline added.

---

## Task 13.6 - Connection Store Import Fix

**File**: `frontend/src/stores/connectionStore.ts`

- [x] Remove dependency on generated wails models in store
- [x] Define TypeScript interface manually (`src/types/connection.ts`)
- [x] Add build-time Wails model check

**Done when**: Store decoupled from generated model import.

---

## Task 13.7 - Global Event Emitter Refactor

**File**: `internal/app/app.go`

- [x] Replace global `emitEvent` variable with dependency injection
- [x] Use interface for event emitter
- [x] Make code testable without Wails runtime

**Done when**: Event system is mockable for tests.

---

## Task 13.8 - Release Build & Packaging

**File**: `build/`

- [x] Add release matrix build script for Windows, macOS, Linux
- [ ] Validate installer packages on all target OS (pending environment)
- [x] Verify production build command in current environment
- [x] Update version to v0.2.0-beta metadata

**Done when**: Release build flow is scripted and validated as far as environment allows.

---

## Task 13.9 - Release Notes

**File**: `RELEASE_NOTES.md`

- [x] Document new features in Beta 2
- [x] List known limitations
- [x] Add migration guide from Beta 1
- [x] Update CHANGELOG.md

**Done when**: Release notes complete.

---

## Smoke Test Sprint 13

```bash
go build ./...
go test ./...
cd frontend && npm run check:wails-models && npm run build && npm run test
```

- [x] Backend tests pass
- [x] Production frontend build works
- [x] Frontend test suite runs with coverage
- [x] Release notes updated
- [ ] No console errors in production (requires manual runtime QA)
