### Specification 5: UI Layout & Navigation

**Mô tả tổng quan**: Cấu trúc giao diện tổng thể của Zentro. Sidebar + main area. Tương đương với `AppState` singleton và layout wiring trong Fyne, nhưng nay được implement bằng React component tree và Zustand stores.

**Layout Structure**:
```
┌─────────────────────────────────────────────────────┐
│  Toolbar (New Connection | New Query | Run | Cancel | Export CSV)  │
├──────────────┬──────────────────────────────────────┤
│              │  [Tab 1] [Tab 2] [+]                 │
│   Sidebar    │  ┌──────────────────────────────────┐│
│  (Connection │  │  Monaco Editor                   ││
│    Tree +    │  │                                  ││
│    Schema)   │  ├──────────────────────────────────┤│
│              │  │  Result Grid / Error / Placeholder││
│              │  └──────────────────────────────────┘│
├──────────────┴──────────────────────────────────────┤
│  StatusBar: ⬤ conn_name (postgres) │ Done │ 1000 rows │ 42ms │
└─────────────────────────────────────────────────────┘
```

**React Component Tree** (`App.tsx`):
```tsx
<App>
  <Toolbar />                          // top, fixed height
  <main className="main-layout">
    <Sidebar>                          // left panel, resizable
      <ConnectionTree />
    </Sidebar>
    <div className="editor-area">
      <QueryTabs />                    // tabs + Monaco + ResultPanel
    </div>
  </main>
  <StatusBar />                        // bottom, fixed height
</App>
```

**Resizable Split**: Sidebar / editor area dùng CSS `resize` hoặc thư viện nhẹ như `react-resizable-panels`. Default sidebar width: 22% (tương đương `split.Offset = 0.22` trong Fyne).

**Global App State** (ánh xạ từ `AppState` Go struct sang Zustand stores):
| Fyne `AppState` field | Zustand store | Notes |
|---|---|---|
| `CurrentDB *sql.DB` | `connectionStore.isConnected` | DB handle nằm ở Go side |
| `ActiveProfile` | `connectionStore.activeProfile` | Serialized sang TS |
| `Connections []` | `connectionStore.connections` | Load từ backend |
| `QueryEditor.tabs` | `editorStore.tabs` | Pure frontend state |
| `toolbar.*Btn.Disable()` | `toolbarStore.canRun` etc. | Derived from stores |
| `statusBar.*Label` | `statusStore.*` | Driven by events |

**Toolbar State Logic** (ánh xạ từ Skill 06):
| Button | Enabled khi | Disabled khi |
|---|---|---|
| New Connection | luôn luôn | — |
| New Query | `isConnected` | startup, no connection |
| Run | tab active có text + `!isRunning` | running hoặc no text |
| Cancel | `isRunning` | otherwise |
| Export CSV | `hasResult` | otherwise |

**`Toolbar.tsx`**:
```tsx
const Toolbar = () => {
  const { isConnected } = connectionStore()
  const { canRun, isRunning, hasResult } = toolbarStore()
  return (
    <div className="toolbar">
      <Button onClick={openNewConnectionDialog}>New Connection</Button>
      <Divider />
      <Button disabled={!isConnected} onClick={addTab}>New Query</Button>
      <Button disabled={!canRun} onClick={runCurrentTab}>Run ▶</Button>
      <Button disabled={!isRunning} onClick={cancelQuery}>Cancel ■</Button>
      <Divider />
      <Button disabled={!hasResult} onClick={exportCSV}>Export CSV</Button>
      <Spacer />
      <Button onClick={openSettings}>⚙</Button>
    </div>
  )
}
```

**`StatusBar.tsx`**:
```tsx
// Listen Wails events để update live:
Events.On("connection:changed", ({ profile, status }) =>
  statusStore.setConnection(profile, status))
Events.On("query:started", () => statusStore.setStatus("Running…"))
Events.On("query:result", ({ duration, rows, error }) =>
  statusStore.setQueryInfo(duration, rows?.length ?? 0, error))
```

**Wails Startup Wiring** (`main.go`):
```go
func main() {
    core.Register(pgdriver.New())
    core.Register(msdriver.New())
    app := apppkg.NewApp()
    wails.Run(&options.App{
        Title:     "Zentro",
        Width:     1280,
        Height:    800,
        OnStartup: app.Startup,    // load connections, init state
        Bind:      []interface{}{app},
        AssetServer: &assetserver.Options{Assets: assets},
    })
}
```

**Pattern Usage** (từ Skill 12):
- **Singleton**: `App` struct — một instance toàn app.
- **Observer**: Wails Events → Zustand stores cập nhật → React re-render.
- **DI**: `App` nhận `logger`, drivers inject từ `main.go`.

**Sprint Planning**:
- **Phase 1**: `main.go` wiring, `App.Startup`.
- **Phase 2**: Layout CSS, `Toolbar`, `StatusBar`, `Sidebar` shell.
- **Phase 3–4**: Hoàn thiện interactions.