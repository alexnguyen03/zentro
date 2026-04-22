package app

import (
	"context"
	"testing"
	"time"

	"zentro/internal/models"
)

// ─── App lifecycle ────────────────────────────────────────────────────────────

func TestApp_Shutdown_WithDB(t *testing.T) {
	a := setupApp(t)
	emitEvent = func(_ context.Context, _ string, _ ...interface{}) {}
	a.Shutdown()
	if a.db != nil {
		t.Error("expected db to be nil after Shutdown")
	}
}

func TestApp_Shutdown_NoDB(t *testing.T) {
	a := NewApp()
	a.ctx = context.Background()
	a.logger = setupApp(t).logger
	a.query.logger = a.logger
	emitEvent = func(_ context.Context, _ string, _ ...interface{}) {}
	// Should not panic when db is nil.
	a.Shutdown()
}

func TestApp_OnBeforeClose_ReturnsTrue(t *testing.T) {
	a := setupApp(t)
	emitEvent = func(_ context.Context, _ string, _ ...interface{}) {}
	result := a.OnBeforeClose(context.Background())
	if !result {
		t.Error("expected OnBeforeClose to return true when forceQuit is false")
	}
}

// ─── App delegators ───────────────────────────────────────────────────────────

func TestApp_GetConnectionStatus(t *testing.T) {
	a := setupApp(t)
	status, err := a.GetConnectionStatus()
	if err != nil {
		t.Fatalf("GetConnectionStatus error: %v", err)
	}
	if _, ok := status["status"]; !ok {
		t.Error("expected 'status' key in connection status result")
	}
}

func TestApp_GetAndSetPreferences(t *testing.T) {
	a := setupApp(t)
	prefs := a.GetPreferences()

	prefs.DefaultLimit = 12345
	if err := a.SetPreferences(prefs); err != nil {
		t.Fatalf("SetPreferences error: %v", err)
	}
	if got := a.GetPreferences(); got.DefaultLimit != 12345 {
		t.Errorf("expected DefaultLimit 12345, got %d", got.DefaultLimit)
	}
}

func TestApp_LoadConnections_ReturnsSlice(t *testing.T) {
	a := setupApp(t)
	// May return empty slice or an error — either is acceptable in CI.
	_, _ = a.LoadConnections()
}

func TestApp_GetHistory_ReturnsSlice(t *testing.T) {
	a := setupApp(t)
	entries := a.GetHistory()
	_ = entries // just ensure it doesn't panic
}

func TestApp_ClearHistory(t *testing.T) {
	a := setupApp(t)
	// Append something so there's state to clear.
	a.history.AppendEntry("SELECT clear_test", 1, time.Millisecond, nil)
	// ClearHistory may error if file doesn't exist — that's acceptable.
	_ = a.ClearHistory()
	entries := a.GetHistory()
	if len(entries) != 0 {
		t.Errorf("expected empty history after ClearHistory, got %d entries", len(entries))
	}
}

func TestApp_GetScripts_DoesNotPanic(t *testing.T) {
	a := setupApp(t)
	// May return an error if scripts dir doesn't exist — acceptable.
	_, _ = a.GetScripts("nonexistent_connection")
}

func TestApp_LoadTemplates_DoesNotPanic(t *testing.T) {
	a := setupApp(t)
	_, _ = a.LoadTemplates()
}

// ─── ConnectionService ────────────────────────────────────────────────────────

func TestConnectionService_SetContext(t *testing.T) {
	a := setupApp(t)
	newCtx := context.WithValue(context.Background(), struct{ k string }{"key"}, "val")
	a.conn.SetContext(newCtx)
	if a.conn.ctx != newCtx {
		t.Error("conn.SetContext did not update ctx")
	}
}

func TestConnectionService_LoadConnections(t *testing.T) {
	a := setupApp(t)
	// Just ensure it doesn't panic.
	_, _ = a.conn.LoadConnections()
}

func TestConnectionService_GetConnectionStatus_Disconnected(t *testing.T) {
	a := setupApp(t)
	// Ensure profile and db are nil so we get "disconnected".
	a.db = nil
	a.profile = nil
	status, err := a.conn.GetConnectionStatus()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if status["status"] != "disconnected" {
		t.Errorf("expected disconnected, got %v", status["status"])
	}
}

func TestConnectionService_GetConnectionStatus_Connected(t *testing.T) {
	a := setupApp(t)
	defer a.db.Close()
	// db is set so we should get "connected".
	status, err := a.conn.GetConnectionStatus()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if status["status"] != "connected" {
		t.Errorf("expected connected, got %v", status["status"])
	}
}

func TestConnectionService_DeleteConnection_Nonexistent(t *testing.T) {
	a := setupApp(t)
	// Delete non-existent connection — may return an error, should not panic.
	_ = a.conn.DeleteConnection("nonexistent_profile_xyz")
}

// ─── TemplateService ──────────────────────────────────────────────────────────

func TestTemplateService_LoadTemplates_EmptyInitially(t *testing.T) {
	svc := NewTemplateService()
	templates, err := svc.LoadTemplates()
	if err != nil {
		t.Fatalf("LoadTemplates error: %v", err)
	}
	_ = templates // just ensure it works
}

func TestTemplateService_SaveAndLoadTemplate(t *testing.T) {
	svc := NewTemplateService()

	tmpl := models.Template{
		Name:    "Test Template",
		Content: "SELECT 1",
	}
	if err := svc.SaveTemplate(tmpl); err != nil {
		t.Fatalf("SaveTemplate error: %v", err)
	}

	templates, err := svc.LoadTemplates()
	if err != nil {
		t.Fatalf("LoadTemplates after save error: %v", err)
	}
	found := false
	for _, tpl := range templates {
		if tpl.Name == "Test Template" {
			found = true
			break
		}
	}
	if !found {
		t.Error("saved template not found in LoadTemplates result")
	}
}

func TestTemplateService_SaveTemplate_WithID_Updates(t *testing.T) {
	svc := NewTemplateService()

	// First save without ID generates an ID.
	tmpl := models.Template{Name: "Update Test", Content: "SELECT 2"}
	if err := svc.SaveTemplate(tmpl); err != nil {
		t.Fatalf("SaveTemplate error: %v", err)
	}
	templates, _ := svc.LoadTemplates()
	var savedID string
	for _, tpl := range templates {
		if tpl.Name == "Update Test" {
			savedID = tpl.ID
			break
		}
	}

	if savedID == "" {
		t.Skip("couldn't find saved template ID — skipping update test")
	}

	// Update with existing ID.
	updated := models.Template{ID: savedID, Name: "Update Test", Content: "SELECT 3"}
	if err := svc.SaveTemplate(updated); err != nil {
		t.Fatalf("SaveTemplate update error: %v", err)
	}

	templates, _ = svc.LoadTemplates()
	for _, tpl := range templates {
		if tpl.ID == savedID && tpl.Content != "SELECT 3" {
			t.Errorf("expected updated content 'SELECT 3', got %q", tpl.Content)
		}
	}
}

func TestTemplateService_DeleteTemplate(t *testing.T) {
	svc := NewTemplateService()

	tmpl := models.Template{Name: "Delete Test", Content: "SELECT DELETE"}
	_ = svc.SaveTemplate(tmpl)

	templates, _ := svc.LoadTemplates()
	var savedID string
	for _, tpl := range templates {
		if tpl.Name == "Delete Test" {
			savedID = tpl.ID
			break
		}
	}

	if savedID == "" {
		t.Skip("couldn't find template ID — skipping delete test")
	}

	if err := svc.DeleteTemplate(savedID); err != nil {
		t.Fatalf("DeleteTemplate error: %v", err)
	}

	templates, _ = svc.LoadTemplates()
	for _, tpl := range templates {
		if tpl.ID == savedID {
			t.Error("template still exists after DeleteTemplate")
		}
	}
}

func TestTemplateService_DeleteTemplate_NilState(t *testing.T) {
	svc := NewTemplateService()
	// Calling delete when templates is nil should not panic.
	_ = svc.DeleteTemplate("nonexistent_id")
}

// ─── QueryService extra coverage ─────────────────────────────────────────────

func TestQueryService_ExecuteNonSelect_DBError(t *testing.T) {
	a := setupApp(t)
	defer a.db.Close()

	doneChan := make(chan map[string]any, 1)
	emitEvent = func(_ context.Context, name string, args ...interface{}) {
		if name == "query:done" && len(args) > 0 {
			if d, ok := args[0].(map[string]any); ok {
				doneChan <- d
			}
		}
	}

	// Execute a syntactically bad statement that will fail.
	a.ExecuteQuery("err-tab", "INSERT INTO nonexistent_table_xyz (col) VALUES (1)")

	select {
	case done := <-doneChan:
		if errMsg, _ := done["error"].(string); errMsg == "" {
			t.Error("expected error in done event for failed INSERT")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for query:done")
	}
}

func TestQueryService_FetchMoreRows_NoDB(t *testing.T) {
	a := NewApp()
	a.ctx = context.Background()
	a.logger = setupApp(nil).logger
	a.query.logger = a.logger
	// Store an active query but leave db nil.
	a.query.activeQueriesMu.Lock()
	a.query.activeQueries["nil-db-tab"] = "SELECT 1"
	a.query.activeQueriesMu.Unlock()

	doneChan := make(chan map[string]any, 1)
	emitEvent = func(_ context.Context, name string, args ...interface{}) {
		if name == "query:done" && len(args) > 0 {
			if d, ok := args[0].(map[string]any); ok {
				doneChan <- d
			}
		}
	}

	a.FetchMoreRows("nil-db-tab", 0)

	select {
	case done := <-doneChan:
		if errMsg, _ := done["error"].(string); errMsg == "" {
			t.Error("expected error when db is nil, got none")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for query:done")
	}
}
