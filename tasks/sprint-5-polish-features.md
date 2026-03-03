---
sprint: S5
title: Polish & Secondary Features
weeks: 10-11
status: Todo
skill_refs:
  - skills/07-export-and-history/SKILL.md
  - skills/08-preferences-settings/SKILL.md
depends_on: S4
---

# Sprint 5 — Polish & Secondary Features

> Mục tiêu: Export CSV, query history, settings dialog, tích hợp DefaultLimit vào executor.  
> Sau sprint này: app đủ tính năng MVP, sẵn sàng cho build release.

---

## Task 5.1 — ExportToCSV

**File**: `internal/utils/export.go`  
**Package**: `package utils`

- [ ] Import: `encoding/csv`, `os`, `fmt`, `fyne.io/fyne/v2/widget`

- [ ] Implement `ExportToCSV(result *models.QueryResult, editedCells map[widget.TableCellID]string, filePath string) error`:
  - `f, err := os.Create(filePath)` → wrap error
  - `defer f.Close()`
  - `w := csv.NewWriter(f); defer w.Flush()`
  - Write header: `w.Write(result.Columns)`
  - Loop rows:
    ```go
    for rowIdx, row := range result.Rows {
        record := make([]string, len(row))
        for colIdx, v := range row {
            cellID := widget.TableCellID{Row: rowIdx + 1, Col: colIdx}
            if edited, ok := editedCells[cellID]; ok {
                record[colIdx] = edited
            } else {
                record[colIdx] = FormatCellValue(v)
            }
        }
        w.Write(record)
    }
    ```
  - Return `w.Error()`

- [ ] Unit test với mock QueryResult:
  - Export thường (không có edits)
  - Export với edited cells → verify edited values trong CSV

**Done khi**: unit test pass, CSV file đọc được bằng Excel/LibreOffice.

---

## Task 5.2 — Export CSV UI flow

**File**: `internal/ui/mainwindow.go`

- [ ] Implement `exportCurrentResult(state *AppState)`:
  - Check `state.ResultTable` và `state.QueryEditor.GetCurrentState().LastResult` không nil
  - `fd := dialog.NewFileSave(callback, state.MainWindow)`
  - `fd.SetFilter(storage.NewExtensionFileFilter([]string{".csv"}))`
  - `fd.SetFileName("export.csv")`
  - `fd.Show()`

- [ ] Callback:
  ```go
  func(writer fyne.URIWriteCloser, err error) {
      if err != nil || writer == nil { return }
      writer.Close() // đóng writer của Fyne, rồi dùng os.Create với path
      filePath := writer.URI().Path()

      go func() {
          editedCells := state.ResultTable.GetEditedCells()
          result := state.QueryEditor.GetCurrentState().LastResult
          if err := utils.ExportToCSV(result, editedCells, filePath); err != nil {
              fyne.Do(func() { dialog.ShowError(err, state.MainWindow) })
              return
          }
          fyne.Do(func() {
              dialog.ShowInformation("Export Complete",
                  fmt.Sprintf("Exported %d rows to:\n%s", len(result.Rows), filePath),
                  state.MainWindow)
          })
      }()
  }
  ```

- [ ] "Export CSV" button action: `func() { exportCurrentResult(state) }`

**Done khi**: click Export → file dialog → chọn path → file CSV tạo ra đúng.

---

## Task 5.3 — AppendHistory / LoadHistory / ClearHistory

**File**: `internal/db/history.go`  
**Package**: `package db`

- [ ] `const maxHistoryEntries = 200`

- [ ] `AppendHistory(app fyne.App, entry *models.HistoryEntry) error`:
  - Load existing → prepend entry → trim đến 200 → marshal → save
  - Nếu load error: bắt đầu với slice rỗng (non-fatal)

- [ ] `LoadHistory(app fyne.App) ([]*models.HistoryEntry, error)`:
  - `StringWithFallback(utils.PrefHistory, "[]")` → unmarshal
  - Nếu unmarshal error: return nil slice + error (caller log warn)

- [ ] `ClearHistory(app fyne.App)`:
  - `app.Preferences().SetString(utils.PrefHistory, "[]")`

- [ ] Unit test `AppendHistory`:
  - Thêm 205 entries → verify chỉ còn 200 (newest first)
  - Entry đầu tiên phải là entry mới nhất

**Done khi**: unit test pass.

---

## Task 5.4 — Wire History vào Query Execution

**File**: `internal/ui/mainwindow.go`

- [ ] Sau `OnQueryFinished()`, append history trong goroutine background:
  ```go
  go func() {
      entry := &models.HistoryEntry{
          Query:      tabState.QueryText,
          ExecutedAt: time.Now(),
          DurationMs: result.Duration.Milliseconds(),
          Success:    result.Err == nil,
          RowCount:   len(result.Rows),
          Profile:    tabState.ProfileName,
      }
      if err := db.AppendHistory(state.App, entry); err != nil {
          state.Logger.Warn("failed to save history", "err", err)
      }
      // Refresh history panel nếu đang mở
      if state.HistoryPanel != nil {
          fyne.Do(func() { state.HistoryPanel.Refresh() })
      }
  }()
  ```

**Done khi**: sau mỗi query run, entry xuất hiện trong history.

---

## Task 5.5 — History Panel UI

**File**: `internal/ui/history/panel.go`  
**Package**: `package history`

- [ ] Struct:
  ```go
  type HistoryPanel struct {
      list     *widget.List
      entries  []*models.HistoryEntry
      app      fyne.App
      onSelect func(query string)
  }
  ```

- [ ] `NewHistoryPanel(app fyne.App, onSelect func(string)) *HistoryPanel`:
  - Load entries từ `db.LoadHistory(app)`
  - Tạo `widget.List`:
    - Length: `len(p.entries)`
    - CreateItem: `widget.NewLabel("")`
    - UpdateItem: format label = `"[profile] HH:MM — query preview..."`
      ```go
      timeStr := entry.ExecutedAt.Format("15:04:05")
      preview := entry.Query
      if len(preview) > 60 { preview = preview[:60] + "..." }
      statusIcon := "✓" // nếu success
      if !entry.Success { statusIcon = "✗" }
      label.SetText(fmt.Sprintf("%s [%s] %s — %s", statusIcon, entry.Profile, timeStr, preview))
      ```
  - `list.OnSelected = func(id int) { p.onSelect(p.entries[id].Query) }`

- [ ] `Refresh()`: reload from preferences + `list.Refresh()`

- [ ] Clear button + layout:
  ```go
  clearBtn := widget.NewButton("Clear History", func() {
      dialog.NewConfirm("Clear History", "Delete all query history?", func(ok bool) {
          if ok {
              db.ClearHistory(app)
              p.entries = nil
              p.list.Refresh()
          }
      }, parentWindow).Show()
  })
  ```

- [ ] `Widget() fyne.CanvasObject`:
  - `container.NewBorder(widget.NewLabel("Query History"), clearBtn, nil, nil, p.list)`

**Done khi**: history panel hiển thị entries, click paste query vào editor active.

---

## Task 5.6 — Mount History Panel

**File**: `internal/ui/mainwindow.go`

- [ ] Thêm `HistoryPanel *history.HistoryPanel` vào `AppState`
- [ ] `onSelect` callback: lấy `GetCurrentState().QueryText` và set giá trị
  ```go
  onHistorySelect := func(query string) {
      state := state.QueryEditor.GetCurrentState()
      if state == nil { return }
      state.QueryText = query
      // cần expose method SetEditorText trên QueryEditorWidget để set vào Entry widget
  }
  ```
- [ ] Thêm method `SetEditorText(tab *container.TabItem, text string)` vào `QueryEditorWidget`
- [ ] Mount HistoryPanel: thêm tab "History" vào container bên phải hoặc bottom panel (MVP: simple approach — thêm tab ở bottom)

> MVP approach: dùng `container.NewHSplit(editorArea, historyPanel.Widget())` với Offset=0.75, hoặc đặt history panel như một tab riêng trong AppTabs bên ngoài.

**Done khi**: history panel visible, click entry → paste vào editor.

---

## Task 5.7 — Settings Dialog

**File**: `internal/ui/settings/dialog.go`  
**Package**: `package settings`

- [ ] `ShowSettingsDialog(app fyne.App, parent fyne.Window, onApply func())`:

  - `themeSelect := widget.NewSelect([]string{"system", "light", "dark"}, nil)`
  - `themeSelect.SetSelected(utils.GetTheme(app))`

  - `limitEntry := widget.NewEntry()`
  - `limitEntry.SetText(fmt.Sprintf("%d", utils.GetDefaultLimit(app)))`
  - `limitEntry.Validator = func(s string) error { ... }` (validate số > 0)

  - `form := widget.NewForm(widget.NewFormItem("Theme", themeSelect), widget.NewFormItem("Default Row Limit", limitEntry))`

  - `dialog.ShowCustomConfirm("Settings", "Apply", "Cancel", form, func(confirmed bool) { ... }, parent)`

  - Nếu confirmed:
    - `utils.SetTheme(app, themeSelect.Selected)` → `applyTheme(app)`
    - Parse limitEntry.Text → `utils.SetDefaultLimit(app, limit)` nếu valid
    - `if onApply != nil { onApply() }`

- [ ] `applyTheme(app fyne.App)`:
  ```go
  switch utils.GetTheme(app) {
  case "dark":
      app.Settings().SetTheme(theme.DarkTheme())
  case "light":
      app.Settings().SetTheme(theme.LightTheme())
  // "system": không set gì, Fyne tự detect
  }
  ```

**Done khi**: settings dialog mở được, theme apply ngay, limit persist qua restart.

---

## Task 5.8 — Settings Button & ApplyPreferences Startup

**File**: `internal/ui/mainwindow.go`  
**File**: `cmd/zentro/main.go`

- [ ] "Settings" button action: `func() { settings.ShowSettingsDialog(state.App, state.MainWindow, nil) }`
- [ ] `utils.ApplyPreferences(app fyne.App)` — hoàn thiện:
  ```go
  func ApplyPreferences(app fyne.App) {
      applyTheme(app) // gọi internal function
  }
  ```
  > Cần export hoặc tái cấu trúc để tránh circular dependency
- [ ] Gọi `utils.ApplyPreferences(app)` trong `main.go` TRƯỚC `w.ShowAndRun()`

---

## Task 5.9 — Tích hợp DefaultLimit vào ExecuteQuery

**File**: `internal/db/executor.go`

> Note: `ExecuteQuery` hiện nhận `defaultLimit int` param. Sprint 3 có thể đã hardcode 1000.

- [ ] Verify `ExecuteQuery` signature có `defaultLimit int` parameter
- [ ] Verify caller trong `mainwindow.go` đọc từ `utils.GetDefaultLimit(state.App)` thay vì hardcode

**Done khi**: thay đổi Default Row Limit trong settings → query tiếp theo áp dụng limit mới.

---

## Smoke Test Sprint 5

```bash
go build ./...
go vet ./...
go run ./cmd/zentro/
```

- [ ] Chạy query → "Export CSV" button enabled
- [ ] Click Export → file dialog → chọn path → file tạo ra
- [ ] Mở CSV bằng Excel/Notepad → đúng headers và data
- [ ] Edited cells trong grid → export → CSV có giá trị edited
- [ ] Chạy 5 queries → mở History panel → 5 entries hiện đúng
- [ ] Click history entry → query paste vào editor active
- [ ] Clear history → confirm → list trống → restart → vẫn trống
- [ ] Settings → đổi theme sang "dark" → Apply → UI dark mode ngay
- [ ] Settings → đổi theme sang "light" → Apply → UI light mode ngay
- [ ] Settings → đổi Default Limit = 50 → chạy `SELECT * FROM big_table` → chỉ 50 rows
- [ ] Restart app → settings persist (theme + limit)
