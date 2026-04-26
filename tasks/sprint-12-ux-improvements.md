---
sprint: S12
title: UX Improvements
weeks: 10-11
status: Todo
depends_on: S11
---

# Sprint 12 — UX Improvements

> Mục tiêu: Nâng cao trải nghiệm người dùng với formatting, snippets, bookmarks.

---

## Task 12.1 — Query Formatting Backend

**File**: `internal/app/query_formatter.go` (new)

- [ ] Add `FormatSQL(query string, dialect string) (string, error)`
- [ ] Use sqlformat library or similar for formatting
- [ ] Support: PostgreSQL, MSSQL, MySQL, SQLite dialects
- [ ] Handle common formatting options: indent, uppercase keywords

**Done when**: Backend can format SQL string.

---

## Task 12.2 — Query Formatting UI

**File**: `frontend/src/components/editor/MonacoEditorWrapper.tsx`

- [ ] Add Format button in editor toolbar
- [ ] Keyboard shortcut: Ctrl+Shift+F (or Cmd+Shift+F on Mac)
- [ ] Call backend to format SQL
- [ ] Replace editor content with formatted version

**Done when**: Ctrl+Shift+F formats current query.

---

## Task 12.3 — Snippets Backend

**File**: `internal/app/template_service.go`  
**File**: `internal/models/template.go`

- [x] Template model exists (`models.Template`)
- [x] `LoadTemplates()`, `SaveTemplate()`, `DeleteTemplate()` implemented
- [x] Templates stored in `~/.config/zentro/templates.json`

**Status**: ✅ DONE - Already implemented as TemplateService

**Done when**: Backend manages snippets.

---

## Task 12.4 — Snippets UI

**File**: `frontend/src/components/editor/TemplatePopover.tsx`  
**File**: `frontend/src/components/editor/TemplateDialog.tsx`  
**File**: `frontend/src/stores/templateStore.ts`

- [x] TemplatePopover with list of templates
- [x] TemplateDialog for add/edit/delete
- [x] templateStore for state management
- [x] Trigger autocomplete with snippet prefix

**Status**: ✅ DONE - Already implemented

**Done when**: User can manage and insert snippets.

---

## Task 12.5 — Bookmarks Backend

**File**: `internal/app/bookmark_service.go` (new)

- [ ] Add `GetBookmarks(connectionID string) ([]Bookmark, error)`
- [ ] Add `SaveBookmark(connectionID, tabID string, bookmark Bookmark) error`
- [ ] Store bookmarked lines per query/file

**Done when**: Backend stores editor bookmarks.

---

## Task 12.6 — Bookmarks UI

**File**: `frontend/src/components/editor/MonacoEditorWrapper.tsx`

- [ ] Add gutter for bookmark icons
- [ ] Ctrl+F2 to toggle bookmark on current line
- [ ] F2 to jump to next bookmark
- [ ] Show bookmark list in sidebar

**Done when**: User can bookmark and navigate to lines.

---

## Task 12.7 — Query Compare Backend

**File**: `internal/app/query_compare.go` (new)

- [ ] Add `CompareQueries(query1, query2 string) (diff string, err error)`
- [ ] Use diff library to compute line-by-line differences

**Done when**: Backend returns diff output.

---

## Task 12.8 — Query Compare UI

**File**: `frontend/src/components/editor/QueryCompareModal.tsx`

- [ ] Add "Compare Queries" in file menu
- [ ] Two Monaco editors side by side
- [ ] Highlight differences
- [ ] Option to sync scroll

**Done when**: Can compare two queries visually.

---

## Task 12.9 — Keyboard Shortcuts Editor

**File**: `frontend/src/components/settings/ShortcutsSettings.tsx`

- [ ] List all available commands
- [ ] Show current shortcut for each
- [ ] Allow rebinding shortcuts
- [ ] Save to preferences
- [ ] Reset to defaults option

**Done when**: User can customize keyboard shortcuts.

---

## Task 12.10 — Command Palette Enhancement

**File**: `frontend/src/components/CommandPalette.tsx`

- [ ] Add more commands to palette
- [ ] Add fuzzy search
- [ ] Show keyboard shortcut hints
- [ ] Categorize commands

**Done when**: Command palette is more powerful.

---

## Smoke Test Sprint 12

```bash
go build ./...
cd frontend && npm run build
```

- [ ] Ctrl+Shift+F formats SQL query
- [ ] Snippets panel shows, can insert snippet
- [ ] Can bookmark lines, F2 navigates
- [ ] Compare queries shows diff view
- [ ] Shortcuts settings allows customization
