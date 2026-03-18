---
sprint: S11
title: Search & Filter
weeks: 9
status: Todo
depends_on: S10
---

# Sprint 11 — Search & Filter

> Mục tiêu: Tìm kiếm trong table và schema browser.

---

## Task 11.1 — Table Search Backend

**File**: `internal/app/data_service.go`

- [ ] Add `SearchTable(connectionID, schema, tableName, searchTerm string, columns []string, limit int) (*models.QueryResult, error)`
- [ ] Generate WHERE clause with ILIKE (Postgres/MySQL) or LIKE (MSSQL)
- [ ] Search in specified columns or all text columns
- [ ] Return matching rows

**Done when**: Backend can search table data.

---

## Task 11.2 — Table Search UI

**File**: `frontend/src/components/editor/ResultFilterBar.tsx`

- [ ] Add search input in result toolbar
- [ ] Search all columns by default
- [ ] Option to select specific columns to search
- [ ] Debounce search input (300ms)
- [ ] Show result count

**Done when**: Type in search → results filter in real-time.

---

## Task 11.3 — Schema Search Backend

**File**: `internal/app/schema_service.go`

- [ ] Add `SearchObjects(connectionID, pattern string) ([]SchemaObject, error)`
- [ ] Search tables, views, functions matching pattern
- [ ] Return object type, schema, name

**Done when**: Backend returns matching schema objects.

---

## Task 11.4 — Schema Search UI

**File**: `frontend/src/components/sidebar/ConnectionTree.tsx`

- [x] Add search input at top of schema tree (lines 54-71)
- [x] Filter tree nodes as user types (lines 286-289)
- [x] Highlight matching text
- [x] Clear button to reset

**Status**: ✅ DONE - Already implemented in ConnectionTree.tsx

**Done when**: Type in search → schema tree filters.

---

## Smoke Test Sprint 11

```bash
go build ./...
cd frontend && npm run build
```

- [ ] Search in result table filters rows
- [ ] Search in sidebar filters schema objects
- [ ] Clear search restores full list
