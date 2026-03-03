### Specification 7: Preferences & Settings

**Mô tả**: Lưu và apply settings người dùng. Thay thế `fyne.App.Preferences()` bằng JSON file trên disk. Không còn phụ thuộc Fyne.

**Storage** (`internal/utils/prefs.go` — rewritten):
```go
// Config file: os.UserConfigDir()/zentro/config.json
type Preferences struct {
    Theme        string `json:"theme"`          // "light" | "dark" | "system"
    FontSize     int    `json:"font_size"`       // default 14
    DefaultLimit int    `json:"default_limit"`   // default 1000
    Connections  []*models.ConnectionProfile `json:"connections"`
}

func LoadPreferences() (*Preferences, error)
func SavePreferences(p *Preferences) error
```

**Backend API** (`internal/app/app.go`):
```go
func (a *App) GetPreferences() Preferences
func (a *App) SetPreferences(p Preferences) error
```

**Frontend** — Settings Panel (modal hoặc sidebar section):
```typescript
interface Preferences {
  theme: "light" | "dark" | "system"
  fontSize: number
  defaultLimit: number
}

// Apply theme via CSS variable hoặc class trên <html>:
document.documentElement.setAttribute("data-theme", prefs.theme)
// Apply font size:
document.documentElement.style.setProperty("--editor-font-size", `${prefs.fontSize}px`)
```

**Theme Strategy**: CSS custom properties (`--bg-primary`, `--text-primary`, v.v.) với `data-theme="dark"|"light"`. Monaco Editor: `monaco.editor.setTheme("vs-dark" | "vs")`.

**Preference Keys** (giữ ý nghĩa từ Fyne, đổi storage):
| Key | Type | Default |
|---|---|---|
| `theme` | string | "system" |
| `font_size` | int | 14 |
| `default_limit` | int | 1000 |

**Sprint Planning**: **Phase 5**.
