### Specification 6: Basic Export Functionality

**Mô tả**: Export kết quả query hiện tại ra file CSV.

**Logic Backend** (`internal/app/app.go`):
```go
// ExportCSV nhận QueryResult data từ frontend, ghi ra file qua OS save dialog.
// Pattern: Facade — che giấu file I/O và dialog khỏi frontend.
func (a *App) ExportCSV(columns []string, rows [][]string) (string, error) {
    // Mở OS native save dialog qua Wails runtime
    filePath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
        Title:           "Export CSV",
        DefaultFilename: "query_result.csv",
        Filters: []runtime.FileFilter{
            {DisplayName: "CSV Files", Pattern: "*.csv"},
        },
    })
    if err != nil || filePath == "" {
        return "", nil  // user cancelled
    }

    f, err := os.Create(filePath)
    if err != nil {
        return "", fmt.Errorf("export: create file: %w", err)
    }
    defer f.Close()

    w := csv.NewWriter(f)
    _ = w.Write(columns)
    for _, row := range rows {
        _ = w.Write(row)
    }
    w.Flush()
    return filePath, w.Error()
}
```

**Frontend** (`Toolbar.tsx`):
```typescript
const exportCSV = async () => {
  const result = resultStore.getActiveResult()
  if (!result) return
  const path = await ExportCSV(result.columns, result.rows)
  if (path) statusStore.setStatus(`Exported: ${path}`)
}
```

**Edge Cases**:
- User cancel dialog → trả về `("", nil)`, frontend không làm gì.
- File write error → frontend hiện toast error.
- 0 rows: export header only — hợp lệ.

**Sprint Planning**: **Phase 4**.
