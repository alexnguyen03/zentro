---
name: zentro-multi-tab-editor
description: >
  Định nghĩa TabState, QueryEditorWidget, layout một tab (editor + result split),
  DocTabs management, keyboard shortcuts (Ctrl+Enter), và unsaved changes prompt
  cho multi-tab query editor của Zentro.
---

# Skill 04: Multi-Tab Query Editor

## Structs (internal/ui/editor/)

```go
// TabState lưu toàn bộ state của một query tab
type TabState struct {
    ID         string                  // UUID hoặc sequential "tab-1", "tab-2"
    Title      string                  // hiển thị trên tab header
    QueryText  string                  // nội dung editor hiện tại
    LastResult *models.QueryResult     // kết quả lần run gần nhất
    DB         *sql.DB                 // *sql.DB đang được dùng cho tab này
    ProfileName string                 // tên ConnectionProfile đang dùng
    CancelFunc context.CancelFunc      // để Cancel button gọi abort query
    Modified   bool                    // true nếu có text chưa run
}

// QueryEditorWidget quản lý toàn bộ tab system
type QueryEditorWidget struct {
    tabs      *container.DocTabs
    tabStates map[*container.TabItem]*TabState
    onRun     func(state *TabState)   // callback khi user trigger run
}
```

## Constructor & API

```go
func NewQueryEditorWidget(onRun func(state *TabState)) *QueryEditorWidget
func (q *QueryEditorWidget) AddTab(profile *models.ConnectionProfile, db *sql.DB) *container.TabItem
func (q *QueryEditorWidget) CloseTab(tab *container.TabItem)
func (q *QueryEditorWidget) GetCurrentState() *TabState
func (q *QueryEditorWidget) SetResult(tab *container.TabItem, result *models.QueryResult)
func (q *QueryEditorWidget) Widget() fyne.CanvasObject // trả về container.DocTabs
```

## Layout một Tab

```go
func (q *QueryEditorWidget) buildTabContent(tab *container.TabItem, state *TabState) fyne.CanvasObject {
    // Editor
    editor := widget.NewMultiLineEntry()
    editor.SetPlaceHolder("-- Enter SQL query\n-- Ctrl+Enter to run")
    editor.OnChanged = func(s string) {
        state.QueryText = s
        state.Modified = true
    }

    // Result area — ban đầu là placeholder
    resultArea := container.NewStack(widget.NewLabel("No results yet."))
    state.resultContainer = resultArea // lưu ref để cập nhật sau

    // Split: editor trên 40%, result dưới 60%
    split := container.NewVSplit(editor, resultArea)
    split.Offset = 0.4

    return split
}
```

## AddTab

```go
func (q *QueryEditorWidget) AddTab(profile *models.ConnectionProfile, db *sql.DB) *container.TabItem {
    state := &TabState{
        ID:          generateTabID(),
        Title:       profile.Name,
        DB:          db,
        ProfileName: profile.Name,
    }
    item := container.NewTabItem(state.Title, nil)
    item.Content = q.buildTabContent(item, state)
    q.tabStates[item] = state

    // PHẢI dùng fyne.Do vì có thể gọi từ goroutine
    fyne.Do(func() {
        q.tabs.Append(item)
        q.tabs.Select(item)
    })
    return item
}
```

## CloseTab — Unsaved Changes Prompt

```go
func (q *QueryEditorWidget) CloseTab(tab *container.TabItem) {
    state, ok := q.tabStates[tab]
    if !ok {
        return
    }
    doClose := func() {
        if state.CancelFunc != nil {
            state.CancelFunc() // abort any running query
        }
        delete(q.tabStates, tab)
        fyne.Do(func() { q.tabs.Remove(tab) })
    }

    if state.Modified && state.QueryText != "" {
        dialog.NewConfirm(
            "Close Tab",
            fmt.Sprintf("Tab \"%s\" has unsaved query. Close anyway?", state.Title),
            func(ok bool) {
                if ok { doClose() }
            },
            parentWindow,
        ).Show()
        return
    }
    doClose()
}
```

> `parentWindow` phải được inject saat konstruksi `QueryEditorWidget`.

## Keyboard Shortcut — Ctrl+Enter

Đăng ký tại **window level** (không phải widget level):

```go
// Trong mainwindow.go sau khi tạo window:
mainWindow.Canvas().AddShortcut(
    &desktop.CustomShortcut{
        KeyName:  fyne.KeyReturn,
        Modifier: fyne.KeyModifierControl,
    },
    func(shortcut fyne.Shortcut) {
        state := queryEditor.GetCurrentState()
        if state == nil || state.DB == nil || state.QueryText == "" {
            return
        }
        onRun(state)
    },
)
```

## SetResult — Cập nhật Result Area

```go
func (q *QueryEditorWidget) SetResult(tab *container.TabItem, result *models.QueryResult) {
    state, ok := q.tabStates[tab]
    if !ok {
        return
    }
    state.LastResult = result
    state.Modified = false

    // resultContainer đã tồn tại → chỉ thay content → thread-safe
    // Thay content của Stack bằng widget mới CẦN fyne.Do vì thay đổi structure
    newResultWidget := buildResultWidget(result) // từ Skill 05
    fyne.Do(func() {
        state.resultContainer.Objects = []fyne.CanvasObject{newResultWidget}
        state.resultContainer.Refresh()
    })
}
```

## DocTabs vs AppTabs

- Dùng `container.NewDocTabs` — có built-in close button (×) trên mỗi tab
- KHÔNG dùng `container.NewAppTabs` — không có close button mặc định
- Tab đầu tiên mở ngay khi startup nếu đã có active connection

## Edge Cases

| Tình huống | Xử lý |
|---|---|
| Query > 10,000 chars | Entry handle bình thường, không giới hạn |
| Close tab khi query đang chạy | `state.CancelFunc()` trước khi close |
| Tab không có connection | Hiển thị "No connection" placeholder, disable Run |
| `GetCurrentState()` khi không có tab | Trả về `nil`, caller phải check |
