---
name: zentro-ui-layout-app-state
description: >
  Định nghĩa AppState singleton, main window layout bằng container.NewBorder,
  toolbar buttons và trạng thái enable/disable, status bar, và cách wire tất cả
  components lại trong main.go cho ứng dụng Zentro.
---

# Skill 06: UI Layout & Global Application State

## AppState (internal/ui/mainwindow.go)

```go
// AppState là singleton — khởi tạo trong main.go, pass bằng pointer
type AppState struct {
    App            fyne.App
    MainWindow     fyne.Window
    CurrentDB      *sql.DB
    ActiveProfile  *models.ConnectionProfile
    Connections    []*models.ConnectionProfile
    Logger         *slog.Logger
    QueryEditor    *editor.QueryEditorWidget
    ResultTable    *result.ResultTableWidget
    StatusBar      *StatusBar
    Toolbar        *Toolbar
}
```

**Không dùng global variable.** `AppState` được tạo trong `main.go` và inject thủ công xuống từng component.

## Main Window Layout

```go
// internal/ui/mainwindow.go
func BuildMainWindow(state *AppState) fyne.Window {
    w := state.App.NewWindow("Zentro")
    w.Resize(fyne.NewSize(1280, 800))
    w.SetMaster() // đóng window này = thoát app

    toolbar    := buildToolbar(state)
    statusBar  := buildStatusBar(state)
    editorArea := state.QueryEditor.Widget()

    // Border layout: top=toolbar, bottom=statusBar, center=editorArea
    content := container.NewBorder(
        toolbar,
        statusBar,
        nil, nil,
        editorArea,
    )
    w.SetContent(content)
    return w
}
```

> Sidebar (connection list) sẽ mount vào `left` parameter của `NewBorder` trong phiên bản sau MVP.

## Toolbar

```go
type Toolbar struct {
    newConnBtn  *widget.Button
    newQueryBtn *widget.Button
    runBtn      *widget.Button
    cancelBtn   *widget.Button
    exportBtn   *widget.Button
}

func buildToolbar(state *AppState) fyne.CanvasObject {
    tb := &Toolbar{}
    state.Toolbar = tb

    tb.newConnBtn = widget.NewButtonWithIcon("New Connection",
        theme.ComputerIcon(), func() {
            connection.ShowConnectionDialog(state.MainWindow, nil, func(p *models.ConnectionProfile) {
                state.Connections = append(state.Connections, p)
                utils.SaveConnections(state.App, state.Connections)
            })
        })

    tb.newQueryBtn = widget.NewButtonWithIcon("New Query",
        theme.DocumentCreateIcon(), func() {
            state.QueryEditor.AddTab(state.ActiveProfile, state.CurrentDB)
        })

    tb.runBtn = widget.NewButtonWithIcon("Run",
        theme.MediaPlayIcon(), func() {
            runCurrentQuery(state)
        })

    tb.cancelBtn = widget.NewButtonWithIcon("Cancel",
        theme.MediaStopIcon(), func() {
            if s := state.QueryEditor.GetCurrentState(); s != nil && s.CancelFunc != nil {
                s.CancelFunc()
            }
        })

    tb.exportBtn = widget.NewButtonWithIcon("Export CSV",
        theme.DocumentSaveIcon(), func() {
            exportCurrentResult(state)
        })

    // Initial state
    tb.newQueryBtn.Disable()
    tb.runBtn.Disable()
    tb.cancelBtn.Disable()
    tb.exportBtn.Disable()

    return container.NewHBox(
        tb.newConnBtn,
        widget.NewSeparator(),
        tb.newQueryBtn,
        tb.runBtn,
        tb.cancelBtn,
        widget.NewSeparator(),
        tb.exportBtn,
    )
}
```

## Toolbar State Management

```go
// Gọi sau khi connection thay đổi
func (state *AppState) OnConnectionChanged(profile *models.ConnectionProfile, db *sql.DB) {
    state.CurrentDB = db
    state.ActiveProfile = profile
    state.Toolbar.newQueryBtn.Enable()
    state.StatusBar.SetConnection(profile)
}

// Gọi khi query bắt đầu chạy
func (state *AppState) OnQueryStarted() {
    state.Toolbar.runBtn.Disable()
    state.Toolbar.cancelBtn.Enable()
    state.StatusBar.SetStatus("Running...")
}

// Gọi khi query kết thúc (success hoặc error)
func (state *AppState) OnQueryFinished(result *models.QueryResult) {
    state.Toolbar.runBtn.Enable()
    state.Toolbar.cancelBtn.Disable()
    state.Toolbar.exportBtn.Enable()
    if result.Err != nil {
        state.StatusBar.SetError(result.Err)
    } else {
        state.StatusBar.SetQueryInfo(result.Duration, len(result.Rows))
    }
}
```

| Button | Enabled khi | Disabled khi |
|---|---|---|
| New Connection | luôn luôn | — |
| New Query | `CurrentDB != nil` | startup, no connection |
| Run | tab active có text + no query running | query running, no text |
| Cancel | query đang chạy | otherwise |
| Export CSV | `LastResult != nil` | otherwise |

## Status Bar

```go
type StatusBar struct {
    connectionLabel *widget.Label // "⬤ profile_name (postgres @ host:port)"
    statusLabel     *widget.Label // "Ready" | "Running..." | "Error: ..."
    rowCountLabel   *widget.Label // "1,000 rows"
    durationLabel   *widget.Label // "123ms"
}

func buildStatusBar(state *AppState) fyne.CanvasObject {
    sb := &StatusBar{
        connectionLabel: widget.NewLabel("Not connected"),
        statusLabel:     widget.NewLabel("Ready"),
        rowCountLabel:   widget.NewLabel(""),
        durationLabel:   widget.NewLabel(""),
    }
    state.StatusBar = sb

    return container.NewHBox(
        sb.connectionLabel,
        widget.NewSeparator(),
        sb.statusLabel,
        layout.NewSpacer(),
        sb.rowCountLabel,
        sb.durationLabel,
    )
}

func (sb *StatusBar) SetConnection(p *models.ConnectionProfile) {
    sb.connectionLabel.SetText(fmt.Sprintf("⬤ %s (%s @ %s:%d)", p.Name, p.Driver, p.Host, p.Port))
}

func (sb *StatusBar) SetQueryInfo(d time.Duration, rows int) {
    sb.statusLabel.SetText("Done")
    sb.rowCountLabel.SetText(fmt.Sprintf("%s rows", formatInt(rows)))
    sb.durationLabel.SetText(fmt.Sprintf("%dms", d.Milliseconds()))
}

func (sb *StatusBar) SetError(err error) {
    sb.statusLabel.SetText(fmt.Sprintf("Error: %s", err.Error()))
    sb.rowCountLabel.SetText("")
    sb.durationLabel.SetText("")
}

func (sb *StatusBar) SetStatus(msg string) {
    sb.statusLabel.SetText(msg)
}
```

## main.go Wiring (cmd/zentro/main.go)

```go
func main() {
    logger := utils.NewLogger(false)

    app := app.New()
    app.SetIcon(resourceIconPng)

    state := &AppState{
        App:    app,
        Logger: logger,
    }

    // Load saved connections
    conns, err := utils.LoadConnections(app)
    if err != nil {
        logger.Warn("failed to load connections", "err", err)
    }
    state.Connections = conns

    // Init UI components
    state.ResultTable = result.NewResultTableWidget(nil) // window set later
    state.QueryEditor = editor.NewQueryEditorWidget(func(tabState *editor.TabState) {
        runQuery(state, tabState)
    })

    // Build window
    w := BuildMainWindow(state)
    state.MainWindow = w
    state.ResultTable.SetParentWindow(w) // inject window setelah dibuat

    // Apply preferences
    utils.ApplyPreferences(app, state)

    w.ShowAndRun()
}
```
