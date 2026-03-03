---
name: zentro-logging
description: >
  Định nghĩa slog logger setup, các log patterns chuẩn (query execution, connection
  events, errors), và cách inject logger vào AppState cho Zentro. Logger dùng
  structured logging với slog để dễ filter và parse.
---

# Skill 09: Logging

## Setup (internal/utils/logger.go)

```go
// NewLogger khởi tạo slog.Logger.
// logToFile=true sẽ ghi thêm vào "zentro.log" trong thư mục hiện tại.
func NewLogger(logToFile bool) *slog.Logger {
    textHandler := slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{
        Level: slog.LevelInfo,
    })

    if !logToFile {
        return slog.New(textHandler)
    }

    f, err := os.OpenFile("zentro.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
    if err != nil {
        // Fallback to stderr only nếu không mở được file
        return slog.New(textHandler)
    }

    fileHandler := slog.NewJSONHandler(f, &slog.HandlerOptions{
        Level: slog.LevelDebug,
    })

    return slog.New(newMultiHandler(textHandler, fileHandler))
}
```

### MultiHandler (nếu cần ghi cả stderr lẫn file)

```go
type multiHandler struct {
    handlers []slog.Handler
}

func newMultiHandler(handlers ...slog.Handler) slog.Handler {
    return &multiHandler{handlers: handlers}
}

func (m *multiHandler) Enabled(ctx context.Context, level slog.Level) bool {
    for _, h := range m.handlers {
        if h.Enabled(ctx, level) { return true }
    }
    return false
}

func (m *multiHandler) Handle(ctx context.Context, r slog.Record) error {
    for _, h := range m.handlers {
        if h.Enabled(ctx, r.Level) {
            h.Handle(ctx, r)
        }
    }
    return nil
}

func (m *multiHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
    newHandlers := make([]slog.Handler, len(m.handlers))
    for i, h := range m.handlers { newHandlers[i] = h.WithAttrs(attrs) }
    return newMultiHandler(newHandlers...)
}

func (m *multiHandler) WithGroup(name string) slog.Handler {
    newHandlers := make([]slog.Handler, len(m.handlers))
    for i, h := range m.handlers { newHandlers[i] = h.WithGroup(name) }
    return newMultiHandler(newHandlers...)
}
```

## Log Patterns Chuẩn

### Connection Events

```go
// Kết nối thành công
logger.Info("connection established",
    "profile", profile.Name,
    "driver", profile.Driver,
    "host", profile.Host,
    "port", profile.Port,
)

// Kết nối thất bại
logger.Error("connection failed",
    "profile", profile.Name,
    "err", err,
)

// Test connection
logger.Debug("testing connection", "profile", profile.Name)
```

### Query Execution

```go
// Query bắt đầu
logger.Info("query started",
    "tab", tabState.ID,
    "profile", tabState.ProfileName,
    "is_select", executor.IsSelectQuery(query),
)

// Query kết thúc thành công
logger.Info("query completed",
    "tab", tabState.ID,
    "duration_ms", result.Duration.Milliseconds(),
    "rows", len(result.Rows),
    "affected", result.Affected,
)

// Query thất bại
logger.Error("query failed",
    "tab", tabState.ID,
    "duration_ms", result.Duration.Milliseconds(),
    "err", result.Err,
)

// Query bị cancel
logger.Info("query cancelled", "tab", tabState.ID)
```

### Preferences & Startup

```go
// Load connections
logger.Info("loaded connections", "count", len(connections))

// Load error (non-fatal)
logger.Warn("failed to load connections", "err", err)

// Preferences apply
logger.Debug("applying preferences", "theme", utils.GetTheme(app))
```

## Inject Logger vào AppState

```go
// main.go
logger := utils.NewLogger(false) // false = stderr only cho MVP
state := &AppState{
    Logger: logger,
    ...
}
```

Tất cả components nhận `*slog.Logger` qua `AppState` — **không dùng `slog.Default()`** hoặc package-level logger trong internal packages.

## Log Level Guidelines

| Level | Khi nào dùng |
|---|---|
| `Debug` | Chi tiết nội bộ (preferences load, tab state changes) |
| `Info` | Events quan trọng (connection, query start/end) |
| `Warn` | Non-fatal errors (history save fail, load error với fallback) |
| `Error` | Fatal-ish errors (connection fail, query fail) |

## MVP Configuration

- Trong MVP: chỉ log ra **stderr** (`logToFile = false`)
- File log là opt-in — thêm flag `--log-file` trong future nếu cần
- Không log password hay connection string đầy đủ (security)
