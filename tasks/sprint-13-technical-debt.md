---
sprint: S13
title: Technical Debt & Polish
weeks: 12-13
status: Todo
depends_on: S12
---

# Sprint 13 — Technical Debt & Polish

> Mục tiêu: Giải quyết technical debt và hoàn thiện trước release.

---

## Task 13.1 — Password Encryption

**File**: `internal/utils/prefs.go`

- [ ] Replace base64 encoding with AES-GCM encryption
- [ ] Use keyring for storing encryption key
- [ ] Migrate existing passwords safely
- [ ] Add "Encrypt password" option in connection form

**Done when**: Passwords stored securely, not just encoded.

---

## Task 13.2 — Error Logging Middleware

**File**: `frontend/src/stores/logger.ts`

- [ ] Create Zustand middleware for error logging
- [ ] Log all state changes and errors
- [ ] Integrate with existing logger
- [ ] Add error boundary in React

**Done when**: All errors logged with stack traces.

---

## Task 13.3 — Unit Tests - Backend

**File**: Various

- [ ] Add unit tests for `internal/db/executor.go`
- [ ] Add unit tests for `internal/app/query_service.go`
- [ ] Add unit tests for driver interfaces
- [ ] Target: 60% coverage minimum

**Done when**: Backend has test coverage.

---

## Task 13.4 — Unit Tests - Frontend

**File**: `frontend/src/**/*.test.tsx`

- [ ] Add tests for `editorStore.ts`
- [ ] Add tests for `resultStore.ts`
- [ ] Add tests for key components
- [ ] Use Vitest + React Testing Library

**Done when**: Frontend has test coverage.

---

## Task 13.5 — Performance Optimization

**File**: `internal/db/executor.go`

- [ ] Replace `fmt.Sprintf` with `strings.Builder` for large result sets
- [ ] Optimize row scanning with buffer pooling
- [ ] Add profiling points
- [ ] Benchmark before/after

**Done when**: Large queries 20% faster.

---

## Task 13.6 — Connection Store Import Fix

**File**: `frontend/src/stores/connectionStore.ts`

- [ ] Remove dependency on generated wails models
- [ ] Define TypeScript interfaces manually
- [ ] Add build-time check for Wails generation

**Done when**: Store builds without wails dev/build.

---

## Task 13.7 — Global Event Emitter Refactor

**File**: `internal/app/app.go`

- [ ] Replace global `emitEvent` variable with dependency injection
- [ ] Use interface for event emitter
- [ ] Make code testable without Wails runtime

**Done when**: Event system is mockable for tests.

---

## Task 13.8 — Release Build & Packaging

**File**: `build/`

- [ ] Ensure builds for Windows, macOS, Linux
- [ ] Test installer packages
- [ ] Verify all features work in production build
- [ ] Update version to v0.2.0-beta

**Done when**: Release builds successfully.

---

## Task 13.9 — Release Notes

**File**: `RELEASE_NOTES.md`

- [ ] Document all new features in Beta 2
- [ ] List known limitations
- [ ] Add migration guide from Beta 1
- [ ] Update CHANGELOG.md

**Done when**: Release notes complete.

---

## Smoke Test Sprint 13

```bash
go build ./...
go test ./...
cd frontend && npm run build && npm run test
```

- [ ] All unit tests pass
- [ ] Production build works
- [ ] No console errors in production
- [ ] Release notes accurate
