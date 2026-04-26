---
sprint: S10
title: Query Features
weeks: 7-8
status: In Progress
depends_on: S9
---

# Sprint 10 - Query Features

> Muc tieu: Transaction control, multiple result sets, EXPLAIN support, nhung van giu nguyen legacy query editor / result flow da co.

## Scope decisions for this sprint

- Multi-statement results mo thanh sibling read-only query tabs, khong dung sub-tab ben trong `ResultPanel`.
- Statement dau tien van render tren tab query goc de giu continuity voi legacy flow.
- EXPLAIN / EXPLAIN ANALYZE mo trong tab moi, hien ket qua dang table/json, chua lam visual execution tree.
- Sprint 9 data editing chi cho phep o result set tren tab co the edit; generated result tabs la read-only.

---

## Task 10.1 - Transaction Control Backend

Files:
- `internal/app/transaction_service.go`
- `internal/app/app.go`
- `internal/app/connection_service.go`

Progress:
- [x] Add `BeginTransaction() error`
- [x] Add `CommitTransaction() error`
- [x] Add `RollbackTransaction() error`
- [x] Add `GetTransactionStatus() (string, error)`
- [x] Store one active transaction alongside the active connection
- [x] Emit `transaction:status` for frontend sync
- [x] Auto-rollback active transaction on disconnect / reconnect / switch database / shutdown

Notes:
- Status values used by UI: `none`, `active`, `error`
- Begin while active and commit/rollback without active transaction return clean errors for the UI

Done when:
- Backend can manage a single active transaction for the current connection.

---

## Task 10.2 - Transaction-Aware Query Execution

Files:
- `internal/app/query_service.go`
- `internal/app/app.go`

Progress:
- [x] Add executor abstraction so query execution can use `*sql.DB` or active `*sql.Tx`
- [x] Route `SELECT` through transaction executor when transaction is active
- [x] Route non-`SELECT` through transaction executor when transaction is active
- [x] Route `ExecuteUpdateSync` through transaction executor when transaction is active
- [x] Keep existing single-query chunk / done event flow compatible

Notes:
- Metadata fetch for editable table info still uses base DB connection
- Row count queries now also use the current executor, so they can see uncommitted rows inside a transaction

Done when:
- Queries and save scripts run on the same transaction when a transaction is open.

---

## Task 10.3 - Transaction UI

Files:
- `frontend/src/components/layout/Toolbar.tsx`
- `frontend/src/components/layout/StatusBar.tsx`
- `frontend/src/stores/statusStore.ts`
- `frontend/src/lib/events.ts`

Progress:
- [x] Add toolbar actions: Begin / Commit / Rollback
- [x] Disable actions based on connection and transaction state
- [x] Show `TX: none|active|error` in the status bar
- [x] Sync toolbar/status with backend transaction events

Notes:
- Errors surface through existing toast flow
- Running queries while transaction is active still uses normal Run / Cancel UX

Done when:
- User can begin, commit, rollback, and see live transaction state.

---

## Task 10.4 - Multiple Result Sets Backend

Files:
- `internal/db/executor.go`
- `internal/app/query_service.go`

Progress:
- [x] Add SQL statement splitter that ignores semicolons inside strings/comments
- [x] Execute multi-statement SQL sequentially in order
- [x] Emit statement metadata: `sourceTabID`, `statementIndex`, `statementCount`, `statementText`
- [x] Keep previous statement results visible if a later statement fails
- [x] Stop executing subsequent statements after the first failure
- [x] Keep pagination tied to each statement result tab ID

Notes:
- Additional statements use deterministic generated tab IDs: `source::result:N`
- Non-select statements emit `query:done` without chunk rows

Done when:
- `SELECT 1; SELECT 2` produces two ordered result payloads and two visible result tabs.

---

## Task 10.5 - Multiple Result Sets UI

Files:
- `frontend/src/App.tsx`
- `frontend/src/stores/editorStore.ts`
- `frontend/src/components/editor/QueryTabs.tsx`
- `frontend/src/components/editor/QueryGroup.tsx`
- `frontend/src/components/editor/MonacoEditor.tsx`
- `frontend/src/components/editor/ResultPanel.tsx`

Progress:
- [x] Auto-create read-only generated query tabs for statement 2..n
- [x] Keep generated result tabs in the same group as the source query tab
- [x] Preserve current active tab instead of stealing focus while background result tabs are created
- [x] Reuse existing `ResultPanel` render path for generated tabs
- [x] Keep source query tab bound to the first result set
- [x] Show non-select result summaries in generated tabs

Notes:
- Chosen implementation differs from old task text: separate tabs instead of in-panel result sub-tabs
- Generated result tabs are cleaned up and recreated on the next execution of the source query

Done when:
- Multi-statement query execution opens deterministic sibling result tabs without breaking legacy single-result flow.

---

## Task 10.6 - EXPLAIN Support Backend

Files:
- `internal/app/query_service.go`
- `internal/app/app.go`

Progress:
- [x] Add `ExplainQuery(tabID, query string, analyze bool) error`
- [x] Build dialect-specific EXPLAIN SQL
- [x] Reuse the main query execution pipeline for EXPLAIN runs
- [x] Return clear unsupported errors for unsupported dialect/mode combinations

Driver notes:
- [x] PostgreSQL: `EXPLAIN (FORMAT JSON)` and `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`
- [x] MySQL: `EXPLAIN FORMAT=JSON` and `EXPLAIN ANALYZE`
- [x] SQLite: `EXPLAIN QUERY PLAN`, analyze unsupported
- [x] SQL Server: explicit unsupported for this sprint to avoid broken multi-batch SHOWPLAN behavior

Done when:
- Backend can execute EXPLAIN in the same result pipeline or return a clear unsupported error.

---

## Task 10.7 - EXPLAIN UI

Files:
- `frontend/src/components/layout/Toolbar.tsx`
- `frontend/src/components/editor/MonacoEditor.tsx`
- `frontend/src/components/editor/QueryGroup.tsx`
- `frontend/src/components/editor/ResultPanel.tsx`

Progress:
- [x] Add `Explain` button
- [x] Add `Explain Analyze` button
- [x] Reuse selected text / current runnable block extraction from Monaco
- [x] Open explain results in a new read-only query tab
- [x] Reuse existing JSON viewer for single-cell JSON explain output

Notes:
- Explain tabs use deterministic IDs per source tab and mode, so reruns update the same tab
- Explain tabs keep the original SQL text for traceability while backend executes wrapped EXPLAIN SQL

Done when:
- User can trigger Explain / Explain Analyze and inspect the result in a dedicated tab.

---

## Task 10.8 - Query Plan Visualization (Optional)

File:
- `frontend/src/components/editor/ExplainView.tsx`

Progress:
- [ ] Deferred

Notes:
- Out of scope for Sprint 10 implementation
- Current sprint stops at result/json rendering

---

## Verification

Build checks:

```bash
$env:GOCACHE='d:\\coding\\personal\\zentro\\.gocache'; go build ./...
cd frontend && cmd /c npx tsc --noEmit
cd frontend && cmd /c npm run build
```

Status:
- [x] Go build passes with workspace-local `GOCACHE`
- [x] TypeScript check passes
- [x] Frontend production build passes

---

## Manual smoke test checklist

- [ ] Begin button starts transaction and status bar shows `TX: active`
- [ ] Query executed inside transaction can be committed successfully
- [ ] Query executed inside transaction can be rolled back successfully
- [ ] Begin while transaction is already active shows a clean error
- [ ] Commit / rollback without an active transaction shows a clean error
- [ ] Execute `SELECT 1; SELECT 2` and verify `Result 2` opens as a sibling read-only tab
- [ ] Execute `SELECT 1; BAD SQL; SELECT 3` and verify statement 1 stays visible while statement 3 never runs
- [ ] Explain opens a dedicated read-only tab
- [ ] Explain Analyze works on Postgres/MySQL and returns a clear unsupported error on SQLite / SQL Server
- [ ] Sprint 9 table editing still works on the original editable result tab
