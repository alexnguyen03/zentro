---
sprint: S10
title: Query Features
weeks: 7-8
status: Todo
depends_on: S9
---

# Sprint 10 — Query Features

> Mục tiêu: Transaction control, multiple result sets, EXPLAIN support.

---

## Task 10.1 — Transaction Control Backend

**File**: `internal/app/transaction_service.go` (new)

- [ ] Add `BeginTransaction(connectionID string) error`
- [ ] Add `CommitTransaction(connectionID string) error`
- [ ] Add `RollbackTransaction(connectionID string) error`
- [ ] Add `GetTransactionStatus(connectionID string) (string, error)` - returns "active", "none", "error"
- [ ] Store transaction state in connection context

**Done when**: Backend can manage transactions.

---

## Task 10.2 — Transaction UI Backend

**File**: `internal/app/app.go`

- [ ] Modify query execution to check for active transaction
- [ ] Use same connection for all queries within transaction
- [ ] Auto-commit disabled when transaction is active

**Done when**: Queries within transaction use same connection.

---

## Task 10.3 — Transaction Control UI

**File**: `frontend/src/components/toolbar/TransactionToolbar.tsx`

- [ ] Add transaction controls in toolbar:
  - Begin (green) - enabled when no active transaction
  - Commit (blue) - enabled when transaction active
  - Rollback (red) - enabled when transaction active
- [ ] Show transaction status indicator in status bar
- [ ] Disable when not connected

**Done when**: User can start/commit/rollback transactions from UI.

---

## Task 10.4 — Multiple Result Sets Backend

**File**: `internal/app/query_service.go`

- [ ] Modify query execution to handle multiple statements
- [ ] Return `[]*models.QueryResult` instead of single result
- [ ] Each result includes statement order

**Done when**: Execute "SELECT 1; SELECT 2" returns 2 result sets.

---

## Task 10.5 — Multiple Result Sets UI

**File**: `frontend/src/components/editor/ResultPanel.tsx`

- [ ] Add tab bar for multiple result sets
- [ ] Each tab shows: "Result 1", "Result 2", etc.
- [ ] Show "X rows affected" for non-SELECT statements
- [ ] Show messages/errors between results

**Done when**: Multiple SELECT statements show in separate tabs.

---

## Task 10.6 — EXPLAIN Support Backend

**File**: `internal/app/query_service.go`

- [ ] Add `ExplainQuery(connectionID, query string) (*models.QueryResult, error)`
- [ ] Wrap query with EXPLAIN (or EXPLAIN ANALYZE based on setting)
- [ ] Handle dialect differences:
  - PostgreSQL: `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`
  - MSSQL: `SET SHOWPLAN_TEXT ON; query`
  - MySQL: `EXPLAIN FORMAT=JSON`

**Done when**: Backend returns EXPLAIN results.

---

## Task 10.7 — EXPLAIN UI

**File**: `frontend/src/components/toolbar/QueryToolbar.tsx`

- [ ] Add "Explain" button in query toolbar
- [ ] Add "Explain Analyze" option
- [ ] Execute EXPLAIN and show results in new tab
- [ ] For JSON results, format nicely

**Done when**: User can see query execution plan.

---

## Task 10.8 — Query Plan Visualization (Optional)

**File**: `frontend/src/components/editor/ExplainView.tsx`

- [ ] Parse EXPLAIN JSON output
- [ ] Show execution tree visualization
- [ ] Highlight expensive operations
- [ ] Show timing information

**Done when**: EXPLAIN shows visual execution plan.

---

## Smoke Test Sprint 10

```bash
go build ./...
cd frontend && npm run build
```

- [ ] Begin button starts transaction, indicator turns green
- [ ] Run query → executes in transaction
- [ ] Commit ends transaction, indicator turns gray
- [ ] Rollback ends transaction, discards changes
- [ ] Execute "SELECT 1; SELECT 2" shows 2 result tabs
- [ ] Explain button shows execution plan
