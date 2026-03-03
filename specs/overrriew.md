### 1. Project Overview
- **Tên ứng dụng**: Zentro
- **Mô tả**: Một ứng dụng desktop SQL client nhẹ, tập trung vào việc kết nối, truy vấn và chỉnh sửa dữ liệu trên cơ sở dữ liệu PostgreSQL và Microsoft SQL Server (MSSQL). Ứng dụng ưu tiên tốc độ khởi động, tiêu thụ tài nguyên thấp, và giao diện đơn giản, tránh các tính năng thừa.
- **Mục tiêu chính của MVP**:
  - Kết nối ổn định đến PostgreSQL và MSSQL.
  - Hỗ trợ viết và thực thi query trong nhiều tab độc lập.
  - Hiển thị và chỉnh sửa kết quả query dưới dạng grid (table), bao gồm batch edit trên các cell đã chọn.
  - Cross-platform: Windows và macOS (Linux tùy chọn).
  - Khởi động nhanh (< 2 giây), binary standalone.
- **Phiên bản MVP**: 0.1.0 (chỉ hỗ trợ 2 database types).

### 2. Target Audience & Use Cases
- Đối tượng chính: Developer và DBA cá nhân, cần một công cụ nhanh để kiểm tra query, debug dữ liệu.
- Use cases chính trong MVP:
  - Kết nối nhanh đến local/remote database.
  - Viết multi-tab SQL queries (SELECT, INSERT, UPDATE, DELETE cơ bản).
  - Xem kết quả dưới dạng bảng, sort/filter cơ bản.
  - Chỉnh sửa dữ liệu trực tiếp trên grid (single cell hoặc batch edit trên selection).
  - Export kết quả đơn giản (CSV).

### 3. Key Technical Constraints & Goals
- **Ngôn ngữ & Framework**:
  - Go 1.22+ (backend — business logic, DB drivers, query execution).
  - **Wails v2** (desktop shell — embeds WebView2/WebKit, exposes Go methods to JS).
  - **React 18 + TypeScript + Vite** (frontend UI — chạy trong WebView).
- **Database Support**:
  - PostgreSQL (driver: pgx/v5).
  - Microsoft SQL Server (driver: microsoft/go-mssqldb).
- **Cross-Platform**:
  - Build native binaries cho Windows (amd64) và macOS (amd64/arm64).
  - Sử dụng `wails build` với target platform flags.
- **Performance Targets**:
  - Startup time: < 2 giây (WebView init overhead chấp nhận được).
  - RAM usage idle: < 150 MB (bao gồm WebView2 runtime).
  - Xử lý result sets lên đến 10.000 rows không lag UI (TanStack Table virtual scrolling).
- **Security**:
  - Lưu connection profiles với password base64-encoded trong JSON file.
  - Không hỗ trợ SSH tunnel hoặc advanced auth trong MVP.

### 4. Core Features (MVP Scope)
| Feature Category          | Mô tả chi tiết                                                                 | Ưu tiên (MVP) |
|---------------------------|--------------------------------------------------------------------------------|---------------|
| **Connection Management** | Tạo, chỉnh sửa, xóa connection profiles; Test connection; Lưu bằng JSON file. | Cao           |
| **Query Editor**          | Multi-tab (React tabs); Monaco Editor; SQL syntax highlighting + IntelliSense; Run query (Ctrl+Enter). | Cao           |
| **Result Viewer**         | TanStack Table virtual rows; Multi-selection cells; Single/batch edit (propagate value đến selected cells cùng cột); Sort header; Pagination nếu rows lớn. | Cao           |
| **Execution**             | Async query (Go goroutine); Wails EventsEmit để push kết quả về frontend; Cancel via context. | Cao           |
| **UI Layout**             | Toolbar; Sidebar (connection tree); Central tabbed area; Status bar.           | Cao           |
| **Export**                | Export result table sang CSV (Go `encoding/csv`, OS save dialog qua Wails runtime). | Trung bình    |
| **Preferences**           | Theme toggle (light/dark via CSS variables); Default row limit; Font size.     | Trung bình    |
| **Logging & Debug**       | slog cho logging (file + console).                                             | Thấp          |

### 5. Out of Scope cho MVP
- Schema browser đầy đủ (advanced column metadata, FK diagram).
- Advanced query tools (multi-statement execution, formatter).
- Support thêm database (MySQL, SQLite).
- Import data, user/role management, backup/restore.
- Charting/visualization, plugin system.

### 6. Project Structure Outline (High-level)
```
Zentro/
├── cmd/
│   └── zentro/
│       └── main.go               // Entry point — wails.Run(), driver registration
├── internal/
│   ├── app/                      // [NEW] Wails App struct — backend API surface
│   │   └── app.go               // All @wails:method bound methods
│   ├── db/                       // Query execution, connection, schema (unchanged)
│   ├── driver/                   // DB driver interfaces + postgres/mssql adapters (unchanged)
│   ├── models/                   // Shared structs (unchanged)
│   ├── core/                     // Plugin registry (unchanged)
│   └── utils/                    // logger.go (unchanged); prefs.go (rewritten, no Fyne)
├── frontend/                     // [NEW] React app
│   ├── src/
│   │   ├── components/           // Sidebar, Editor, ResultGrid, Toolbar, StatusBar
│   │   ├── stores/               // Zustand stores
│   │   └── wailsjs/              // Auto-generated Go→TS bindings
│   └── package.json
├── wails.json
└── go.mod
```

### 7. Architecture — Wails Communication Pattern
```
Frontend (React)          Wails Bridge              Backend (Go)
─────────────────────────────────────────────────────────────────
LoadConnections()      →  IPC call           →  app.LoadConnections()
ExecuteQuery(q)        →  IPC call           →  app.ExecuteQuery()
                       ←  EventsEmit         ←  "query:started"
                       ←  EventsEmit         ←  "query:result" { columns, rows, ... }
schema update          ←  EventsEmit         ←  "schema:loaded" { databases }
```

**Pattern chính**: Observer — Go goroutines push events (`runtime.EventsEmit`), React listeners (`Events.On`) consume và update Zustand store.

### 8. Design Patterns (bắt buộc từ Skill 12)
| Pattern | Áp dụng tại |
|---|---|
| Singleton | `App` struct (một instance trong `main.go`) |
| Factory / Plugin | `core.Register()` + `driver.DatabaseDriver` interface |
| Facade | `internal/db` — che giấu driver dispatch khỏi `internal/app` |
| Observer | Wails `EventsEmit` → React `Events.On` |
| Dependency Injection | `App` nhận `logger`, drivers qua `main.go`, không hardcode |
| Hexagonal / Ports & Adapters | `driver.DatabaseDriver` interface = Port; postgres/mssql = Adapters |

### 9. Development Roadmap (High-level Phases)
1. **Phase 1**: Wails scaffold + Backend API (`internal/app/app.go`) + prefs.go rewrite (tuần 1–2).
2. **Phase 2**: Frontend layout + Sidebar / Connection tree (tuần 3–4).
3. **Phase 3**: Monaco Editor + QueryTabs + Execution flow (tuần 5–6).
4. **Phase 4**: Result Grid (TanStack) + batch edit + Export CSV (tuần 7–9).
5. **Phase 5**: Preferences/settings + query history + cross-platform build (tuần 10–11).
