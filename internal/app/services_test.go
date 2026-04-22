package app

import (
	"context"
	"errors"
	"testing"
	"time"

	"zentro/internal/models"
	"zentro/internal/utils"
)

// ── HistoryService ──────────────────────────────────────────────────────────

func TestHistoryService_AppendAndGet(t *testing.T) {
	svc := NewHistoryService(func() *models.ConnectionProfile { return nil })

	svc.AppendEntry("SELECT 1", 42, 10*time.Millisecond, nil)
	svc.AppendEntry("SELECT 2", 0, 5*time.Millisecond, errors.New("fail"))

	entries := svc.GetHistory()
	if len(entries) != 2 {
		t.Fatalf("expected 2 entries, got %d", len(entries))
	}
	// Newest-first order
	if entries[0].Query != "SELECT 2" {
		t.Errorf("expected newest first, got %q", entries[0].Query)
	}
	if entries[0].Error != "fail" {
		t.Errorf("expected error string 'fail', got %q", entries[0].Error)
	}
}

func TestHistoryService_AppendWithProfile(t *testing.T) {
	p := &models.ConnectionProfile{Name: "prod", DBName: "mydb"}
	svc := NewHistoryService(func() *models.ConnectionProfile { return p })

	svc.AppendEntry("SELECT 1", 1, time.Millisecond, nil)

	entries := svc.GetHistory()
	if len(entries) == 0 {
		t.Fatal("expected at least one entry")
	}
	if entries[0].Profile != "prod" || entries[0].Database != "mydb" {
		t.Errorf("unexpected profile/db: %q/%q", entries[0].Profile, entries[0].Database)
	}
}

func TestHistoryService_ClearHistory(t *testing.T) {
	svc := NewHistoryService(func() *models.ConnectionProfile { return nil })
	svc.AppendEntry("SELECT 1", 0, time.Millisecond, nil)

	// ClearHistory may fail if no file exists yet — that's acceptable.
	_ = svc.ClearHistory()

	entries := svc.GetHistory()
	if len(entries) != 0 {
		t.Errorf("expected empty history after clear, got %d entries", len(entries))
	}
}

// ── TemplateService ─────────────────────────────────────────────────────────

func TestTemplateService_SaveAndLoad(t *testing.T) {
	svc := NewTemplateService()

	tmpl := models.Template{Name: "test template", Content: "SELECT 1"}
	if err := svc.SaveTemplate(tmpl); err != nil {
		t.Fatalf("SaveTemplate: %v", err)
	}

	loaded, err := svc.LoadTemplates()
	if err != nil {
		t.Fatalf("LoadTemplates: %v", err)
	}

	found := false
	for _, lt := range loaded {
		if lt.Name == "test template" {
			found = true
		}
	}
	if !found {
		t.Error("saved template not found after load")
	}
}

func TestTemplateService_DeleteTemplate(t *testing.T) {
	svc := NewTemplateService()

	tmpl := models.Template{Name: "to delete", Content: "SELECT 2"}
	if err := svc.SaveTemplate(tmpl); err != nil {
		t.Fatalf("SaveTemplate: %v", err)
	}

	loaded, _ := svc.LoadTemplates()
	var savedID string
	for _, lt := range loaded {
		if lt.Name == "to delete" {
			savedID = lt.ID
		}
	}
	if savedID == "" {
		t.Fatal("template was not saved with an ID")
	}

	if err := svc.DeleteTemplate(savedID); err != nil {
		t.Fatalf("DeleteTemplate: %v", err)
	}

	remaining, _ := svc.LoadTemplates()
	for _, lt := range remaining {
		if lt.ID == savedID {
			t.Error("template still present after delete")
		}
	}
}

func TestTemplateService_UpdateTemplate(t *testing.T) {
	svc := NewTemplateService()

	tmpl := models.Template{Name: "original", Content: "SELECT 1"}
	_ = svc.SaveTemplate(tmpl)

	loaded, _ := svc.LoadTemplates()
	var savedID string
	for _, lt := range loaded {
		if lt.Name == "original" {
			savedID = lt.ID
		}
	}

	updated := models.Template{ID: savedID, Name: "updated", Content: "SELECT 2"}
	if err := svc.SaveTemplate(updated); err != nil {
		t.Fatalf("SaveTemplate update: %v", err)
	}

	reloaded, _ := svc.LoadTemplates()
	for _, lt := range reloaded {
		if lt.ID == savedID && lt.Name != "updated" {
			t.Errorf("template was not updated, got name %q", lt.Name)
		}
	}
}

// ── App lifecycle ───────────────────────────────────────────────────────────

func TestApp_GetSetPreferences(t *testing.T) {
	a := setupApp(t)
	a.prefs = utils.Preferences{DefaultLimit: 100}

	p := a.GetPreferences()
	if p.DefaultLimit != 100 {
		t.Errorf("GetPreferences: expected DefaultLimit=100, got %d", p.DefaultLimit)
	}

	newPrefs := utils.Preferences{DefaultLimit: 500, QueryTimeout: 60}
	// SetPreferences writes to disk — ignore file errors in test env.
	_ = a.SetPreferences(newPrefs)

	if a.prefs.DefaultLimit != 500 {
		t.Errorf("SetPreferences: expected DefaultLimit=500, got %d", a.prefs.DefaultLimit)
	}
}

func TestApp_Shutdown_NilDB(t *testing.T) {
	a := NewApp()
	a.ctx = context.Background()
	a.logger = utils.NewLogger(false)
	a.conn.logger = a.logger
	a.query.logger = a.logger
	a.scripts.logger = a.logger
	// db is nil — Shutdown should not panic
	a.Shutdown()
	if a.db != nil {
		t.Error("expected db to be nil after Shutdown")
	}
	if a.profile != nil {
		t.Error("expected profile to be nil after Shutdown")
	}
}

func TestApp_Shutdown_WithDB(t *testing.T) {
	a := setupApp(t) // sets up an in-memory SQLite db
	a.Shutdown()
	if a.db != nil {
		t.Error("expected db to be nil after Shutdown")
	}
}

// ── QueryService edge cases ─────────────────────────────────────────────────

func TestQueryService_FetchMoreRows_NoActiveQuery(t *testing.T) {
	a := setupApp(t)
	defer a.db.Close()

	doneChan := make(chan map[string]any, 1)
	emitEvent = func(ctx context.Context, eventName string, optionalData ...interface{}) {
		if eventName == "query:done" {
			if len(optionalData) > 0 {
				if data, ok := optionalData[0].(map[string]any); ok {
					doneChan <- data
				}
			}
		}
	}

	a.FetchMoreRows("non-existent-tab", 0)

	select {
	case done := <-doneChan:
		if _, hasErr := done["error"]; !hasErr {
			t.Error("expected error in done event for no active query")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timeout waiting for FetchMoreRows error response")
	}
}

func TestQueryService_FetchTotalRowCount_NoActiveQuery(t *testing.T) {
	a := setupApp(t)
	defer a.db.Close()

	_, err := a.FetchTotalRowCount("no-such-tab")
	if err == nil {
		t.Error("expected error when no active query")
	}
}

func TestQueryService_ExecuteUpdateSync(t *testing.T) {
	a := setupApp(t)
	defer a.db.Close()

	a.db.Exec("CREATE TABLE sync_test (id INTEGER);")

	affected, err := a.ExecuteUpdateSync("INSERT INTO sync_test VALUES (1), (2), (3);")
	if err != nil {
		t.Fatalf("ExecuteUpdateSync: %v", err)
	}
	if affected != 3 {
		t.Errorf("expected 3 affected rows, got %d", affected)
	}
}

func TestQueryService_Shutdown(t *testing.T) {
	a := setupApp(t)
	defer a.db.Close()

	// Start a long-running query then shutdown
	emitEvent = func(ctx context.Context, eventName string, optionalData ...interface{}) {}

	query := `WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt LIMIT 100000) SELECT x FROM cnt;`
	a.ExecuteQuery("shutdown-tab", query)
	time.Sleep(10 * time.Millisecond)
	a.query.Shutdown() // should cancel all sessions without panic
}

func TestQueryService_FetchMoreRows_WithActiveQuery(t *testing.T) {
	a := setupApp(t)
	defer a.db.Close()

	doneChan := make(chan bool, 4)
	emitEvent = func(ctx context.Context, eventName string, optionalData ...interface{}) {
		if eventName == "query:done" {
			doneChan <- true
		}
	}

	// Execute a simple SELECT to register it in activeQueries.
	a.ExecuteQuery("tab-fm", "SELECT 1 AS x")
	select {
	case <-doneChan:
	case <-time.After(2 * time.Second):
		t.Fatal("timeout on initial query")
	}

	// FetchMoreRows on the same tab — exercises the active-query path.
	a.FetchMoreRows("tab-fm", 1)
	select {
	case <-doneChan:
	case <-time.After(2 * time.Second):
		t.Fatal("timeout on FetchMoreRows")
	}
}

func TestQueryService_FetchTotalRowCount_WithActiveQuery(t *testing.T) {
	a := setupApp(t)
	defer a.db.Close()

	doneChan := make(chan bool, 2)
	emitEvent = func(ctx context.Context, eventName string, optionalData ...interface{}) {
		if eventName == "query:done" {
			doneChan <- true
		}
	}

	// Register an active SELECT query.
	a.ExecuteQuery("tab-cnt", "SELECT 1 AS x")
	select {
	case <-doneChan:
	case <-time.After(2 * time.Second):
		t.Fatal("timeout on initial query")
	}

	count, err := a.FetchTotalRowCount("tab-cnt")
	if err != nil {
		t.Fatalf("FetchTotalRowCount: %v", err)
	}
	if count != 1 {
		t.Errorf("expected count=1, got %d", count)
	}
}

func TestHistoryService_GetHistory_FromFile(t *testing.T) {
	// Write some entries via one service instance, then read them via a fresh one.
	svc1 := NewHistoryService(func() *models.ConnectionProfile { return nil })
	svc1.AppendEntry("SELECT from_file", 5, time.Millisecond, nil)

	svc2 := NewHistoryService(func() *models.ConnectionProfile { return nil })
	entries := svc2.GetHistory()
	found := false
	for _, e := range entries {
		if e.Query == "SELECT from_file" {
			found = true
		}
	}
	if !found {
		t.Error("expected history loaded from file, but query not found")
	}
}

func TestTemplateService_LoadTemplates_Fresh(t *testing.T) {
	// Fresh service reads from disk (nil templates → triggers loadFromFile).
	svc1 := NewTemplateService()
	_ = svc1.SaveTemplate(models.Template{Name: "disk-load-test", Content: "SELECT 3"})

	svc2 := NewTemplateService() // fresh, s.templates == nil
	loaded, err := svc2.LoadTemplates()
	if err != nil {
		t.Fatalf("LoadTemplates: %v", err)
	}
	found := false
	for _, lt := range loaded {
		if lt.Name == "disk-load-test" {
			found = true
		}
	}
	if !found {
		t.Error("expected template from disk, but not found")
	}
}

// ── App proxy method coverage ───────────────────────────────────────────────

func TestApp_Startup(t *testing.T) {
	a := NewApp()
	a.Startup(context.Background())
	if a.logger == nil {
		t.Error("expected logger to be set after Startup")
	}
}

func TestApp_OnBeforeClose(t *testing.T) {
	a := setupApp(t)
	defer a.db.Close()

	called := false
	emitEvent = func(ctx context.Context, eventName string, optionalData ...interface{}) {
		if eventName == "app:before-close" {
			called = true
		}
	}

	if !a.OnBeforeClose(context.Background()) {
		t.Error("expected OnBeforeClose to return true when forceQuit=false")
	}
	if !called {
		t.Error("expected app:before-close event to be emitted")
	}
}

func TestApp_HistoryProxies(t *testing.T) {
	a := setupApp(t)
	defer a.db.Close()
	emitEvent = func(ctx context.Context, eventName string, optionalData ...interface{}) {}

	// Populate history via a query so GetHistory has something to return.
	doneChan := make(chan bool, 1)
	emitEvent = func(ctx context.Context, eventName string, optionalData ...interface{}) {
		if eventName == "query:done" {
			doneChan <- true
		}
	}
	a.ExecuteQuery("hist-tab", "INSERT OR IGNORE INTO x VALUES (1)")
	select {
	case <-doneChan:
	case <-time.After(2 * time.Second):
	}

	_ = a.GetHistory()
	_ = a.ClearHistory()
}

func TestApp_TemplateProxies(t *testing.T) {
	a := setupApp(t)
	defer a.db.Close()

	templates, err := a.LoadTemplates()
	if err != nil {
		t.Logf("LoadTemplates: %v (acceptable)", err)
	}
	_ = templates

	_ = a.SaveTemplate(models.Template{Name: "app-proxy-test", Content: "SELECT 99"})

	loaded, _ := a.LoadTemplates()
	var id string
	for _, lt := range loaded {
		if lt.Name == "app-proxy-test" {
			id = lt.ID
		}
	}
	if id != "" {
		_ = a.DeleteTemplate(id)
	}
}
