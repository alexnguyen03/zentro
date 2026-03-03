# Zentro Migration Checklist
> **Stack**: Wails v2 + React 18 + TypeScript + **Monaco Editor** + TanStack Table + Zustand  
> **Rule**: Checklist chỉ được **thêm** items, không sửa/xóa. Check `[x]` khi done.

---

## Phase 1 — Core Migration

### 1.1 Wails Scaffold
- [x] Cài Wails CLI (`go install github.com/wailsapp/wails/v2/cmd/wails@latest`)
- [x] `wails init` với template `react-ts` vào thư mục dự án
- [ ] Verify `wails dev` boots thành công (blank React app)

### 1.2 Remove Fyne
- [x] Xóa `internal/ui/` (toàn bộ thư mục)
- [x] Remove `fyne.io/fyne/v2` khỏi `go.mod` + `go.sum`
- [x] `go mod tidy` — không còn Fyne dependency
- [x] Xóa `zentro.exe` cũ (Fyne binary)

### 1.3 Rewrite `utils/prefs.go`
- [x] Bỏ `fyne.App` param khỏi tất cả function signatures
- [x] Storage: `os.UserConfigDir()/zentro/config.json`
- [x] `LoadPreferences() (*Preferences, error)`
- [x] `SavePreferences(p *Preferences) error`
- [x] `LoadConnections()` và `SaveConnections()` không cần `fyne.App`
- [x] Password base64 encode/decode giữ nguyên logic
- [ ] Migration job: đọc Fyne Registry (`HKEY_CURRENT_USER/Software/io.zentro.app`) nếu config.json chưa tồn tại (Windows)

### 1.4 Rewrite `cmd/zentro/main.go`
- [x] Import `github.com/wailsapp/wails/v2` thay Fyne
- [x] Driver registration (`core.Register`) giữ nguyên
- [x] `wails.Run(&options.App{...})` thay `ShowAndRun()`
- [x] `//go:embed all:frontend/dist` assets

### 1.5 Create `internal/app/app.go`
- [x] Định nghĩa `QuerySession` struct (`TabID`, `CancelFunc`, `StartedAt`)
- [x] Định nghĩa `App` struct (`ctx`, `logger`, `db`, `profile`, `sessions map[string]*QuerySession`, `prefs`)
- [x] `NewApp() *App` constructor
- [x] `Startup(ctx context.Context)` — load prefs + connections
- [x] Method stubs: `LoadConnections`, `SaveConnection`, `DeleteConnection`, `TestConnection`, `Connect`, `Disconnect`
- [x] Method stubs: `ExecuteQuery(tabID, query string)`, `CancelQuery(tabID string)`
- [x] Method stub: `FetchDatabaseSchema(profileName, dbName string)`
- [x] Method stubs: `GetPreferences`, `SetPreferences`
- [x] Method stub: `ExportCSV(columns []string, rows [][]string) (string, error)`

### 1.6 Event Contract (defined, not yet implemented)
- [x] Document event names trong code comment hoặc `events.go` constants file
  - `connection:changed`, `schema:databases`, `schema:loaded`
  - `query:started`, `query:chunk`, `query:done`
- [ ] Frontend `src/lib/events.ts` — typed event listeners wrapper

### 1.7 Verify Phase 1
- [x] `wails dev` boots, blank React app hiện trong WebView
- [x] Gọi `LoadConnections()` từ browser DevTools → trả về `[]` hoặc data cũ
- [x] `go test ./internal/db/... ./internal/driver/... ./internal/utils/...` — all pass

---

## Phase 2 — Async Query Engine

### 2.1 Streaming Goroutine
- [x] Export `InjectLimitIfMissing` từ `executor.go` (hiện là unexported)
- [x] `ExecuteQuery(tabID, query string)` — void, emit-based
- [x] Streaming SELECT: emit `query:chunk` mỗi 500 rows
- [x] `columns` chỉ gửi trong chunk đầu tiên (`seq == 0`)
- [x] Emit `query:done` khi stream kết thúc (success hoặc error)
- [x] Non-SELECT: `ExecContext` → emit `query:done` với `affected`
- [x] `scanRowAsStrings` helper: `[]interface{}` → `[]string` (stringify tất cả values)

### 2.2 QuerySession per Tab
- [x] `sessions map[string]*QuerySession` trong `App`
- [x] Tạo session mới mỗi lần `ExecuteQuery` (hủy session cũ nếu còn)
- [x] `CancelQuery(tabID string)` — gọi `CancelFunc` đúng session

### 2.3 Timeout & Error Handling
- [x] Context timeout 60s (hardcoded MVP)
- [x] Cancel mid-stream: goroutine thoát sạch, emit `query:done` với error
- [x] `db == nil`: emit `query:done` ngay với `error: "No active connection"`

### 2.4 Verify Phase 2
- [x] Integration test: query 50k rows → chunks nhận đủ, seq tăng dần
- [x] `CancelQuery` mid-stream → goroutine dừng, `query:done` emit với error message
- [x] Non-SELECT (INSERT/UPDATE) → `query:done` với `affected > 0`

---

## Phase 3 — Layout + Sidebar

### 3.1 Zustand Stores
- [ ] `connectionStore.ts` — `connections`, `activeProfile`, `isConnected`, `databases`
- [ ] `editorStore.ts` — `tabs`, `activeTabId`, `isRunning per tab`
- [ ] `resultStore.ts` — `columns`, `rows`, `isDone`, `appendRows` per tabID
- [ ] `statusStore.ts` — `connectionLabel`, `status`, `rowCount`, `duration`
- [ ] `schemaStore.ts` — `tree` (lazy, per profileName+dbName)

### 3.2 App Shell Layout
- [ ] CSS Grid layout: sidebar (22%) + main area (78%)
- [ ] `Toolbar.tsx` — buttons, enable/disable logic từ stores
- [ ] `StatusBar.tsx` — listen Wails events, update store
- [ ] Sidebar shell `Sidebar.tsx` — resizable panel

### 3.3 Connection CRUD
- [ ] `ConnectionTree.tsx` — tree nodes (conn → db → schema → table/view)
- [ ] `ConnectionDialog.tsx` — modal form tạo/sửa connection
- [ ] Wire: `LoadConnections` → `SaveConnection` → `DeleteConnection`
- [ ] `TestConnection` — hiển thị success/error trong dialog
- [ ] Right-click context menu: Connect / Edit / Delete
- [ ] Active connection indicator (● green dot)

### 3.4 Lazy Schema Tree
- [ ] `Connect(name)` → emit `schema:databases` (chỉ DB names, không fetch schemas)
- [ ] Frontend: expand DB node → gọi `FetchDatabaseSchema(profileName, dbName)`
- [ ] Backend emit `schema:loaded` → `schemaStore` cập nhật tree
- [ ] Auto-expand active DB sau khi schema loaded

### 3.5 Verify Phase 3
- [ ] CRUD connection profiles hoạt động + persist sau restart
- [ ] Click connect → sidebar hiện DB list
- [ ] Expand DB node → schemas/tables/views lazy load
- [ ] Right-click menu hoạt động đúng

---

## Phase 4 — Editor

### 4.1 Monaco Editor Integration
- [ ] Cài `@monaco-editor/react` (wrapper React cho Monaco)
- [ ] `vite-plugin-monaco-editor` để tree-shake, chỉ bundle SQL worker
- [ ] `MonacoEditor.tsx` — SQL language mode, dark/light theme sync
- [ ] Override `Ctrl+Enter` keybinding (Monaco dùng cho suggestion → rebind sang runQuery)
- [ ] Register `completionProvider` từ `schemaStore` (table/column names → IntelliSense)
- [ ] `automaticLayout: true`, `minimap: { enabled: false }` (Zen principle)

### 4.2 Query Tabs
- [ ] `QueryTabs.tsx` — tab bar + active tab content
- [ ] `TabBar.tsx` — close button (×), double-click/F2 rename, right-click context menu
- [ ] Tab context menu: Close / Rename / Close Other / Close All
- [ ] VSplit: MonacoEditor (top) + ResultPanel (bottom), draggable divider
- [ ] Unsaved prompt khi close tab có query text
- [ ] `Ctrl+W` close active tab, `Ctrl+T` new tab

### 4.3 Execution Wiring
- [ ] `editorStore.runCurrentTab()` → gọi `ExecuteQuery(tabID, query)` Wails binding
- [ ] Listen `query:started` → set `isRunning = true`, clear result
- [ ] Listen `query:chunk` → `resultStore.appendRows(tabID, rows)`
- [ ] Listen `query:done` → set `isRunning = false`, update status bar
- [ ] Run/Cancel toolbar buttons driven bởi `isRunning`

### 4.4 Verify Phase 4
- [ ] Ctrl+Enter trong Monaco Editor chạy query (không trigger Monaco suggestion)
- [ ] IntelliSense gợi ý tên bảng từ schema
- [ ] Chunks nhận và ResultPanel hiện rows progressively
- [ ] Cancel button dừng stream mid-query
- [ ] Rename tab F2 hoạt động

---

## Phase 5 — Result Grid

### 5.1 TanStack Table + Virtual
- [ ] `ResultTable.tsx` với `@tanstack/react-table` + `@tanstack/react-virtual`
- [ ] `useVirtualizer` cho row virtualization (target 50k rows không lag)
- [ ] Benchmark: render 50k rows < 100ms (đo bằng React DevTools Profiler)
- [ ] Column header render từ `resultStore.columns[tabID]`
- [ ] Row number column (frozen left)

### 5.2 Sort
- [ ] Sort header click → asc/desc (client-side, TanStack built-in)
- [ ] Sort disabled khi `!resultStore.isDone(tabID)` (đang streaming)
- [ ] Sort indicator (↑↓) trên column header

### 5.3 Export CSV
- [ ] Export button trong Toolbar (enabled sau `query:done`)
- [ ] Gọi `ExportCSV(columns, rows)` → Wails `runtime.SaveFileDialog`
- [ ] Go: `encoding/csv.WriteAll` ghi file
- [ ] Hiển thị file path trong StatusBar sau export thành công

### 5.4 Row Limit Setting
- [ ] `prefs.defaultLimit` truyền vào `ExecuteQuery` → `InjectLimitIfMissing`
- [ ] Editable trong Settings panel (Phase 6)

### 5.5 Verify Phase 5
- [ ] 50k rows: stream progressive, scroll mượt
- [ ] Sort đúng sau khi done
- [ ] Export CSV → file mở được trong Excel/Numbers
- [ ] Row limit 100/500/1000/5000 hoạt động

---

## Phase 6 — Advanced Features

### 6.1 Batch Edit
- [ ] Multi-cell selection: click + Shift (range) + Ctrl (individual)
- [ ] Selection highlight CSS
- [ ] Double-click cell → inline `<input>` tại cell đó
- [ ] Enter → propagate value đến tất cả selected cells **cùng cột**
- [ ] Dirty cells highlight khác màu
- [ ] Escape → cancel edit, revert value

### 6.2 Query History
- [ ] `AppendHistory(e HistoryEntry)` trong `app.go` — gọi sau `query:done`
- [ ] Giới hạn 500 entries (rotate oldest)
- [ ] `GetHistory() []HistoryEntry` Wails method
- [ ] History panel UI: list entries, click → paste query vào active Monaco tab
- [ ] `ClearHistory()` với confirm dialog

### 6.3 Theme
- [ ] Light/dark toggle trong Toolbar (⚙ menu hoặc dedicated button)
- [ ] CSS custom properties: `--bg-primary`, `--text-primary`, etc.
- [ ] `data-theme="dark"|"light"` trên `<html>` element
- [ ] Monaco Editor: `monaco.editor.setTheme("vs-dark" | "vs")`
- [ ] Persist theme preference qua `SetPreferences`

### 6.4 Settings Panel
- [ ] Settings modal (`⚙` button trong Toolbar)
- [ ] Row limit slider/input (100 – 10000)
- [ ] Font size selector (12 – 20px)
- [ ] Theme toggle (Light / Dark / System)
- [ ] Save → `SetPreferences(prefs)`

### 6.5 Polish
- [ ] Error toast notifications (connection fail, query error)
- [ ] Loading spinner khi connecting / streaming
- [ ] Keyboard shortcut cheatsheet (? key hoặc Help button)
- [ ] Empty state placeholders (no connection, no query run yet)
- [ ] Window title update: `Zentro — ProfileName (postgres)`

### 6.6 Cross-Platform Build
- [ ] `wails build -platform windows/amd64 -clean`
- [ ] `wails build -platform darwin/arm64 -clean`
- [ ] Verify binary chạy không cần Wails dev server
- [ ] Verify WebView2 trên máy Windows không có Wails installed
- [ ] Monaco bundle size check (dùng `vite-bundle-analyzer`)
