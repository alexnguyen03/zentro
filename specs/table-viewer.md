### Specification 4: Result Grid / Table Viewer

**Mô tả tổng quan**: Hiển thị và tương tác với kết quả query dưới dạng bảng. Hỗ trợ virtual scrolling cho large datasets, multi-cell selection, và batch edit.

**Yêu cầu chức năng**:
- Dynamic table từ stream: append rows live khi nhận `query:chunk` events.
- Virtual scrolling — target **50k rows** không lag (TanStack Virtual benchmarked).
- Multi-select cells: click + Shift/Ctrl. Selection highlight.
- Batch edit: chọn nhiều cells trong **cùng một cột** → nhập giá trị mới → propagate đến tất cả selected cells.
- Sort header: client-side, chỉ active sau `query:done` (không sort trong khi streaming).
- Row numbering: cột đầu tiên là số thứ tự (không phải data).

**UI Component** (`ResultTable.tsx`):

**Library**: TanStack Table v8 + TanStack Virtual (row virtualizer).

```typescript
// Data shape nhận từ Wails event "query:result"
interface QueryResult {
  tabID: string
  columns: string[]
  rows: string[][]    // tất cả values đã stringify từ Go
  affected: number
  duration: number    // ms
  isSelect: boolean
  error: string
}

// Selection state
interface CellSelection {
  rowIndex: number
  colIndex: number
}
```

**Streaming Append**:
```typescript
// Khi nhận query:chunk, append vào store — grid tự động render rows mới
Events.On("query:chunk", ({ tabID, columns, rows, seq }) => {
    if (seq === 0 && columns) resultStore.setColumns(tabID, columns)
    resultStore.appendRows(tabID, rows)   // mỷ key: append, không replace
})
Events.On("query:done", ({ tabID }) => {
    resultStore.setDone(tabID)   // unlock sort, show final row count
})
```

**Tránh full re-render khi append**: `resultStore.appendRows` dùng immer hoặc direct mutation:
```typescript
appendRows: (tabID, newRows) => set(state => {
    state.rows[tabID] = [...(state.rows[tabID] ?? []), ...newRows]
    // Zustand + immer: chỉ notify subscriber của rows[tabID], không re-render toàn app
}),
```

```typescript
const applyBatchEdit = (value: string, colIndex: number) => {
  const selectedInCol = selection.filter(c => c.colIndex === colIndex)
  selectedInCol.forEach(({ rowIndex }) => {
    tableData[rowIndex][colIndex] = value
  })
  setTableData([...tableData])  // trigger re-render
}
```

**Sort** (chỉ sau `query:done`):
```typescript
// TanStack Table built-in sorting
const [sorting, setSorting] = useState<SortingState>([])
const isSortable = resultStore.isDone(tabID)   // disable sort khi đang stream
```

**Virtual Scrolling**:
```typescript
import { useVirtualizer } from "@tanstack/react-virtual"
const rowVirtualizer = useVirtualizer({
  count: rows.length,
  getScrollElement: () => tableContainerRef.current,
  estimateSize: () => 30,   // row height px
  overscan: 20,
})
```

**Non-SELECT results**:
- Không hiện table.
- Hiện message: `"✓ X rows affected (Xms)"`.

**Error state**:
- Hiện `<pre className="error-panel">` với full error text từ Go.
- Không truncate — này là core UX (từ Skill 12: error display đầy đủ).

**Type Display**:
- Tất cả values từ Go là `string` — hiển thị as-is.
- NULL: Go serialize thành `"NULL"` string, hiển thị với opacity thấp hơn.
- Số rất dài (BIGINT): đã là string, không mất precision.

**State Management** (`resultStore.ts` — Zustand):
```typescript
interface ResultStore {
  results: Record<string, QueryResult>   // keyed by tabID
  selections: Record<string, CellSelection[]>
  dirtyData: Record<string, string[][]>  // local edits (không commit về DB)
  setResult: (tabID: string, r: QueryResult) => void
  setSelection: (tabID: string, s: CellSelection[]) => void
  applyEdit: (tabID: string, col: number, value: string) => void
}
```

> **Note MVP**: Batch edit chỉ thay đổi data local (in-memory). Commit về DB (UPDATE statements) là post-MVP feature.

**Edge Cases**:
- 0 rows: hiện "Query returned 0 rows" message.
- 1000+ columns: header scrolls horizontally, column widths đồng đều.
- Binary/blob data: hiển thị `[BINARY]` placeholder.

**Sprint Planning**:
- **Phase 4**: Implement `ResultTable`, virtual scrolling, selection, batch edit.
