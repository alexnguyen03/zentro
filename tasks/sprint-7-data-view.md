---
sprint: S7
title: Data Viewing & Export
weeks: 1-2
status: Todo
depends_on: S6
---

# Sprint 7 — Data Viewing & Export

> Mục tiêu: Hiển thị dữ liệu phức tạp (JSON, BLOB, datetime) và export ra nhiều format.

---

## Task 7.1 — JSON Viewer Component

**File**: `frontend/src/components/viewers/JsonViewer.tsx`

- [ ] Create `JsonViewer` component with syntax highlighting
- [ ] Add collapse/expand for nested objects
- [ ] Add copy to clipboard button
- [ ] Detect JSON in cell and render with this component

**Done when**: JSON cells show formatted, collapsible view.

---

## Task 7.2 — BLOB/Image Viewer

**File**: `frontend/src/components/viewers/BlobViewer.tsx`

- [ ] Detect image types (png, jpg, gif, webp) from MIME or extension
- [ ] Render image preview for small images
- [ ] Show "Binary data (X bytes)" for non-image blobs
- [ ] Add download button for binary data

**Done when**: Image cells show preview, other blobs show size.

---

## Task 7.3 — DateTime Formatting

**File**: `frontend/src/components/editor/ResultTable.tsx`

- [ ] Add cell renderer for date/time types
- [ ] Format based on column type: date, time, datetime, timestamp
- [ ] Add setting for custom date format preference

**Done when**: Datetime cells show formatted (e.g., "2024-01-15 14:30:00").

---

## Task 7.4 — Export JSON Backend

**File**: `internal/app/app.go` or new `internal/app/export_service.go`

- [ ] Add `ExportJSON(result *models.QueryResult) ([]byte, error)`
- [ ] Handle nested JSON arrays/objects properly
- [ ] Return formatted JSON with proper indentation

**Done when**: Backend can generate JSON export data.

---

## Task 7.5 — Export JSON Frontend

**File**: `frontend/src/stores/resultStore.ts`  
**File**: `frontend/src/components/toolbar/ExportMenu.tsx`

- [ ] Add export JSON button in export menu
- [ ] Call backend to get JSON data
- [ ] Trigger file download with `.json` extension

**Done when**: User can export results to JSON file.

---

## Task 7.6 — Export SQL INSERT Backend

**File**: `internal/app/export_service.go`

- [ ] Add `ExportSQLInsert(result *models.QueryResult, tableName string) (string, error)`
- [ ] Generate INSERT INTO statements for each row
- [ ] Handle proper escaping for SQL strings
- [ ] Support different SQL dialects (Postgres, MSSQL, MySQL)

**Done when**: Backend generates valid INSERT statements.

---

## Task 7.7 — Export SQL INSERT Frontend

**File**: `frontend/src/components/toolbar/ExportMenu.tsx`

- [ ] Add "Export as SQL INSERT" option in export menu
- [ ] Show dialog to input table name (or auto-detect)
- [ ] Trigger file download with `.sql` extension

**Done when**: User can export results as INSERT statements.

---

## Task 7.8 — Wire Export Menu

**File**: `frontend/src/components/toolbar/Toolbar.tsx`

- [ ] Consolidate export options into dropdown menu
- [ ] Options: CSV (existing), JSON, SQL INSERT
- [ ] Disable when no results

**Done when**: Single export button with dropdown for format selection.

---

## Smoke Test Sprint 7

```bash
go build ./...
cd frontend && npm run build
```

- [ ] JSON column shows formatted, collapsible view
- [ ] Image column shows thumbnail preview
- [ ] Datetime column shows formatted date
- [ ] Export JSON downloads valid JSON file
- [ ] Export SQL INSERT downloads valid .sql file
