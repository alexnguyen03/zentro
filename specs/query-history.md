### Specification 9: Query History

**Mô tả**: Lưu và hiển thị lịch sử các query đã thực thi.

**Storage** — append vào `config.json` phần `history`, hoặc file riêng `history.json`:
```go
// models.HistoryEntry (giữ nguyên)
type HistoryEntry struct {
    Query      string    `json:"query"`
    ExecutedAt time.Time `json:"executed_at"`
    DurationMs int64     `json:"duration_ms"`
    Success    bool      `json:"success"`
    RowCount   int       `json:"row_count"`
    Profile    string    `json:"profile"`
}
```

**Backend API** (`internal/app/app.go`):
```go
func (a *App) GetHistory() ([]models.HistoryEntry, error)
func (a *App) AppendHistory(e models.HistoryEntry) error
func (a *App) ClearHistory() error
```

`AppendHistory` được gọi tự động từ `ExecuteQuery` sau khi query hoàn thành.

**Frontend** — History Panel (sidebar section hoặc modal):
```typescript
// Hiển thị list entries, click để paste query vào active tab
const loadHistory = async () => {
  const entries = await GetHistory()
  historyStore.setEntries(entries)
}
// Paste vào editor:
const useEntry = (entry: HistoryEntry) => {
  editorStore.setActiveTabQuery(entry.query)
}
```

**Edge Cases**:
- Giới hạn 500 entries — cũ hơn bị xoá (rotate).
- Nếu file bị corrupt: log warning, reset về empty array.

**Sprint Planning**: **Phase 5**.
