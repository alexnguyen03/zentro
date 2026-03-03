---
name: go-fyne-sql-client-definition
description: >
  Index tổng quan cho tất cả skills của dự án Zentro — một desktop SQL client
  viết bằng Go + Fyne v2. Đọc file này trước để xác định skill cần dùng,
  sau đó đọc SKILL.md tương ứng trong thư mục skill đó.
---

# Zentro Skills Index

**Stack**: Go 1.22+ · Fyne v2 · PostgreSQL (pgx/v5) · MSSQL (go-mssqldb)  
**MVP target**: Startup < 1s · RAM idle < 100MB · Binary < 30MB · Windows + macOS

---

## Skills Map

| # | Skill | Mô tả ngắn | Đọc khi... |
|---|---|---|---|
| [01](../01-project-architecture/SKILL.md) | Project Architecture | Folder structure, dependency rules, naming, go.mod | Bắt đầu dự án hoặc tạo file mới |
| [02](../02-connection-management/SKILL.md) | Connection Management | ConnectionProfile struct, connector API, persistence, dialog UI | Làm việc với kết nối DB |
| [03](../03-async-query-execution/SKILL.md) | Async Query Execution | ExecuteQuery channel pattern, goroutine → UI thread rules | Implement query execution |
| [04](../04-multi-tab-editor/SKILL.md) | Multi-Tab Editor | TabState, DocTabs, Ctrl+Enter shortcut, unsaved prompt | Implement query editor tabs |
| [05](../05-result-grid/SKILL.md) | Result Grid | widget.Table, multi-select, batch edit flow, pagination | Implement result table |
| [06](../06-ui-layout-app-state/SKILL.md) | UI Layout & AppState | AppState singleton, NewBorder layout, toolbar, status bar, main.go wiring | Xây dựng main window |
| [07](../07-export-and-history/SKILL.md) | Export & History | ExportToCSV, HistoryEntry, AppendHistory, history panel UI | Implement export hoặc history |
| [08](../08-preferences-settings/SKILL.md) | Preferences & Settings | Pref keys, read/write helpers, settings dialog, ApplyPreferences | Implement settings |
| [09](../09-logging/SKILL.md) | Logging | slog setup, log patterns, MultiHandler, inject vào AppState | Thêm logging |
| [10](../10-cross-platform-build/SKILL.md) | Cross-Platform Build | go build flags, fyne package, fyne-cross, size optimization | Build release binary |

---

## Fyne Threading — Nhắc Nhanh

> Chi tiết đầy đủ trong [Skill 03](../03-async-query-execution/SKILL.md).

- `widget.SetText()` / `Refresh()` → **thread-safe** ✅ — gọi trực tiếp từ goroutine
- `container.Add()` / `tabs.Append()` / tạo widget mới → **KHÔNG thread-safe** ❌ — dùng `fyne.Do(func(){...})`

## Dependency Rules — Nhắc Nhanh

> Chi tiết đầy đủ trong [Skill 01](../01-project-architecture/SKILL.md).

```
models ← db ← ui ← main.go
models ← utils ← ui
```

`db` không bao giờ import `ui`. `models` không import gì ngoài stdlib.
