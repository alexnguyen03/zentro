### Specification 8: Logging & Debugging

**Mô tả**: Logging backend sử dụng `slog`. Giữ nguyên hoàn toàn — không phụ thuộc Fyne.

**Logic** (`internal/utils/logger.go` — giữ nguyên):
```go
func NewLogger(verbose bool) *slog.Logger
// MultiHandler: ghi đồng thời ra file + stderr
// File: os.UserCacheDir()/zentro/zentro.log
```

**Wails integration**: Trong `app.go`, thêm log tại các method:
```go
func (a *App) Connect(name string) error {
    a.logger.Info("connecting", "profile", name)
    ...
}
```

**Frontend logging**: Dùng `console.log`/`console.error` standard — Wails dev mode forward ra console của `wails dev`.

**Sprint Planning**: **Phase 1** (setup sớm, inject vào `App` struct).
