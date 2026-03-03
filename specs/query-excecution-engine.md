### Specification 2: Query Execution Engine

**Mô tả tổng quan**: Module xử lý thực thi SQL. Backend logic (`internal/db/executor.go`) **giữ nguyên**. Lớp streaming và event contract được thêm tại `internal/app/app.go`. Target: **50k rows** hiển thị progressive qua chunk events.

**Yêu cầu chức năng**:
- Thực thi bất kỳ SQL nào (SELECT, INSERT, UPDATE, DELETE, DDL).
- SELECT results: streaming theo chunks (500 rows/chunk), không buffer toàn bộ.
- Non-SELECT: trả về affected rows qua `query:done`.
- Cancel query per tab (không ảnh hưởng các tab khác).
- Inject LIMIT nếu query SELECT không có (default từ `prefs.defaultLimit`).

---

### QuerySession (mới)

```go
// Pattern: Singleton-per-tab — một session per tabID, hủy sau khi done/cancel.
type QuerySession struct {
    TabID      string
    CancelFunc context.CancelFunc
    StartedAt  time.Time
}

// App giữ map sessions để CancelQuery(tabID) chỉ hủy đúng tab.
type App struct {
    ...
    sessions map[string]*QuerySession  // key = tabID
}
```

---

### Event Contract (agreed Phase 1)

| Event | Direction | Payload |
|---|---|---|
| `query:started` | Go → JS | `{ tabID }` |
| `query:chunk` | Go → JS | `{ tabID, columns?: string[], rows: string[][], seq: number }` |
| `query:done` | Go → JS | `{ tabID, affected: number, duration: number, isSelect: bool, error?: string }` |

- `columns` chỉ có trong chunk đầu tiên (`seq == 0`).
- `rows` là `[][]string` — tất cả values đã stringify để JSON-safe qua Wails bridge.
- NULL: serialized thành chuỗi rỗng `""` hoặc `"NULL"` — frontend quyết định hiển thị.

---

### Backend API (`internal/app/app.go`)

```go
// ExecuteQuery — void return. Kết quả hoàn toàn qua events.
// Pattern: Observer — goroutine emit events, frontend consume không blocking.
func (a *App) ExecuteQuery(tabID, query string) {
    // Hủy session cũ nếu tab đang chạy
    if old, ok := a.sessions[tabID]; ok {
        old.CancelFunc()
    }

    ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
    a.sessions[tabID] = &QuerySession{TabID: tabID, CancelFunc: cancel, StartedAt: time.Now()}

    runtime.EventsEmit(a.ctx, "query:started", map[string]any{"tabID": tabID})

    go func() {
        defer func() {
            cancel()
            delete(a.sessions, tabID)
        }()

        if db.IsSelectQuery(query) {
            a.streamSelect(ctx, tabID, query)
        } else {
            a.execNonSelect(ctx, tabID, query)
        }
    }()
}

func (a *App) streamSelect(ctx context.Context, tabID, query string) {
    normalized := db.InjectLimitIfMissing(query, a.prefs.DefaultLimit)
    rows, err := a.db.QueryContext(ctx, normalized)
    if err != nil {
        emitDone(a.ctx, tabID, 0, time.Since(a.sessions[tabID].StartedAt), true, err)
        return
    }
    defer rows.Close()

    cols, _ := rows.Columns()
    seq, buf := 0, make([][]string, 0, 500)
    start := time.Now()

    for rows.Next() {
        row := scanRowAsStrings(rows, len(cols))
        buf = append(buf, row)
        if len(buf) == 500 {
            runtime.EventsEmit(a.ctx, "query:chunk", chunkPayload(tabID, cols, buf, seq))
            cols, buf, seq = nil, buf[:0], seq+1  // cols chỉ gửi lần đầu
        }
    }
    if len(buf) > 0 {
        runtime.EventsEmit(a.ctx, "query:chunk", chunkPayload(tabID, cols, buf, seq))
    }
    emitDone(a.ctx, tabID, 0, time.Since(start), true, rows.Err())
}

// CancelQuery hủy query đang chạy trong tab được chỉ định.
func (a *App) CancelQuery(tabID string) {
    if s, ok := a.sessions[tabID]; ok {
        s.CancelFunc()
    }
}
```

**Xuất `InjectLimitIfMissing` từ `executor.go`**: hiện là unexported `injectLimitIfMissing` — cần rename thành exported hoặc move sang `app.go`.

---

### `internal/db/executor.go` — Thay đổi tối thiểu

- `IsSelectQuery` — giữ nguyên (đã exported).
- `streamRows` — KHÔNG dùng nữa từ `app.go` (streaming được handle trực tiếp ở app layer).
- `ExecuteQuery` channel-based — vẫn giữ cho unit tests, nhưng `app.go` không gọi nữa.
- `injectLimitIfMissing` → export thành `InjectLimitIfMissing`.

---

### Frontend Consumption (`editorStore.ts`)

```typescript
// Khởi tạo listeners 1 lần khi app mount
Events.On("query:started", ({ tabID }) => {
    editorStore.setTabRunning(tabID, true)
    resultStore.clearResult(tabID)
    statusStore.setStatus("Running…")
})

Events.On("query:chunk", ({ tabID, columns, rows, seq }) => {
    if (seq === 0 && columns) resultStore.setColumns(tabID, columns)
    resultStore.appendRows(tabID, rows)   // append, không replace
})

Events.On("query:done", ({ tabID, affected, duration, isSelect, error }) => {
    editorStore.setTabRunning(tabID, false)
    statusStore.setQueryInfo(duration, resultStore.rowCount(tabID), error)
    if (error) statusStore.setError(error)
})
```

**`resultStore.appendRows`** phải trigger virtual grid re-render hiệu quả — dùng Zustand `immer` hoặc direct mutation với `[...prev, ...newRows]` tránh full re-render.

---

### Edge Cases
- `db == nil`: emit `query:done` với `error: "No active connection"` ngay lập tức.
- Context bị cancel giữa chừng: goroutine thoát, emit `query:done` với `error: "Query cancelled"`.
- Tab đóng giữa stream: frontend ignore `query:chunk` / `query:done` với tabID không tồn tại.
- Concurrent tabs: mỗi tab có session riêng — có thể chạy song song nếu multiple `*sql.DB` connections (post-MVP). MVP: một connection chung, nhưng sessions map vẫn đúng cấu trúc.

**Sprint Planning**: Phase 2 (streaming engine) + Phase 4 (frontend event listeners).
