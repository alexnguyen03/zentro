### Specification 3: Multi-Tab Query Editor

**Mô tả tổng quan**: Giao diện viết và quản lý nhiều query đồng thời trong các tab riêng biệt, sử dụng Monaco Editor cho SQL editing, tích hợp với execution engine qua Wails events.

**Yêu cầu chức năng**:
- **Multi-tab management**: Thêm/đóng/rename tab động. Mỗi tab có editor + result panel riêng.
- **Editor features**: Monaco Editor với SQL syntax highlighting, IntelliSense (table/column names từ schema), Ctrl+Enter to run, F2 to rename tab.
- **Split view**: Mỗi tab = vertical split (editor trên, result panel dưới).
- **Unsaved prompt**: Khi đóng tab có query text chưa run, hiện confirm dialog.
- **Tab state**: Mỗi tab lưu `{ id, title, query, lastResult, isRunning, isModified }`.

**UI Components** (React):

**`QueryTabs.tsx`** — Container chính:
```typescript
interface TabState {
  id: string           // UUID
  title: string        // profile name hoặc custom rename
  query: string        // nội dung editor
  isRunning: boolean
  isModified: boolean
  lastResult?: QueryResult
}
```
- Render `<TabBar>` (drag-to-reorder, close button, right-click context menu).
- Render active tab's `<MonacoEditor>` + `<ResultPanel>` (VSplit).

**`TabBar.tsx`**:
- Tabs có close button (×).
- Double-click hoặc F2 → inline rename (contenteditable hoặc input overlay).
- Right-click context menu: Close Tab / Rename / Close Other Tabs / Close All.

**`MonacoEditor.tsx`**:
```typescript
// Monaco setup
monaco.editor.create(el, {
  language: "sql",
  theme: "vs-dark" | "vs",      // sync với app theme
  fontSize: prefs.fontSize,
  minimap: { enabled: false },  // Zen: không cần minimap
  automaticLayout: true,
})
// Override Ctrl+Enter — Monaco dùng nó cho suggestion, cần rebind:
editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
  editorStore.runCurrentTab()
})
// Register SQL completionProvider từ schema store
monaco.languages.registerCompletionItemProvider("sql", {
  provideCompletionItems: () => schemaStore.getCompletionItems()
})
```

**`ResultPanel.tsx`**:
- Khi `isRunning=true`: hiển thị spinner.
- Khi `lastResult` có data: render `<ResultTable>` (xem Spec 4).
- Khi `lastResult.error` không rỗng: render error message dạng `<pre>`.
- Khi chưa có result: hiển thị placeholder.

**Wiring với Backend**:
```typescript
// Khi user nhấn Run:
const runQuery = (tab: TabState) => {
  ExecuteQuery(tab.id, tab.query)   // Wails binding call (non-blocking)
}

// Nhận kết quả:
Events.On("query:result", (payload) => {
  editorStore.setTabResult(payload.tabID, payload)
})
```

**State Management** (`editorStore.ts` — Zustand):
```typescript
interface EditorStore {
  tabs: TabState[]
  activeTabId: string | null
  addTab: (profile: ConnectionProfile) => void
  closeTab: (id: string) => void
  renameTab: (id: string, title: string) => void
  setTabQuery: (id: string, query: string) => void
  setTabRunning: (id: string, running: boolean) => void
  setTabResult: (id: string, result: QueryResult) => void
  runCurrentTab: () => void     // calls ExecuteQuery binding
}
```

**Keyboard Shortcuts**:
| Shortcut | Action |
|---|---|
| `Ctrl+Enter` | Run query trong tab hiện tại |
| `F2` | Rename tab hiện tại |
| `Ctrl+W` | Close tab hiện tại (với unsaved prompt) |
| `Ctrl+T` | New tab (nếu đã connected) |

**Edge Cases**:
- Tab với query > 10k chars: Monaco handle được, không cần giới hạn.
- Kết quả quá lớn: `ResultPanel` dùng virtual scrolling (TanStack Table).
- Tab bị đóng trong khi query đang chạy: `CancelQuery()` được gọi automatic.

**Sprint Planning**:
- **Phase 3**: Implement `MonacoEditor`, `QueryTabs`, `TabBar`, wire Wails events.
