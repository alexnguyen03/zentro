---
sprint: S9
title: Data Editing
weeks: 5-6
status: In Progress
depends_on: S8
---

# Sprint 9 - Data Editing

> Goal: finish the missing inline data-editing features on top of the existing legacy SQL execution flow.

---

## Task 9.1 - Add New Row Backend

**Scope note**: no new `internal/app/data_service.go` was introduced in this sprint. Inserts reuse the existing `ExecuteUpdateSync` path and generated SQL from the frontend.

- [x] Reuse the existing SQL execution path for inserts
- [x] Let invalid values fail at execute time and surface the backend error in the result flow
- [x] Generate one `INSERT` statement per draft row
- [x] Return to optimistic UI update instead of forcing a refetch

**Done when**: Inline add/duplicate can save through the legacy execution path without a new backend CRUD service.

---

## Task 9.2 - Add New Row UI (Inline)

**Files**: `frontend/src/components/editor/ResultPanel.tsx`, `frontend/src/components/editor/ResultTable.tsx`

- [x] Show `Add Row` action in the result UI
- [x] Insert a new draft row at the top of the table
- [x] Prefill draft values from column defaults when available
- [x] Focus the first editable cell immediately
- [x] Support `Enter` to save and `Escape` to remove the unsaved draft row
- [x] Save through generated `INSERT` SQL and update the table optimistically

**Done when**: Click `Add Row` -> draft row appears -> edit inline -> save without full reload.

---

## Task 9.2b - Duplicate Selected Rows

**Files**: `frontend/src/components/editor/ResultPanel.tsx`, `frontend/src/components/editor/ResultTable.tsx`

- [x] Show `Duplicate` action when persisted rows are selected
- [x] Copy data from all selected persisted rows
- [x] Insert duplicate draft rows below the last selected source row
- [x] Keep duplicated values, including primary key values
- [x] Focus the first duplicated draft row for immediate editing
- [x] Keep duplicated draft rows pending until the shared `Save` action executes

**Done when**: Select rows -> click `Duplicate` -> draft copies appear below -> save once with the shared `Save` action.

---

## Task 9.3 - Delete Row Backend

**Scope note**: no new delete backend service was added. Delete statements are still generated from the frontend and executed by `ExecuteUpdateSync`.

- [x] Reuse the existing SQL execution path for deletes
- [x] Build one `DELETE` statement per selected row using primary keys
- [x] Execute deletes from the same generated update script as edits
- [x] Keep read-only protection when a result cannot be safely updated

**Done when**: Pending deletes can be confirmed from the save flow without adding a new backend CRUD endpoint.

---

## Task 9.4 - Delete Row UI Refinement

**Files**: `frontend/src/components/editor/ResultPanel.tsx`, `frontend/src/components/editor/ResultTable.tsx`

- [x] Mark selected persisted rows as pending delete with the `Delete` key
- [x] Remove selected draft rows immediately with the same shortcut
- [x] Keep pending-delete styling in the grid until save/discard
- [x] Only execute deletes when the user saves from the result panel
- [x] Use the existing save modal as the confirmation step before execution

**Done when**: Select rows -> press `Delete` -> rows stay pending -> save/`Ctrl+S` opens confirmation -> execute.

---

## Task 9.5 - Bulk Delete

**Files**: `frontend/src/components/editor/ResultPanel.tsx`, `frontend/src/stores/resultStore.ts`

- [x] Keep multi-row selection for delete
- [x] Generate one SQL script containing multiple `DELETE` statements
- [x] Execute bulk delete in one save operation
- [x] Apply optimistic row removal after successful execution

**Done when**: Large row selections can be deleted in one save cycle without a forced rerun.

---

## Task 9.6 - Cell Edit Enhancement

**Files**: `frontend/src/components/editor/ResultTable.tsx`, `frontend/src/components/sidebar/RowDetailSidebar.tsx`

- [x] `Escape` cancels inline edits and removes unsaved draft rows
- [x] `Enter` confirms inline edits without executing SQL immediately
- [x] `Tab` and `Shift+Tab` move between editable cells in the same row
- [x] UI no longer blocks invalid values before execute
- [x] Invalid input is delegated to backend execution errors
- [x] Row detail editing follows the same no-prevalidation behavior as table editing

**Done when**: Keyboard-driven editing works consistently and execution errors surface from the backend path.

---

## Task 9.7 - Optimistic UI Update

**File**: `frontend/src/stores/resultStore.ts`

- [x] Persist pending edits, deletions, and draft rows in result state
- [x] Apply successful updates and deletes locally after save
- [x] Append successful inserts locally after save
- [x] Avoid a full result rerun for normal happy-path edits

**Done when**: Saved changes show up immediately in the current result set.

---

## Smoke Test Sprint 9

```bash
go build ./...
cd frontend && npm run build
```

- [x] `go build ./...`
- [x] `cd frontend && npm run build`
- [ ] Add Row creates a top draft row with metadata defaults
- [ ] Duplicate creates draft rows below the last selected source row
- [ ] `Delete` marks persisted rows pending and removes selected draft rows
- [ ] `Save` / `Ctrl+S` executes add-only changes directly and confirms update/delete changes
- [ ] Cell edit: `Escape` cancels, `Enter` confirms, `Tab` moves focus
