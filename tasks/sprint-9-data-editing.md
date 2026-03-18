---
sprint: S9
title: Data Editing
weeks: 5-6
status: Todo
depends_on: S8
---

# Sprint 9 — Data Editing

> Mục tiêu: Thêm, sửa, xóa dòng dữ liệu trực tiếp từ UI.

---

## Task 9.1 — Add New Row Backend

**File**: `internal/app/data_service.go` (new)

- [ ] Add `InsertRow(connectionID, schema, tableName string, values map[string]interface{}) (int64, error)`
- [ ] Validate values against column types
- [ ] Execute INSERT statement
- [ ] Return affected rows count

**Done when**: Backend can insert new row.

---

## Task 9.2 — Add New Row UI (Inline)

**File**: `frontend/src/components/editor/ResultTable.tsx`

- [ ] Add "Add Row" button in result toolbar
- [ ] When clicked, insert a new empty row at the top of the table
- [ ] New row cells are immediately editable (inline)
- [ ] Press Enter to save, Escape to cancel
- [ ] Submit executes INSERT and refreshes results

**Done when**: Click Add Row → new empty row appears → edit inline → save.

---

## Task 9.2b — Duplicate Selected Rows

**File**: `frontend/src/components/editor/ResultTable.tsx`

- [ ] Add "Duplicate" button in result toolbar (enabled when rows selected)
- [ ] Copy data from all selected rows
- [ ] Insert duplicate rows right below the last selected row
- [ ] Duplicate rows are immediately editable
- [ ] Press Enter to save individual rows, Escape to cancel
- [ ] Batch save all duplicates with single INSERT per row

**Done when**: Select multiple rows → Click Duplicate → duplicates appear below → save.

---

## Task 9.3 — Delete Row Backend

**File**: `internal/app/data_service.go`

- [ ] Add `DeleteRow(connectionID, schema, tableName string, primaryKeys map[string]interface{}) (int64, error)`
- [ ] Build DELETE WHERE with primary key values
- [ ] Return affected rows count
- [ ] Handle tables without primary key (use all columns)

**Done when**: Backend can delete row by PK.

---

## Task 9.4 — Delete Row UI Refinement

**File**: `frontend/src/components/editor/ResultTable.tsx`

- [ ] Add "Delete Selected Rows" button
- [ ] Use inline toast notification for confirmation (no popup/modal)
- [ ] Toast shows: "Delete X row(s)? [Undo] [Confirm]" with 5s timeout
- [ ] Execute delete and refresh results after confirm
- [ ] Handle pending state for deleted rows

**Done when**: Select rows → Delete → inline toast confirm → rows removed.

---

## Task 9.5 — Bulk Delete

**File**: `frontend/src/components/editor/ResultTable.tsx`

- [ ] Support selecting multiple rows (already exists)
- [ ] Bulk delete executes single DELETE with IN clause or multiple DELETEs
- [ ] Show progress for large deletions
- [ ] Rollback on error

**Done when**: Can delete 100+ rows in one operation.

---

## Task 9.6 — Cell Edit Enhancement

**File**: `frontend/src/components/editor/ResultTable.tsx`

- [ ] Improve cell editing UX:
  - Escape to cancel edit
  - Enter to confirm
  - Tab to next cell
- [ ] Add validation for column types
- [ ] Show error toast on validation failure

**Done when**: Keyboard-driven cell editing works smoothly.

---

## Task 9.7 — Optimistic UI Update

**File**: `frontend/src/stores/resultStore.ts`

- [ ] After successful UPDATE/INSERT/DELETE, update local state immediately
- [ ] No need to re-fetch entire result set
- [ ] Handle conflicts gracefully (refresh if stale)

**Done when**: Changes reflect immediately without full reload.

---

## Smoke Test Sprint 9

```bash
go build ./...
cd frontend && npm run build
```

- [ ] Add Row button opens form with correct columns
- [ ] Submit adds row, result table refreshes
- [ ] Select row → Delete shows confirmation
- [ ] Confirm deletes row from table
- [ ] Select multiple rows → Bulk delete works
- [ ] Cell edit: Escape cancels, Enter confirms
