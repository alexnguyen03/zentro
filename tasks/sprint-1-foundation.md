---
sprint: S1
title: Foundation
weeks: 1
status: Done ✅
skill_refs:
  - skills/01-project-architecture/SKILL.md
  - skills/06-ui-layout-app-state/SKILL.md
  - skills/09-logging/SKILL.md
---

# Sprint 1 — Foundation ✅

> Mục tiêu: App khởi động được, window hiển thị, toolbar/statusbar đúng layout, logger chạy.  
> **Completed: 2026-03-02**

---

## Task 1.1 — Khởi tạo Go module ✅

**File**: `go.mod`

- [x] `go.mod` tạo thủ công với đúng dependencies
- [x] Dependencies: fyne/v2 v2.5.3, pgx/v5 v5.7.2, go-mssqldb v1.8.0
- [x] `go.sum` generate sau `go mod tidy`

---

## Task 1.2 — ConnectionProfile model ✅

**File**: `internal/models/connection.go`

- [x] Struct `ConnectionProfile` với đầy đủ fields + json tags
- [x] `NewConnectionProfile()` với defaults: postgres, localhost:5432, SSLMode disable, timeout 30

---

## Task 1.3 — QueryResult & HistoryEntry models ✅

**File**: `internal/models/query.go`

- [x] `QueryResult` struct (Columns, Rows, Affected, Duration, Err, IsSelect)
- [x] `HistoryEntry` struct với json tags

---

## Task 1.4 — Logger ✅

**File**: `internal/utils/logger.go`

- [x] `NewLogger(logToFile bool) *slog.Logger`
- [x] `multiHandler` với Enabled/Handle/WithAttrs/WithGroup
- [x] Fallback về stderr-only nếu file không mở được

---

## Task 1.5 — Preferences constants & stubs ✅

**File**: `internal/utils/prefs.go`

- [x] Tất cả `Pref*` constants (theme, font_size, default_limit, connections, query_history)
- [x] `SaveConnections` / `LoadConnections` với base64 password encode/decode
- [x] `DeleteConnection`
- [x] `ApplyPreferences` stub
- [x] `GetTheme/SetTheme`, `GetDefaultLimit/SetDefaultLimit`, `GetFontSize/SetFontSize`

---

## Task 1.6 — AppState & Main Window ✅

**File**: `internal/ui/mainwindow.go`

- [x] `AppState` struct
- [x] `buildStatusBar()` — "Not connected" + "Ready"
- [x] `buildToolbar()` — tất cả disabled trừ "New Connection"
- [x] `BuildMainWindow()` — 1280×800, SetMaster(), NewBorder layout

---

## Task 1.7 — Entry Point ✅

**File**: `cmd/zentro/main.go`

- [x] `app.NewWithID("io.zentro.app")`
- [x] Logger init, AppState init, LoadConnections
- [x] `BuildMainWindow` + `ShowAndRun`

---

## Smoke Test Sprint 1 ✅

- [x] `go build ./...` pass
- [x] Window 1280×800 mở ra
- [x] Title bar: "Zentro"
- [x] Toolbar đúng layout
- [x] "New Connection" clickable
- [x] Buttons còn lại disabled
- [x] Status bar: "Not connected" + "Ready"
- [x] Log startup xuất hiện trong stderr:
  ```
  level=INFO msg="zentro starting" version=0.1.0
  level=INFO msg="loaded connections" count=0
  level=INFO msg="main window ready"
  ```
