---
name: zentro-connection-management
description: >
  Định nghĩa struct ConnectionProfile, các hàm backend (build connection string,
  test connection, open connection), persistence bằng Fyne Preferences, và UI
  dialog/list widget cho quản lý connection profiles trong Zentro.
---

# Skill 02: Connection Management

## Struct (internal/models/connection.go)

```go
type ConnectionProfile struct {
    Name           string `json:"name"`               // required, unique, max 50
    Driver         string `json:"driver"`             // "postgres" | "sqlserver"
    Host           string `json:"host"`               // default "localhost"
    Port           int    `json:"port"`               // 5432 (pg) | 1433 (mssql)
    DBName         string `json:"db_name"`            // required
    Username       string `json:"username"`           // required
    Password       string `json:"password"`           // base64 encoded khi lưu
    SSLMode        string `json:"ssl_mode,omitempty"` // postgres only: "disable"|"require"
    ConnectTimeout int    `json:"connect_timeout"`    // default 30 (seconds)
    SavePassword   bool   `json:"save_password"`
}
```

## Backend API (internal/db/connector.go)

```go
func BuildConnectionString(p *models.ConnectionProfile) string
func TestConnection(p *models.ConnectionProfile) error
func OpenConnection(p *models.ConnectionProfile) (*sql.DB, error)
```

### BuildConnectionString

```go
func BuildConnectionString(p *models.ConnectionProfile) string {
    switch p.Driver {
    case "postgres":
        return fmt.Sprintf(
            "postgres://%s:%s@%s:%d/%s?sslmode=%s&connect_timeout=%d",
            p.Username, p.Password, p.Host, p.Port, p.DBName, p.SSLMode, p.ConnectTimeout,
        )
    case "sqlserver":
        return fmt.Sprintf(
            "sqlserver://%s:%s@%s:%d?database=%s",
            p.Username, p.Password, p.Host, p.Port, p.DBName,
        )
    }
    return ""
}
```

### TestConnection

```go
func TestConnection(p *models.ConnectionProfile) error {
    db, err := OpenConnection(p)
    if err != nil {
        return err
    }
    defer db.Close()
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()
    return db.PingContext(ctx)
}
```

### OpenConnection

```go
func OpenConnection(p *models.ConnectionProfile) (*sql.DB, error) {
    driverName := p.Driver
    if p.Driver == "postgres" {
        driverName = "pgx" // pgx/v5/stdlib registers as "pgx"
    }
    db, err := sql.Open(driverName, BuildConnectionString(p))
    if err != nil {
        return nil, fmt.Errorf("connector: open failed: %w", err)
    }
    db.SetMaxOpenConns(10)
    db.SetMaxIdleConns(5)
    db.SetConnMaxLifetime(5 * time.Minute)
    return db, nil
}
```

## Persistence (internal/utils/prefs.go)

```go
const PrefConnections = "zentro.connections"

func SaveConnections(app fyne.App, profiles []*models.ConnectionProfile) error {
    // base64 encode passwords trước khi marshal
    for _, p := range profiles {
        if p.SavePassword {
            p.Password = base64.StdEncoding.EncodeToString([]byte(p.Password))
        } else {
            p.Password = ""
        }
    }
    data, err := json.Marshal(profiles)
    if err != nil {
        return fmt.Errorf("prefs: marshal connections: %w", err)
    }
    app.Preferences().SetString(PrefConnections, string(data))
    return nil
}

func LoadConnections(app fyne.App) ([]*models.ConnectionProfile, error) {
    raw := app.Preferences().StringWithFallback(PrefConnections, "[]")
    var profiles []*models.ConnectionProfile
    if err := json.Unmarshal([]byte(raw), &profiles); err != nil {
        return nil, fmt.Errorf("prefs: unmarshal connections: %w", err)
    }
    // decode passwords
    for _, p := range profiles {
        if p.Password != "" {
            b, _ := base64.StdEncoding.DecodeString(p.Password)
            p.Password = string(b)
        }
    }
    return profiles, nil
}
```

## Validation Rules

- `Name`: không rỗng, max 50 chars, unique trong slice hiện tại
- `Port`: integer 1–65535
- `Host`, `DBName`, `Username`: không rỗng
- `Driver`: chỉ chấp nhận `"postgres"` hoặc `"sqlserver"`

## UI (internal/ui/connection/)

### ShowConnectionDialog

```go
func ShowConnectionDialog(
    parent fyne.Window,
    existing *models.ConnectionProfile, // nil = tạo mới
    onSave func(*models.ConnectionProfile),
)
```

- Dùng `dialog.NewCustom` — **không** tạo `fyne.Window` mới
- Driver `widget.Select` tự động:
  - Đổi Port default (5432 → 1433 và ngược lại)
  - Ẩn/hiện SSLMode field (chỉ hiện khi Driver = "postgres")
- "Test Connection" → chạy `db.TestConnection(profile)` trong goroutine → hiển thị `dialog.NewInformation` khi xong
- "Save" → validate → gọi `onSave(profile)`
- "Cancel" → `dialog.Hide()`

### NewConnectionListWidget

```go
func NewConnectionListWidget(
    profiles []*models.ConnectionProfile,
    onConnect func(*models.ConnectionProfile),
    onEdit func(*models.ConnectionProfile),
    onDelete func(*models.ConnectionProfile),
) fyne.CanvasObject
```

- Dùng `widget.List` hiển thị: `"[driver] name — host:port"`
- Click → select; Double-click → `onConnect`
- Right-click context menu hoặc row buttons: Edit, Delete
- Confirm dialog (`dialog.NewConfirm`) trước khi xóa
- Hỗ trợ scroll tối thiểu 50 profiles

## Edge Cases

| Tình huống | Xử lý |
|---|---|
| Duplicate name khi save | Báo lỗi validation trước khi gọi `onSave` |
| Connection timeout | Hiển thị message thân thiện, không panic |
| `SavePassword = false` | Không lưu password, prompt mỗi lần connect |
| Port không phải số | Validate entry với `strconv.Atoi` |
