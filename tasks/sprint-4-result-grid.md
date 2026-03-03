---
sprint: S4
title: Result Grid
weeks: 7-9
status: Todo
skill_refs:
  - skills/05-result-grid/SKILL.md
depends_on: S3
---

# Sprint 4 — Result Grid

> Mục tiêu: Hiển thị QueryResult dưới dạng bảng tương tác, hỗ trợ single/batch edit, pagination.  
> Sau sprint này: người dùng xem và chỉnh sửa dữ liệu trực tiếp trên grid.

---

## Task 4.1 — FormatCellValue helper

**File**: `internal/utils/format.go`  
**Package**: `package utils`

- [ ] Implement `FormatCellValue(v interface{}) string`:
  - `nil` → `"NULL"`
  - `[]byte` → `string(val)`
  - `time.Time` → `val.Format("2006-01-02 15:04:05")`
  - `bool` → `"true"` hoặc `"false"`
  - Mọi type khác → `fmt.Sprintf("%v", val)`
- [ ] Unit test cover tất cả cases trên
- [ ] Export function (uppercase) vì dùng từ package `ui`

**Done khi**: unit test pass.

---

## Task 4.2 — ResultTableWidget core

**File**: `internal/ui/result/table_widget.go`  
**Package**: `package result`

- [ ] Định nghĩa struct:
  ```go
  type ResultTableWidget struct {
      table    *widget.Table
      data     [][]interface{}
      columns  []string
      selected map[widget.TableCellID]struct{}
      edited   map[widget.TableCellID]string
      page     int
      pageSize int      // default 500
      parent   fyne.Window
  }
  ```

- [ ] `NewResultTableWidget(parent fyne.Window) *ResultTableWidget`:
  - Init với empty data, `pageSize = 500`
  - Gọi `r.buildTable()`

- [ ] `buildTable() *widget.Table`:
  - `Length func`: `return len(r.pageData()) + 1, len(r.columns)` (+1 cho header)
  - `CreateCell func`: `return widget.NewLabel("")`
  - `UpdateCell func(id widget.TableCellID, obj fyne.CanvasObject)`:
    - Cast `obj` thành `*widget.Label`
    - Row 0 → header: bold, text = `r.columns[id.Col]`
    - Row > 0 → data:
      - `rowIdx = id.Row - 1 + r.page*r.pageSize`
      - Nếu `rowIdx >= len(r.data)`: `label.SetText(""); return`
      - Check `r.edited[id]` → italic + edited value
      - Ngược lại: normal + `utils.FormatCellValue(r.data[rowIdx][id.Col])`
      - Check `r.selected[id]` → bold style
  - `table.OnSelected = func(id) { r.handleCellTap(id) }`

- [ ] `UpdateData(result *models.QueryResult)`:
  - `r.data = result.Rows`
  - `r.columns = result.Columns`
  - `r.selected = make(map[widget.TableCellID]struct{})`
  - `r.edited = make(map[widget.TableCellID]string)`
  - `r.page = 0`
  - `r.table.Refresh()` (thread-safe)

- [ ] `Clear()`: reset all → `r.table.Refresh()`
- [ ] `GetEditedCells() map[widget.TableCellID]string`: return copy của `r.edited`

**Done khi**: `go build ./internal/ui/result/...` pass.

---

## Task 4.3 — Cell Selection

**File**: `internal/ui/result/selection.go`  
**Package**: `package result`

- [ ] `handleCellTap(id widget.TableCellID)`:
  - Ignore nếu `id.Row == 0` (header)
  - Toggle: nếu đã có trong `r.selected` → delete, ngược lại → add
  - `r.table.Refresh()`

- [ ] `getSelectedInColumn(col int) []widget.TableCellID`:
  - Loop `r.selected`, filter `cellID.Col == col`
  - Return slice

- [ ] `clearSelection()`:
  - `r.selected = make(map[widget.TableCellID]struct{})`
  - `r.table.Refresh()`

- [ ] Note về multiple selection UX: Fyne `OnSelected` chỉ trigger một cell tại một thời điểm. User click nhiều cell → mỗi click add vào map → accumulate. Không có Shift+click tự động → cần document hành vi này cho user.

**Done khi**: click cells thêm vào selection, click lại removes.

---

## Task 4.4 — Edit Cell Dialog

**File**: `internal/ui/result/edit.go`  
**Package**: `package result`

- [ ] `openEditDialog(id widget.TableCellID)`:
  - Ignore nếu `id.Row == 0`
  - Lấy current value: check `r.edited[id]` trước, sau đó `r.data[rowIdx][id.Col]`
  - Tạo `entry := widget.NewEntry()` với current value

  - `dialog.ShowCustomConfirm("Edit Cell", "Apply", "Cancel", entry, func(confirmed bool) { ... }, r.parent)`:
    - Nếu !confirmed: return
    - `newVal := entry.Text`
    - `sameCol := r.getSelectedInColumn(id.Col)`
    - Nếu `len(sameCol) > 1`:
      - `dialog.NewConfirm("Batch Edit", fmt.Sprintf("Apply \"%s\" to all %d selected cells in column \"%s\"?", newVal, len(sameCol), r.columns[id.Col]), func(applyAll bool) { ... }, r.parent).Show()`
      - Nếu applyAll: loop sameCol → `r.edited[cellID] = newVal`
      - Nếu !applyAll: chỉ `r.edited[id] = newVal`
    - Ngược lại (chỉ 1 cell): `r.edited[id] = newVal`
    - `r.table.Refresh()`

- [ ] Wire: `table.OnSelected` cần phân biệt single click (select) và double-click (edit):
  - Pattern: track `lastTappedID` và `lastTapTime`
  - Nếu tappedID == lastTappedID && `time.Since(lastTapTime) < 400ms` → `openEditDialog(id)`
  - Ngược lại: `handleCellTap(id)`
  - Update `lastTappedID = id; lastTapTime = time.Now()`

**Done khi**: double-click mở dialog, single click select, batch confirm hoạt động.

---

## Task 4.5 — Pagination

**File**: `internal/ui/result/pagination.go`  
**Package**: `package result`

- [ ] `pageData() [][]interface{}`:
  - `start := r.page * r.pageSize`
  - `end := start + r.pageSize; if end > len(r.data) { end = len(r.data) }`
  - Return `r.data[start:end]`

- [ ] `pageInfo() string`:
  - `"Page X/Y (rows A–B of total)"` hoặc đơn giản hơn: `"Rows A–B of total"`

- [ ] `buildPaginationControls() fyne.CanvasObject`:
  - `pageLabel := widget.NewLabel(r.pageInfo())`
  - `prevBtn := widget.NewButton("← Prev", func() { r.prevPage(pageLabel) })`
  - `nextBtn := widget.NewButton("Next →", func() { r.nextPage(pageLabel) })`
  - Disable prevBtn nếu `r.page == 0`
  - Disable nextBtn nếu đã ở trang cuối
  - Return `container.NewHBox(prevBtn, pageLabel, nextBtn)`

- [ ] `prevPage(label *widget.Label)` / `nextPage(label *widget.Label)`:
  - Cập nhật `r.page` + `label.SetText(r.pageInfo())` + `r.table.Refresh()`

- [ ] `Widget() fyne.CanvasObject`:
  - Nếu `len(r.data) <= r.pageSize`: return `r.table`
  - Ngược lại: return `container.NewBorder(nil, r.buildPaginationControls(), nil, nil, r.table)`

**Done khi**: dataset > 500 rows hiển thị pagination controls, Prev/Next đúng.

---

## Task 4.6 — Wire Result Table vào Editor

**File**: `internal/ui/editor/editor_widget.go`  
**File**: `internal/ui/mainwindow.go`

- [ ] Thêm `ResultTable *result.ResultTableWidget` vào `AppState`
- [ ] Khởi tạo `ResultTable` sau `MainWindow` được tạo (để có `parent window`)
- [ ] Update `SetResult` trong `QueryEditorWidget`:
  - Gọi `state.ResultTable.UpdateData(result)` thay vì chỉ update label
  - Mount ResultTable widget vào `state.resultContainer`:
    ```go
    fyne.Do(func() {
        state.resultContainer.Objects = []fyne.CanvasObject{state.ResultTable.Widget()}
        state.resultContainer.Refresh()
    })
    ```
- [ ] Thêm ref `ResultTable` vào `TabState` hoặc dùng shared `AppState.ResultTable` (shared là đủ cho MVP — chỉ 1 result view tại một thời điểm)
- [ ] Update `AppState.OnQueryFinished`: enable "Export CSV" nếu có result rows

**Done khi**: kết quả query hiển thị dưới dạng widget.Table đúng.

---

## Task 4.7 — Column Width & Table Polish

**File**: `internal/ui/result/table_widget.go`

- [ ] Set uniform column width mặc định: `r.table.SetColumnWidth(col, 120)` cho tất cả columns
- [ ] Row height mặc định: dùng Fyne default (không cần set thủ công)
- [ ] Scroll: widget.Table tự có scroll built-in — verify hoạt động với 100+ columns
- [ ] Header row: set `table.SetRowHeight(0, 30)` để header cao hơn data rows một chút

**Done khi**: table có visual phân biệt header vs data, scroll hoạt động.

---

## Smoke Test Sprint 4

```bash
go build ./...
go vet ./...
go run ./cmd/zentro/
```

- [ ] Chạy `SELECT * FROM <bảng có dữ liệu>` → kết quả hiện trong table
- [ ] Header row bold, data rows normal
- [ ] NULL value hiển thị "NULL"
- [ ] Boolean hiển thị "true"/"false"
- [ ] Timestamp hiển thị đúng format `2006-01-02 15:04:05`
- [ ] Click cell → highlight
- [ ] Click cell khác → cell đó highlight (cell cũ vẫn giữ nếu đã selected)
- [ ] Double-click cell → dialog với current value
- [ ] Nhập giá trị mới → Apply → cell italic với giá trị mới
- [ ] Select 3 cells cùng cột → double-click 1 → nhập giá trị → batch confirm
- [ ] Batch apply → tất cả 3 cells italic với giá trị mới
- [ ] Chạy query trả về 600 rows → pagination controls xuất hiện
- [ ] Next/Prev pagination đúng row range
