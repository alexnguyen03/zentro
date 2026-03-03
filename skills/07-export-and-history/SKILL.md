---
name: zentro-export-and-history
description: >
  Định nghĩa ExportToCSV function, HistoryEntry struct, AppendHistory/LoadHistory
  persistence logic (max 200 entries), và UI panel history cho Zentro.
  Export CSV include cả pending local edits từ result grid.
---

# Skill 07: Export CSV & Query History

## Export CSV

### Function (internal/db/executor.go hoặc internal/utils/export.go)

```go
// ExportToCSV ghi QueryResult ra file CSV tại filePath.
// Nếu result có pending edits (editedCells), dùng giá trị edited thay vì original.
func ExportToCSV(result *models.QueryResult, editedCells map[widget.TableCellID]string, filePath string) error {
    f, err := os.Create(filePath)
    if err != nil {
        return fmt.Errorf("export: create file: %w", err)
    }
    defer f.Close()

    w := csv.NewWriter(f)
    defer w.Flush()

    // Header
    if err := w.Write(result.Columns); err != nil {
        return fmt.Errorf("export: write header: %w", err)
    }

    // Rows
    for rowIdx, row := range result.Rows {
        record := make([]string, len(row))
        for colIdx, v := range row {
            cellID := widget.TableCellID{Row: rowIdx + 1, Col: colIdx} // +1 vì row 0 là header
            if edited, ok := editedCells[cellID]; ok {
                record[colIdx] = edited
            } else {
                record[colIdx] = formatCellValue(v)
            }
        }
        if err := w.Write(record); err != nil {
            return fmt.Errorf("export: write row %d: %w", rowIdx, err)
        }
    }

    return w.Error()
}
```

### UI Trigger (trong toolbar Export button)

```go
func exportCurrentResult(state *AppState) {
    tabState := state.QueryEditor.GetCurrentState()
    if tabState == nil || tabState.LastResult == nil {
        return
    }

    fd := dialog.NewFileSave(func(writer fyne.URIWriteCloser, err error) {
        if err != nil || writer == nil {
            return
        }
        writer.Close()
        filePath := writer.URI().Path()

        go func() {
            editedCells := state.ResultTable.GetEditedCells()
            if err := utils.ExportToCSV(tabState.LastResult, editedCells, filePath); err != nil {
                fyne.Do(func() { dialog.ShowError(err, state.MainWindow) })
                return
            }
            fyne.Do(func() {
                dialog.ShowInformation("Export Complete",
                    fmt.Sprintf("Exported %d rows to:\n%s", len(tabState.LastResult.Rows), filePath),
                    state.MainWindow)
            })
        }()
    }, state.MainWindow)

    fd.SetFilter(storage.NewExtensionFileFilter([]string{".csv"}))
    fd.SetFileName("export.csv")
    fd.Show()
}
```

---

## Query History

### Struct (internal/models/query.go)

```go
type HistoryEntry struct {
    Query      string        `json:"query"`
    ExecutedAt time.Time     `json:"executed_at"`
    DurationMs int64         `json:"duration_ms"`
    Success    bool          `json:"success"`
    RowCount   int           `json:"row_count"`
    Profile    string        `json:"profile"` // tên ConnectionProfile đã dùng
}
```

### Backend (internal/db/history.go)

```go
const maxHistoryEntries = 200

func AppendHistory(app fyne.App, entry *models.HistoryEntry) error {
    entries, _ := LoadHistory(app) // ignore load error, start fresh

    // Thêm vào đầu (newest first)
    entries = append([]*models.HistoryEntry{entry}, entries...)

    // Trim nếu vượt giới hạn
    if len(entries) > maxHistoryEntries {
        entries = entries[:maxHistoryEntries]
    }

    data, err := json.Marshal(entries)
    if err != nil {
        return fmt.Errorf("history: marshal: %w", err)
    }
    app.Preferences().SetString(utils.PrefHistory, string(data))
    return nil
}

func LoadHistory(app fyne.App) ([]*models.HistoryEntry, error) {
    raw := app.Preferences().StringWithFallback(utils.PrefHistory, "[]")
    var entries []*models.HistoryEntry
    if err := json.Unmarshal([]byte(raw), &entries); err != nil {
        return nil, fmt.Errorf("history: unmarshal: %w", err)
    }
    return entries, nil
}

func ClearHistory(app fyne.App) {
    app.Preferences().SetString(utils.PrefHistory, "[]")
}
```

### AppendHistory từ Execution

```go
// Gọi trong goroutine sau khi ExecuteQuery trả về result
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
}()
```

### UI History Panel (internal/ui/history/)

```go
func NewHistoryPanel(
    app fyne.App,
    onSelect func(query string), // paste query vào tab editor active
) fyne.CanvasObject
```

- `widget.List` hiển thị: `"[profile] HH:MM:SS — query preview (50 chars)..."`
- Click → `onSelect(entry.Query)` → paste vào `state.QueryEditor.GetCurrentState().QueryText`
- Button "Clear History" ở bottom với `dialog.NewConfirm` trước khi clear
- Refresh list sau mỗi query execution

## formatCellValue (shared helper)

```go
// internal/utils/format.go
func FormatCellValue(v interface{}) string {
    if v == nil { return "NULL" }
    switch val := v.(type) {
    case []byte:
        return string(val)
    case time.Time:
        return val.Format("2006-01-02 15:04:05")
    case bool:
        if val { return "true" }
        return "false"
    default:
        return fmt.Sprintf("%v", val)
    }
}
```
