---
name: zentro-result-grid
description: >
  Định nghĩa ResultTableWidget sử dụng widget.Table của Fyne, bao gồm: header row,
  multi-select cells, single/batch edit với confirm dialog, type conversion, export
  hook, và pagination cho datasets lớn. Đây là feature phức tạp nhất của Zentro MVP.
---

# Skill 05: Result Grid / Table Viewer

## Struct (internal/ui/result/)

```go
type ResultTableWidget struct {
    table    *widget.Table
    data     [][]interface{}          // data backend
    columns  []string
    selected map[widget.TableCellID]struct{} // multi-select tracking
    edited   map[widget.TableCellID]string   // pending local edits (chưa commit DB)
    page     int                      // current page (pagination)
    pageSize int                      // default 500
    parent   fyne.Window              // để show dialogs
}
```

## Constructor & API

```go
func NewResultTableWidget(parent fyne.Window) *ResultTableWidget
func (r *ResultTableWidget) UpdateData(result *models.QueryResult)
func (r *ResultTableWidget) Widget() fyne.CanvasObject
func (r *ResultTableWidget) ExportCSV(filePath string) error
func (r *ResultTableWidget) Clear()
```

## widget.Table Setup Pattern

```go
func (r *ResultTableWidget) buildTable() *widget.Table {
    t := widget.NewTable(
        // +1 row cho header
        func() (int, int) {
            return len(r.pageRows()) + 1, len(r.columns)
        },
        // Cell template — reusable object
        func() fyne.CanvasObject {
            return widget.NewLabel("")
        },
        // UpdateCell — điền data vào cell
        func(id widget.TableCellID, obj fyne.CanvasObject) {
            label := obj.(*widget.Label)

            if id.Row == 0 {
                // Header row
                label.TextStyle = fyne.TextStyle{Bold: true}
                label.SetText(r.columns[id.Col])
                return
            }

            label.TextStyle = fyne.TextStyle{}
            rowIdx := id.Row - 1 + (r.page * r.pageSize)
            if rowIdx >= len(r.data) {
                label.SetText("")
                return
            }

            // Pending edit override
            if val, ok := r.edited[id]; ok {
                label.TextStyle = fyne.TextStyle{Italic: true}
                label.SetText(val)
                return
            }

            label.SetText(fmt.Sprintf("%v", r.data[rowIdx][id.Col]))

            // Highlight selected
            if _, ok := r.selected[id]; ok {
                label.TextStyle = fyne.TextStyle{Bold: true}
            }
        },
    )

    // Double-tap để edit cell
    t.OnSelected = func(id widget.TableCellID) {
        if id.Row == 0 { return } // ignore header
        r.handleCellTap(id)
    }

    return t
}
```

## Multi-Select Logic

```go
func (r *ResultTableWidget) handleCellTap(id widget.TableCellID) {
    if _, ok := r.selected[id]; ok {
        delete(r.selected, id) // deselect nếu đã chọn
    } else {
        r.selected[id] = struct{}{} // add to selection
    }
    r.table.Refresh()
}
```

> Fyne v2 không có built-in multi-select trên `widget.Table`. Implement bằng cách track `OnSelected` và maintain `r.selected` map. Shift+click để range select trong cùng cột cần custom keyboard handling.

## Batch Edit Flow

```go
func (r *ResultTableWidget) openEditDialog(id widget.TableCellID) {
    rowIdx := id.Row - 1 + (r.page * r.pageSize)
    currentVal := fmt.Sprintf("%v", r.data[rowIdx][id.Col])

    entry := widget.NewEntry()
    entry.SetText(currentVal)

    dialog.ShowCustomConfirm(
        fmt.Sprintf("Edit — %s", r.columns[id.Col]),
        "Apply", "Cancel",
        entry,
        func(confirmed bool) {
            if !confirmed { return }
            newVal := entry.Text

            // Đếm selected cells trong cùng cột
            sameColSelected := r.getSelectedInColumn(id.Col)

            if len(sameColSelected) > 1 {
                // Hỏi: Áp dụng cho tất cả selected cells cùng cột?
                dialog.NewConfirm(
                    "Batch Edit",
                    fmt.Sprintf("Apply \"%s\" to all %d selected cells in column \"%s\"?",
                        newVal, len(sameColSelected), r.columns[id.Col]),
                    func(applyAll bool) {
                        if applyAll {
                            for _, cellID := range sameColSelected {
                                r.edited[cellID] = newVal
                            }
                        } else {
                            r.edited[id] = newVal
                        }
                        r.table.Refresh()
                    },
                    r.parent,
                ).Show()
            } else {
                r.edited[id] = newVal
                r.table.Refresh()
            }
        },
        r.parent,
    )
}

func (r *ResultTableWidget) getSelectedInColumn(col int) []widget.TableCellID {
    var result []widget.TableCellID
    for cellID := range r.selected {
        if cellID.Col == col {
            result = append(result, cellID)
        }
    }
    return result
}
```

> Trong MVP, `r.edited` là **local-only** — không commit về database. Export sẽ include các edited values.

## Pagination (cho datasets > 5000 rows)

```go
func (r *ResultTableWidget) Widget() fyne.CanvasObject {
    r.table = r.buildTable()

    if len(r.data) <= r.pageSize {
        // Không cần pagination
        return r.table
    }

    // Pagination controls
    pageLabel := widget.NewLabel(r.pageInfo())
    prevBtn := widget.NewButton("← Prev", func() {
        if r.page > 0 {
            r.page--
            pageLabel.SetText(r.pageInfo())
            r.table.Refresh()
        }
    })
    nextBtn := widget.NewButton("Next →", func() {
        if (r.page+1)*r.pageSize < len(r.data) {
            r.page++
            pageLabel.SetText(r.pageInfo())
            r.table.Refresh()
        }
    })

    controls := container.NewHBox(prevBtn, pageLabel, nextBtn)
    return container.NewBorder(nil, controls, nil, nil, r.table)
}

func (r *ResultTableWidget) pageRows() [][]interface{} {
    start := r.page * r.pageSize
    end := start + r.pageSize
    if end > len(r.data) { end = len(r.data) }
    return r.data[start:end]
}

func (r *ResultTableWidget) pageInfo() string {
    total := len(r.data)
    start := r.page*r.pageSize + 1
    end := (r.page+1) * r.pageSize
    if end > total { end = total }
    return fmt.Sprintf("%d–%d of %d", start, end, total)
}
```

## UpdateData

```go
func (r *ResultTableWidget) UpdateData(result *models.QueryResult) {
    r.data = result.Rows
    r.columns = result.Columns
    r.selected = make(map[widget.TableCellID]struct{})
    r.edited = make(map[widget.TableCellID]string)
    r.page = 0
    // widget.Table.Refresh() là thread-safe
    r.table.Refresh()
}
```

## Performance Guidelines

- `widget.Table` dùng **virtual rendering** — chỉ render visible cells → đủ cho 1,000–5,000 rows
- Với > 5,000 rows: bật pagination (`pageSize = 500`)
- Không load toàn bộ `[][]interface{}` vào memory nếu > 50,000 rows (ngoài scope MVP)
- Column width: `table.SetColumnWidth(col, width)` — set uniform width ban đầu, cho phép resize sau

## Type Display Convention

```go
func formatCellValue(v interface{}) string {
    if v == nil { return "NULL" }
    switch val := v.(type) {
    case []byte:
        return string(val)
    case time.Time:
        return val.Format("2006-01-02 15:04:05")
    default:
        return fmt.Sprintf("%v", val)
    }
}
```
