---
sprint: S8
title: Schema Management
weeks: 3-4
status: Todo
depends_on: S7
---

# Sprint 8 — Schema Management

> Mục tiêu: Cho phép tạo, xem, xóa database objects từ UI.

---

## Task 8.1 — View Table DDL Backend

**File**: `internal/app/schema_service.go` (new)

- [ ] Add `GetTableDDL(connectionID, schema, tableName string) (string, error)`
- [ ] Implement for PostgreSQL: query `pg_get_tabledef` or reconstruct from information_schema
- [ ] Implement for MSSQL: use `sp_helptext` or build from information_schema
- [ ] Implement for MySQL: use `SHOW CREATE TABLE`
- [ ] Implement for SQLite: use `sqlite_master` and pragma

**Done when**: Backend returns CREATE TABLE script.

---

## Task 8.2 — View DDL Frontend

**File**: `frontend/src/components/sidebar/SchemaContextMenu.tsx`  
**File**: `frontend/src/components/modals/DDLModal.tsx`

- [ ] Add "View DDL" option in table context menu
- [ ] Create modal to display DDL script
- [ ] Add copy to clipboard button
- [ ] Add syntax highlighting for DDL (reuse Monaco or highlight.js)

**Done when**: Right-click table → View DDL shows CREATE script.

---

## Task 8.3 — CREATE TABLE UI Backend

**File**: `internal/app/schema_service.go`

- [ ] Add `CreateTable(connectionID, schema, tableName string, columns []ColumnDef) error`
- [ ] Validate column names and types
- [ ] Generate proper DDL for each database
- [ ] Return success or descriptive error

**Done when**: Backend can execute CREATE TABLE.

---

## Task 8.4 — CREATE TABLE UI Frontend

**File**: `frontend/src/components/modals/CreateTableModal.tsx`

- [ ] Create form with table name input
- [ ] Dynamic column list: add/remove columns
- [ ] Column inputs: name, type (dropdown), nullable checkbox, primary key checkbox
- [ ] Support for common types: INT, VARCHAR, TEXT, BOOLEAN, DATE, TIMESTAMP, DECIMAL, JSON
- [ ] Validation before submit

**Done when**: User can visually create a new table.

---

## Task 8.5 — CREATE TABLE Wire

**File**: `frontend/src/components/sidebar/ConnectionTree.tsx`

- [ ] Add "New Table" button in schema node
- [ ] Open CreateTableModal on click
- [ ] Refresh schema tree after successful creation

**Done when**: New table appears in sidebar after creation.

---

## Task 8.6 — DROP TABLE/VIEW Backend

**File**: `internal/app/schema_service.go`

- [ ] Add `DropObject(connectionID, schema, objectName, objectType string) error`
- [ ] objectType: "TABLE", "VIEW", "INDEX"
- [ ] Add safety: require confirmation in UI first

**Done when**: Backend executes DROP statement.

---

## Task 8.7 — DROP UI Frontend

**File**: `frontend/src/components/sidebar/SchemaContextMenu.tsx`

- [ ] Add "Drop Table" / "Drop View" in context menu
- [ ] Show confirmation dialog with object name
- [ ] Execute drop and refresh schema tree

**Done when**: Right-click → Drop removes object after confirmation.

---

## Task 8.8 — Index Management Backend

**File**: `internal/app/schema_service.go`

- [ ] Add `CreateIndex(connectionID, schema, tableName, indexName string, columns []string, unique bool) error`
- [ ] Add `DropIndex(connectionID, schema, indexName) error`
- [ ] Add `GetIndexes(connectionID, schema, tableName) ([]IndexInfo, error)`

**Done when**: Backend can manage indexes.

---

## Task 8.9 — Index Management UI

**File**: `frontend/src/components/sidebar/TableDetails.tsx`

- [ ] Show indexes section in table details
- [ ] Add "Create Index" button
- [ ] Add "Drop Index" in index context menu
- [ ] Form: index name, columns selection, unique checkbox

**Done when**: User can create/drop indexes from sidebar.

---

## Smoke Test Sprint 8

```bash
go build ./...
cd frontend && npm run build
```

- [ ] Right-click table → View DDL shows correct CREATE script
- [ ] New Table button opens form, can create table
- [ ] New table appears in sidebar after creation
- [ ] Right-click table → Drop removes table after confirmation
- [ ] Indexes section shows in table details
- [ ] Can create and drop indexes
