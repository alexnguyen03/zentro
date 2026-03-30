package app

import (
	"testing"

	"zentro/internal/models"
)

func TestBookmarkServiceCRUD(t *testing.T) {
	tmp := t.TempDir()
	t.Setenv("APPDATA", tmp)
	t.Setenv("XDG_CONFIG_HOME", tmp)
	t.Setenv("HOME", tmp)

	svc := NewBookmarkService()
	connID := "conn-1"
	tabID := "tab-1"

	if err := svc.SaveBookmark(connID, tabID, models.Bookmark{Line: 10, Label: "A"}); err != nil {
		t.Fatalf("save 10: %v", err)
	}
	if err := svc.SaveBookmark(connID, tabID, models.Bookmark{Line: 20, Label: "B"}); err != nil {
		t.Fatalf("save 20: %v", err)
	}

	items, err := svc.GetBookmarks(connID, tabID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("expected 2 bookmarks, got %d", len(items))
	}

	if err := svc.DeleteBookmark(connID, tabID, 10); err != nil {
		t.Fatalf("delete: %v", err)
	}
	items, err = svc.GetBookmarks(connID, tabID)
	if err != nil {
		t.Fatalf("get after delete: %v", err)
	}
	if len(items) != 1 || items[0].Line != 20 {
		t.Fatalf("unexpected bookmarks after delete: %+v", items)
	}

	reloaded := NewBookmarkService()
	items, err = reloaded.GetBookmarks(connID, tabID)
	if err != nil {
		t.Fatalf("reload get: %v", err)
	}
	if len(items) != 1 || items[0].Line != 20 {
		t.Fatalf("unexpected bookmarks after reload: %+v", items)
	}
}
