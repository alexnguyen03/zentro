---
name: zentro-project-architecture
description: >
  Định nghĩa cấu trúc thư mục, dependency rules giữa các layer, naming
  conventions, và go.mod dependencies chuẩn cho toàn bộ dự án Zentro.
  Phải đọc trước khi tạo bất kỳ file Go nào trong dự án.
---

# Skill 01: Project Architecture & Code Conventions

## Cấu trúc thư mục cố định

```
zentro/
├── cmd/
│   └── zentro/
│       └── main.go          // Entry point DUY NHẤT — khởi tạo app, window, wiring
├── internal/
│   ├── ui/                  // Fyne widgets & layouts (không chứa business logic)
│   │   ├── mainwindow.go    // Main window, toolbar, status bar
│   │   ├── connection/      // Connection dialog & list widget
│   │   ├── editor/          // Query tab & editor widget
│   │   └── result/          // Result table widget
│   ├── db/                  // Database logic (không import Fyne)
│   │   ├── executor.go      // Query execution
│   │   ├── connector.go     // sql.Open, ping, connection string build
│   │   └── history.go       // Query history persistence
│   ├── models/              // Shared data structs (không import Fyne hoặc db)
│   │   ├── connection.go    // ConnectionProfile
│   │   └── query.go         // QueryResult, HistoryEntry
│   └── utils/               // Config, logging helpers (không import ui hoặc db)
│       ├── logger.go        // slog setup
│       └── prefs.go         // Fyne Preferences wrappers
├── go.mod
└── go.sum
```

## Dependency Rules (bắt buộc, không được vi phạm)

| Layer | Được import | Không được import |
|---|---|---|
| `models` | stdlib only | `ui`, `db`, `utils` |
| `db` | `models`, stdlib | `ui` |
| `utils` | `models`, stdlib, fyne prefs | `ui`, `db` |
| `ui` | `models`, `db`, `utils`, fyne | — |
| `main.go` | tất cả | — |

> `main.go` là nơi **duy nhất** wire tất cả dependencies lại với nhau.

## Naming Conventions

- Fyne widget constructor: `New<WidgetName>(deps...)` → trả về struct pointer
- Internal types không export nếu chỉ dùng trong package
- Tất cả exported function phải có Go doc comment
- Error wrapping: `fmt.Errorf("package: operation failed: %w", err)`
- Constant keys cho Preferences: dạng `"zentro.<key>"` (xem Skill 08)

## go.mod Dependencies

```
fyne.io/fyne/v2 v2.5.x
github.com/jackc/pgx/v5 v5.x      // dùng pgx/v5/stdlib adapter cho database/sql
github.com/microsoft/go-mssqldb v1.x
```

Không thêm dependency ngoài danh sách trên nếu không có lý do rõ ràng.
