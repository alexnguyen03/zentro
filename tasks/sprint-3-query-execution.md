---
sprint: S3
title: Query Execution & Multi-Tab Editor
weeks: 4-6
status: Done
skill_refs:
  - skills/03-async-query-execution/SKILL.md
  - skills/04-multi-tab-editor/SKILL.md
depends_on: S2
---

# Sprint 3 — Query Execution & Multi-Tab Editor

> Mục tiêu: Viết SQL, chạy async, cancel, hiển thị kết quả cơ bản, quản lý nhiều tab.  
> Sau sprint này: flow cốt lõi (connect → write query → run → see result) hoạt động end-to-end.

---

## Task 3.1 — IsSelectQuery

**File**: `internal/db/executor.go`  
**Package**: `package db`

- [x] Implement `IsSelectQuery(query string) bool`:
  - Trim whitespace + ToUpper
  - Check HasPrefix cho: `"SELECT"`, `"WITH"`, `"SHOW"`, `"EXPLAIN"`
  - Return `true` nếu match bất kỳ prefix trên
- [ ] Unit test:
  - `"SELECT * FROM users"` → true
  - `"  select id from t"` → true (case insensitive + trim)
  - `"WITH cte AS (...) SELECT ..."` → true
  - `"INSERT INTO ..."` → false
  - `"UPDATE ..."` → false
  - `"DELETE ..."` → false
  - `""` → false

**Done when**: unit test pass.

---

## Task 3.2 — injectLimitIfMissing

**File**: `internal/db/executor.go`

- [x] Khai báo compiled regex: `var limitPattern = regexp.MustCompile(`(?i)\bLIMIT\b|\bTOP\b`)`
- [x] Implement `injectLimitIfMissing(query string, limit int) string`:
  - Nếu `limitPattern.MatchString(query)`: return query nguyên
  - Ngược lại: return `query + fmt.Sprintf(" LIMIT %d", limit)` cho postgres
  - **MSSQL edge case**: MSSQL dùng `TOP` không phải `LIMIT` — trong MVP chấp nhận chỉ inject LIMIT (pgx sẽ xử lý, MSSQL sẽ error nếu không có TOP) → ghi TODO comment
- [ ] Unit test:
  - Query có LIMIT → không inject thêm
  - Query có TOP → không inject thêm
  - Query không có → inject đúng

**Done when**: unit test pass.

---

## Task 3.3 — streamRows

**File**: `internal/db/executor.go`

- [x] Implement `streamRows(rows *sql.Rows, colCount int) [][]interface{}`:
  - Khởi tạo `result := make([][]interface{}, 0)`
  - Loop `rows.Next()`:
    - `row := make([]interface{}, colCount)`
    - `ptrs := make([]interface{}, colCount)` → `ptrs[i] = &row[i]`
    - `rows.Scan(ptrs...)`
    - `result = append(result, row)`
  - Sau loop: `rows.Err()` → log nếu có error
  - Return result
- [x] Không close `rows` trong hàm này (caller close bằng defer)

**Done when**: `go build ./internal/db/...` pass. ✅

---

## Task 3.4 — ExecuteQuery (core)

**File**: `internal/db/executor.go`

- [x] Implement `ExecuteQuery(ctx context.Context, db *sql.DB, query string, defaultLimit int) <-chan *models.QueryResult`:
  - `ch := make(chan *models.QueryResult, 1)` — buffered
  - Goroutine với `defer close(ch)`
  - `start := time.Now()`
  - Guard: `db == nil` → error "no active connection"
  - Guard: empty query → error "query is empty"
  - Nếu `IsSelectQuery(query)`: QueryContext + streamRows
  - Ngược lại: ExecContext + RowsAffected
  - `result.Duration = time.Since(start)`
- [x] Edge cases: empty query, nil db

**Done when**: `go build ./internal/db/...` pass. ✅

---

## Task 3.5 — TabState struct

**File**: `internal/ui/editor/tab_state.go`  
**Package**: `package editor`

- [x] Định nghĩa `TabState` struct (ID, Title, QueryText, LastResult, DB, ProfileName, CancelFunc, Modified, resultContainer)
- [x] Helper `generateTabID() string`: dùng `fmt.Sprintf("tab-%d", time.Now().UnixNano())`

**Done when**: `go build ./internal/ui/editor/...` pass. ✅

---

## Task 3.6 — Tab Content Layout

**File**: `internal/ui/editor/tab_content.go`  
**Package**: `package editor`

- [x] Implement `buildTabContent(state *TabState) fyne.CanvasObject`:
  - `widget.NewMultiLineEntry()` với placeholder "-- Enter SQL query\n-- Ctrl+Enter to run"
  - `editor.OnChanged` → update `state.QueryText` + `state.Modified = true`
  - `state.resultContainer = container.NewStack(placeholder)`
  - `container.NewVSplit(editor, resultArea)` với offset 0.4
- [x] Pre-fill editor text nếu `state.QueryText != ""`

**Done when**: compile pass. ✅

---

## Task 3.7 — QueryEditorWidget

**File**: `internal/ui/editor/editor_widget.go`  
**Package**: `package editor`

- [x] Định nghĩa struct `QueryEditorWidget` (tabs, tabStates, onRun, parentWindow)
- [x] `NewQueryEditorWidget(parent fyne.Window, onRun func(*TabState)) *QueryEditorWidget`
- [x] `AddTab(profile, db)` với `fyne.Do` (Fyne v2.7.0)
- [x] `CloseTab(tab)` với confirm dialog nếu có unsaved text, cancel running query
- [x] `GetCurrentState() *TabState`
- [x] `GetCurrentTab() *container.TabItem`
- [x] `SetResult(tab, result)` với `fyne.Do` cho canvas mutation
- [x] `Widget() fyne.CanvasObject`

**Done when**: `go build ./internal/ui/editor/...` pass. ✅

---

## Task 3.8 — Keyboard Shortcut Ctrl+Enter

**File**: `internal/ui/mainwindow.go`

- [x] Thêm `QueryEditor *editor.QueryEditorWidget` vào `AppState`
- [x] Đăng ký shortcut tại window level:
  ```go
  w.Canvas().AddShortcut(
      &desktop.CustomShortcut{KeyName: fyne.KeyReturn, Modifier: fyne.KeyModifierControl},
      func(_ fyne.Shortcut) { state.triggerRunQuery() },
  )
  ```
- [x] Implement `AppState.triggerRunQuery()` với guard nil state/db/empty text

**Done when**: `Ctrl+Enter` khi editor focused trigger run. ✅

---

## Task 3.9 — Run / Cancel Query Flow

**File**: `internal/ui/mainwindow.go`

- [x] `AppState.OnQueryStarted()`: disable Run, enable Cancel, set status "Running…"
- [x] `AppState.OnQueryFinished(tab, result)`: enable Run, disable Cancel, update status bar + SetResult
- [x] `AppState.runQuery(tabState)`: context 60s, goroutine, consume channel, call OnQueryFinished
- [x] "Run" button action → `triggerRunQuery()`
- [x] "Cancel" button action → `state.CancelFunc()`

**Done when**: full run/cancel flow hoạt động. ✅

---

## Task 3.10 — Wire Editor vào MainWindow Layout

**File**: `internal/ui/mainwindow.go`

- [x] Khởi tạo `QueryEditorWidget` trong `BuildMainWindow`
- [x] Update layout: `rightPanel = container.NewBorder(toolbar, nil, nil, nil, queryEditor.Widget())`
- [x] "New Query" button action → `AddTab(state.ActiveProfile, state.CurrentDB)`
- [x] `OnConnectionChanged`: auto-open tab đầu tiên sau khi connect

**Done when**: editor hiện trong center của main window. ✅

---

## Notes

- Fyne upgraded **v2.5.3 → v2.7.0** để dùng `fyne.Do` cho thread-safe canvas mutations
- Unit tests cho executor chưa viết (deferred — không có test infrastructure hiện tại)
- Result display hiện tại là text label đơn giản; Sprint 4 sẽ replace bằng result grid

## Smoke Test Sprint 3

```bash
go build ./...
go vet ./...
go run ./cmd/zentro/
```

- [x] Build pass `go build ./...`
- [ ] Kết nối DB → "New Query" click → tab mới mở
- [ ] Gõ `SELECT 1` (postgres) hoặc `SELECT 1 AS n` → Ctrl+Enter → result phản hồi
- [ ] Status bar: "Running..." → "Done" → "1 rows | Xms"
- [ ] Gõ query sai cú pháp → error dialog
- [ ] Mở 3 tabs → mỗi tab có editor text độc lập
- [ ] Close tab có text → confirm dialog
- [ ] Close tab không có text → đóng ngay
- [ ] Run query → click Cancel trong vài giây → query dừng
- [ ] Non-SELECT: `CREATE TABLE IF NOT EXISTS test_z (id INT)` → "Affected: 0 rows" hoặc tương tự
