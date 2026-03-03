### Specification 1: Connection Management

**Mô tả tổng quan**: Quản lý kết nối đến PostgreSQL và MSSQL. Là nền tảng cốt lõi của Zentro — tạo, chỉnh sửa, xóa, kiểm tra connection. Phạm vi MVP, không bao gồm SSH tunneling hoặc MFA.

**Yêu cầu chức năng chi tiết**:
- **Tạo connection profile**: Nhập thông tin, lưu cục bộ dạng JSON, tải lại khi mở app.
- **Chỉnh sửa connection profile**: Sửa fields hiện có, lưu và test lại nếu cần.
- **Xóa connection profile**: Xóa khỏi danh sách với confirm dialog.
- **Danh sách connections**: Hiển thị dưới dạng tree (Sidebar), click để connect.
- **Test connection**: Ping database, trả về thành công/thất bại với message cụ thể.

**Các field dữ liệu** (`models.ConnectionProfile` — giữ nguyên):
- `Name` (string, required, unique, max 50 chars)
- `Driver` ("postgres" | "sqlserver", required)
- `Host` (string, required, default "localhost")
- `Port` (integer, required, default 5432/1433)
- `DBName` (string, required)
- `Username` (string, required)
- `Password` (string, base64-encoded khi `SavePassword=true`)
- `SSLMode` (string, postgres only: "disable" | "require")
- `ConnectTimeout` (integer, default 30s)
- `SavePassword` (bool)

**UI Elements** (React components):
- **`ConnectionDialog` modal**: Form với inputs cho từng field, `<select>` cho Driver, checkbox cho SSLMode/SavePassword. Buttons: "Test Connection", "Save", "Cancel".
- **`ConnectionTree`** (trong Sidebar): Tree view hiển thị tên + driver icon. Right-click context menu: Connect / Edit / Delete. Active connection hiển thị indicator (●).
- **`ToolbarButton` "New Connection"**: mở `ConnectionDialog` để tạo mới.
- **Status indicator trong StatusBar**: `⬤ ProfileName (postgres)` khi connected.

**Backend API** (`internal/app/app.go` — Wails methods):
```go
func (a *App) LoadConnections() ([]*models.ConnectionProfile, error)
func (a *App) SaveConnection(p models.ConnectionProfile) error   // create + update
func (a *App) DeleteConnection(name string) error
func (a *App) TestConnection(p models.ConnectionProfile) error   // Ping only
func (a *App) Connect(name string) error                         // open + ping + emit events
func (a *App) Disconnect()
```

**Storage** (`internal/utils/prefs.go` — rewritten):
- File: `os.UserConfigDir()/zentro/config.json`
- Format: `{ "connections": [...], "preferences": {...} }`
- Password: base64-encoded khi `SavePassword=true`, empty string nếu false.
- **Không còn dùng Fyne Preferences** — xóa `fyne.App` khỏi tất cả signatures.

**Logic Backend** (không thay đổi):
- `db.OpenConnection(p)` → `core.Get(driver).Open(p)` (Factory + Facade).
- `db.TestConnection(p)` → `db.Ping()` với 10s timeout.
- `db.FriendlyError(driver, err)` → user-friendly message.

**Wails Events sau khi Connect thành công**:
```
"connection:changed"  → { profile: ConnectionProfile, status: "connected" }
"schema:loading"      → {}
"schema:loaded"       → { databases: DatabaseInfo[] }
```

**Edge Cases**:
- Invalid input: validate trên frontend trước khi gọi backend.
- Duplicate name: `SaveConnection` trả về error nếu name đã tồn tại (với profile khác).
- Connection failure: emit `"connection:error"` với friendly message.
- 50+ profiles: list scrollable, không ảnh hưởng performance (virtual tree nếu cần).

**Dependency Rules** (từ Skill 01):
- `models` ← `db` ← `app` ← `main.go`
- `utils/prefs.go` chỉ import `models` + stdlib (không import `db` hoặc `app`).

**Sprint Planning**:
- **Phase 1**: Rewrite `prefs.go`, implement `SaveConnection`, `LoadConnections`, `DeleteConnection`, `TestConnection`.
- **Phase 2**: Build `ConnectionDialog`, `ConnectionTree` React components, wire Wails bindings.
