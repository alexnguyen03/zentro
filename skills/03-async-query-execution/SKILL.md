---
name: zentro-async-query-execution
description: >
  Định nghĩa QueryResult struct, pattern async query execution với channel,
  context cancellation, row streaming, và quy tắc Fyne UI thread-safety khi
  consume kết quả từ goroutine trong Zentro.
---

# Skill 03: Async Query Execution Engine

## Structs (internal/models/query.go)

```go
type QueryResult struct {
    Columns  []string
    Rows     [][]interface{}
    Affected int64
    Duration time.Duration
    Err      error
    IsSelect bool
}
```

## Backend API (internal/db/executor.go)

```go
func IsSelectQuery(query string) bool
func ExecuteQuery(ctx context.Context, db *sql.DB, query string) <-chan *models.QueryResult
```

### IsSelectQuery

```go
func IsSelectQuery(query string) bool {
    upper := strings.ToUpper(strings.TrimSpace(query))
    for _, prefix := range []string{"SELECT", "WITH", "SHOW", "EXPLAIN"} {
        if strings.HasPrefix(upper, prefix) {
            return true
        }
    }
    return false
}
```

### ExecuteQuery — Pattern bắt buộc

```go
func ExecuteQuery(ctx context.Context, db *sql.DB, query string) <-chan *models.QueryResult {
    ch := make(chan *models.QueryResult, 1)
    go func() {
        defer close(ch)
        start := time.Now()
        result := &models.QueryResult{}

        if IsSelectQuery(query) {
            result.IsSelect = true
            normalized := injectLimitIfMissing(query, 1000)
            rows, err := db.QueryContext(ctx, normalized)
            if err != nil {
                result.Err = fmt.Errorf("executor: query: %w", err)
                result.Duration = time.Since(start)
                ch <- result
                return
            }
            defer rows.Close()
            cols, _ := rows.Columns()
            result.Columns = cols
            result.Rows = streamRows(rows, len(cols))
        } else {
            res, err := db.ExecContext(ctx, query)
            if err != nil {
                result.Err = fmt.Errorf("executor: exec: %w", err)
            } else {
                result.Affected, _ = res.RowsAffected()
            }
        }

        result.Duration = time.Since(start)
        ch <- result
    }()
    return ch
}
```

### injectLimitIfMissing

```go
var limitPattern = regexp.MustCompile(`(?i)\bLIMIT\b|\bTOP\b`)

func injectLimitIfMissing(query string, limit int) string {
    if limitPattern.MatchString(query) {
        return query
    }
    return query + fmt.Sprintf(" LIMIT %d", limit)
}
```

### streamRows

```go
func streamRows(rows *sql.Rows, colCount int) [][]interface{} {
    var result [][]interface{}
    for rows.Next() {
        row := make([]interface{}, colCount)
        ptrs := make([]interface{}, colCount)
        for i := range row {
            ptrs[i] = &row[i]
        }
        if err := rows.Scan(ptrs...); err != nil {
            continue
        }
        result = append(result, row)
    }
    return result
}
```

## Cách UI Consume (pattern bắt buộc)

```go
// Trong event handler của Run button hoặc Ctrl+Enter:
ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
tabState.CancelFunc = cancel // lưu để nút "Cancel" gọi

go func() {
    ch := executor.ExecuteQuery(ctx, tabState.DB, tabState.QueryText)
    result := <-ch
    cancel() // cleanup context

    // Cập nhật UI — xem quy tắc threading bên dưới
    resultTable.UpdateData(result)
    statusBar.SetQueryInfo(result.Duration, len(result.Rows), result.Err)
    history.AppendEntry(result) // background, non-blocking
}()
```

## ⚠️ Fyne Threading Rules (bắt buộc)

| Operation | Thread-safe? | Cách dùng |
|---|---|---|
| `widget.SetText()` | ✅ Yes | Gọi trực tiếp từ goroutine |
| `widget.Refresh()` | ✅ Yes | Gọi trực tiếp từ goroutine |
| `label.SetText()` | ✅ Yes | Gọi trực tiếp từ goroutine |
| `container.Add()` | ❌ No | Dùng `fyne.Do(func(){...})` |
| `tabs.Append()` | ❌ No | Dùng `fyne.Do(func(){...})` |
| Tạo/xóa widget mới | ❌ No | Dùng `fyne.Do(func(){...})` |
| `window.SetContent()` | ❌ No | Dùng `fyne.Do(func(){...})` |

**Nguyên tắc**: nếu operation thay đổi **canvas structure** (thêm/xóa object) → `fyne.Do()`. Nếu chỉ thay đổi **content** của widget đã tồn tại → thread-safe.

## Error Display

```go
if result.Err != nil {
    dialog.ShowError(result.Err, parentWindow)
    // Hoặc hiển thị trong status bar: statusBar.SetError(result.Err)
    return
}
```

- Không panic khi có lỗi SQL
- Hiển thị toàn bộ error message — không truncate
- Timeout error: `"Query timed out after 60 seconds. Use Cancel to abort."`
- No connection error: `"No active connection. Please connect to a database first."`

## Default Limits

| Setting | Default | Configurable |
|---|---|---|
| Row limit (SELECT) | 1000 | Yes — via Preferences (Skill 08) |
| Query timeout | 60s | No — hardcoded MVP |
| Max connections | 10 | No — hardcoded MVP |
