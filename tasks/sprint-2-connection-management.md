---
sprint: S2
title: Connection Management
weeks: 2-3
status: Done ✅
skill_refs:
  - skills/02-connection-management/SKILL.md
depends_on: S1
---

# Sprint 2 — Connection Management ✅

> Mục tiêu: Tạo/edit/xóa connection profiles, test connection, kết nối DB, cập nhật UI state.  
> **Completed: 2026-03-02**

---

## Task 2.1 — BuildConnectionString ✅

**File**: `internal/db/connector.go`

- [x] Postgres DSN: `postgres://user:pass@host:port/db?sslmode=X&connect_timeout=X`
- [x] SQL Server DSN: `sqlserver://user:pass@host:port?database=db&connection+timeout=X`
- [x] `url.QueryEscape` cho username/password
- [x] Return `""` + driver không hợp lệ được handle

---

## Task 2.2 — OpenConnection ✅

**File**: `internal/db/connector.go`

- [x] `sql.Open(driverName, dsn)` — "pgx" cho postgres, "sqlserver" cho mssql
- [x] Pool config: MaxOpenConns(10), MaxIdleConns(5), ConnMaxLifetime(5m), ConnMaxIdleTime(2m)
- [x] Error wrapping với `fmt.Errorf`

---

## Task 2.3 — TestConnection ✅

**File**: `internal/db/connector.go`

- [x] PingContext với 10s timeout
- [x] `friendlyError()` map technical errors → thông báo thân thiện:
  - authentication failed
  - connection refused
  - host not found
  - timeout
  - database not found

---

## Task 2.4 — SaveConnections & LoadConnections ✅

**File**: `internal/utils/prefs.go`

- [x] Base64 encode password khi `SavePassword=true`, xóa khi `false`
- [x] Load: decode base64 đúng
- [x] `DeleteConnection` filter + re-save
- [x] Verified: profiles persist qua app restart

---

## Task 2.5 — Connection Dialog UI ✅

**File**: `internal/ui/connection/dialog.go`

- [x] `ShowConnectionDialog(parent, existing, existingNames, onSave)`
- [x] `widget.Form` với tất cả fields của `ConnectionProfile`
- [x] Driver `OnChanged`: postgres → port 5432 + enable SSL; sqlserver → port 1433 + disable SSL
- [x] "Test Connection" → goroutine → `db.TestConnection()` → status label inline
- [x] Validation: required fields, port 1–65535, unique name
- [x] `dialog.NewCustom` (không tạo window mới)
- [x] "Save" với `widget.HighImportance` styling

---

## Task 2.6 — Connection List Widget ✅

**File**: `internal/ui/connection/list.go`

- [x] `ConnectionListWidget` với `widget.List`
- [x] Format hiển thị: `[driver]  Name` (1 dòng, gọn)
- [x] Double-tap detection (400ms threshold) → `onConnect`
- [x] `Refresh(profiles)` để reload list
- [x] Connect/Edit/Delete buttons (disabled cho đến khi select)
- [x] Delete với `dialog.NewConfirm`
- [x] `Widget()` trả về `container.NewBorder` với title + actions

---

## Task 2.7 — Wire vào Main Window ✅

**File**: `internal/ui/mainwindow.go`

- [x] `ConnectionListWidget` field trong `AppState`
- [x] `container.NewHSplit(connList, placeholder)` với Offset=0.18
- [x] "New Connection" button → `ShowConnectionDialog` → save + refresh list
- [x] `onConnect` callback → goroutine → `OpenConnection + TestConnection` → `OnConnectionChanged`
- [x] `onEdit` callback → `ShowConnectionDialog` pre-filled → update + save
- [x] `onDelete` callback → `DeleteConnection` → filter slice → refresh
- [x] `OnConnectionChanged`: enable "New Query", update status bar
- [x] Status bar: `⬤ Name (driver)` + `host…:port` (truncated)
- [x] `truncateHost(host, 24)` helper

---

## Smoke Test Sprint 2 ✅

- [x] "New Connection" mở dialog
- [x] Driver switch postgres ↔ sqlserver → port đổi đúng, SSL enable/disable
- [x] Test Connection thành công hiển thị "✓ Connection successful!"
- [x] Save → profile xuất hiện trong connection list sidebar
- [x] Restart app → profiles persist
- [x] Double-click profile → kết nối → status bar cập nhật
- [x] Connect thành công → "New Query" button enabled
- [x] Status bar: `⬤ vno (postgres)` + truncated host:port
- [x] Delete → confirm dialog → profile biến mất

## Ghi chú thực tế

- `fyne.Do()` không tồn tại trong Fyne v2.5 — thay bằng direct calls (widget SetText/Enable thread-safe)
- List item ban đầu dùng 2 dòng hiển thị hostname → overflow; đã fix sang 1 dòng `[driver]  Name`
- Status bar ban đầu hiển thị full host URL → overflow; đã fix dùng `truncateHost(24)` + format ngắn
