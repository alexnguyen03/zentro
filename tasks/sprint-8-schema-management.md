---
sprint: S8
title: Schema Management
weeks: 3-4
status: Done
depends_on: S7
---

# Sprint 8 — Schema Management

> Mục tiêu: Cho phép tạo, xem, xóa database objects từ UI.

---

## Task 8.1 — View Table DDL Backend

**File**: `internal/app/schema_service.go` (new)

- [x] Add `GetTableDDL(connectionID, schema, tableName string) (string, error)`
- [x] Implement for PostgreSQL: query `pg_get_tabledef` or reconstruct from information_schema
- [x] Implement for MSSQL: use `sp_helptext` or build from information_schema
- [x] Implement for MySQL: use `SHOW CREATE TABLE`
- [x] Implement for SQLite: use `sqlite_master` and pragma

**Done when**: Backend returns CREATE TABLE script.

---

## Task 8.2 — View DDL Frontend

**File**: `frontend/src/components/sidebar/SchemaContextMenu.tsx`  
**File**: `frontend/src/components/modals/DDLModal.tsx`

- [x] Add "View DDL" option in table context menu
- [x] Create modal to display DDL script
- [x] Add copy to clipboard button
- [x] Add syntax highlighting for DDL (lightweight tokenizer in `src/lib/sqlHighlight.ts`)

**Done when**: Right-click table → View DDL shows CREATE script.

> Note: Context menu is inline in `ConnectionTree.tsx → CategoryNode`. Highlight uses a custom tokenizer (no Monaco/highlight.js dependency).

---

## Task 8.3 — CREATE TABLE UI Backend

**File**: `internal/app/schema_service.go`

- [x] Add `CreateTable(connectionID, schema, tableName string, columns []ColumnDef) error`
- [x] Validate column names and types
- [x] Generate proper DDL for each database
- [x] Return success or descriptive error

**Done when**: Backend can execute CREATE TABLE.

---

## Task 8.4 — CREATE TABLE UI Frontend

**File**: `frontend/src/components/modals/CreateTableModal.tsx`

- [x] Create form with table name input
- [x] Dynamic column list: add/remove columns
- [x] Column inputs: name, type (dropdown), nullable checkbox, primary key checkbox
- [x] Support for common types: INT, VARCHAR, TEXT, BOOLEAN, DATE, TIMESTAMP, DECIMAL, JSON
- [x] Validation before submit

**Done when**: User can visually create a new table.

---

## Task 8.5 — CREATE TABLE Wire

**File**: `frontend/src/components/sidebar/ConnectionTree.tsx`

- [x] Add "New Table" button in schema node
- [x] Open CreateTableModal on click
- [x] Refresh schema tree after successful creation

**Done when**: New table appears in sidebar after creation.

---

## Task 8.6 — DROP TABLE/VIEW Backend

**File**: `internal/app/schema_service.go`

- [x] Add `DropObject(connectionID, schema, objectName, objectType string) error`
- [x] objectType: "TABLE", "VIEW", "INDEX"
- [x] Add safety: require confirmation in UI first

**Done when**: Backend executes DROP statement.

---

## Task 8.7 — DROP UI Frontend

**File**: `frontend/src/components/sidebar/SchemaContextMenu.tsx`

- [x] Add "Drop Table" / "Drop View" in context menu
- [x] Show confirmation dialog with object name
- [x] Execute drop and refresh schema tree

**Done when**: Right-click → Drop removes object after confirmation.

---

## Task 8.8 — Index Management Backend

**File**: `internal/app/schema_service.go`

- [x] Add `CreateIndex(connectionID, schema, tableName, indexName string, columns []string, unique bool) error`
- [x] Add `DropIndex(connectionID, schema, indexName) error`
- [x] Add `GetIndexes(connectionID, schema, tableName) ([]IndexInfo, error)`

**Done when**: Backend can manage indexes.

---

## Task 8.9 — Index Management UI

**File**: `frontend/src/components/sidebar/TableDetails.tsx`

- [x] Show indexes section in table details
- [x] Add "Create Index" button
- [x] Add "Drop Index" in index context menu
- [x] Form: index name, columns selection, unique checkbox

**Done when**: User can create/drop indexes from sidebar.

> Note: Implemented as `IndexModal.tsx` accessible via right-click → "Manage Indexes" context menu. Full CRUD for indexes.

---

## Smoke Test Sprint 8

```bash
go build ./...
cd frontend && npm run build
```

- [x] Right-click table → View DDL shows correct CREATE script
- [x] New Table button opens form, can create table
- [x] New table appears in sidebar after creation
- [x] Right-click table → Drop removes table after confirmation
- [x] Indexes section shows in table details
- [x] Can create and drop indexes
