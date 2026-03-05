---
name: zentro-preferences-settings
description: >
  Định nghĩa tất cả Preferences keys chuẩn hóa, cách đọc/ghi settings (theme,
  font size, default row limit), UI settings dialog, và ApplyPreferences function
  được gọi khi startup cho Zentro.
---

# Skill 08: Preferences & Settings

## Keys Chuẩn Hóa (internal/utils/prefs.go)

```go
const (
    PrefTheme        = "zentro.theme"          // "light" | "dark" | "system"
    PrefFontSize     = "zentro.font_size"      // int, default 13
    PrefDefaultLimit = "zentro.default_limit"  // int, default 1000
    PrefConnections  = "zentro.connections"    // JSON string
    PrefHistory      = "zentro.query_history"  // JSON string
)
```

**Tất cả code** phải dùng các constant này — không hardcode string key trực tiếp.

## Read/Write Helpers

```go
func GetTheme(app fyne.App) string {
    return app.Preferences().StringWithFallback(PrefTheme, "system")
}

func SetTheme(app fyne.App, theme string) {
    app.Preferences().SetString(PrefTheme, theme)
}

func GetDefaultLimit(app fyne.App) int {
    return app.Preferences().IntWithFallback(PrefDefaultLimit, 1000)
}

func SetDefaultLimit(app fyne.App, limit int) {
    app.Preferences().SetInt(PrefDefaultLimit, limit)
}

func GetFontSize(app fyne.App) int {
    return app.Preferences().IntWithFallback(PrefFontSize, 13)
}

func SetFontSize(app fyne.App, size int) {
    app.Preferences().SetInt(PrefFontSize, size)
}
```

## ApplyPreferences (gọi khi startup)

```go
// internal/utils/prefs.go
func ApplyPreferences(fyneApp fyne.App, state *AppState) {
    applyTheme(fyneApp)
    // Font size: Fyne v2 không support per-app font size override trực tiếp
    // → lưu vào state, dùng khi tạo custom text widgets nếu cần
}

func applyTheme(fyneApp fyne.App) {
    switch GetTheme(fyneApp) {
    case "dark":
        fyneApp.Settings().SetTheme(theme.DarkTheme())
    case "light":
        fyneApp.Settings().SetTheme(theme.LightTheme())
    default: // "system"
        // Fyne tự detect OS theme — không cần set
    }
}
```

## Settings Dialog UI

```go
// internal/ui/settings/
func ShowSettingsDialog(fyneApp fyne.App, parent fyne.Window, onApply func())
```

```go
func ShowSettingsDialog(fyneApp fyne.App, parent fyne.Window, onApply func()) {
    themeSelect := widget.NewSelect(
        []string{"system", "light", "dark"},
        func(val string) { utils.SetTheme(fyneApp, val) },
    )
    themeSelect.SetSelected(utils.GetTheme(fyneApp))

    limitEntry := widget.NewEntry()
    limitEntry.SetText(fmt.Sprintf("%d", utils.GetDefaultLimit(fyneApp)))

    form := widget.NewForm(
        widget.NewFormItem("Theme", themeSelect),
        widget.NewFormItem("Default Row Limit", limitEntry),
    )

    dialog.ShowCustomConfirm(
        "Settings",
        "Apply", "Cancel",
        form,
        func(confirmed bool) {
            if !confirmed { return }

            // Apply theme ngay lập tức
            applyTheme(fyneApp)

            // Save limit
            if limit, err := strconv.Atoi(limitEntry.Text); err == nil && limit > 0 {
                utils.SetDefaultLimit(fyneApp, limit)
            }

            if onApply != nil { onApply() }
        },
        parent,
    )
}
```

## Settings Button trong Toolbar

```go
settingsBtn := widget.NewButtonWithIcon("", theme.SettingsIcon(), func() {
    settings.ShowSettingsDialog(state.App, state.MainWindow, func() {
        // Reload preferences sau khi apply
        utils.ApplyPreferences(state.App, state)
    })
})
```

## Fyne Preferences Storage

- Fyne lưu preferences trong OS-specific location:
  - Windows: `%APPDATA%\fyne\<app-id>\`
  - macOS: `~/Library/Preferences/<app-id>.plist`
- App ID phải được set: `app.NewWithID("io.zentro.app")` trong `main.go`
- **Không** dùng `app.New()` — sẽ dùng random ID mỗi lần build → mất preferences
