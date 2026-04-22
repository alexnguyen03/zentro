package app

import (
	"context"
	"testing"

	"zentro/internal/models"
	"zentro/internal/utils"
)

// newDisconnectedApp creates an App with a logger but no db/profile (simulates disconnected state).
func newDisconnectedApp() *App {
	a := NewApp()
	a.ctx = context.Background()
	a.logger = utils.NewLogger(false)
	a.conn.logger = a.logger
	a.query.logger = a.logger
	a.scripts.logger = a.logger
	// a.db and a.profile remain nil
	return a
}

// ─── App.Startup ─────────────────────────────────────────────────────────────

func TestApp_Startup_LoadsPrefs(t *testing.T) {
	a := NewApp()
	a.Startup(context.Background())
	// Startup sets up logger, loads prefs, etc. Just verify it doesn't panic.
	if a.logger == nil {
		t.Error("expected logger to be set after Startup")
	}
}

// ─── ConnectionService: error paths with nil profile/db ──────────────────────

func TestConnectionService_Connect_ProfileNotFound(t *testing.T) {
	a := newDisconnectedApp()
	err := a.conn.Connect("nonexistent_profile_xyz")
	if err == nil {
		t.Error("expected error for non-existent profile, got nil")
	}
}

func TestApp_Connect_ProfileNotFound(t *testing.T) {
	a := newDisconnectedApp()
	err := a.Connect("nonexistent_profile_xyz")
	if err == nil {
		t.Error("expected error from app.Connect, got nil")
	}
}

func TestConnectionService_Reconnect_NoProfile(t *testing.T) {
	a := newDisconnectedApp()
	err := a.conn.Reconnect()
	if err == nil {
		t.Error("expected error for Reconnect with no active profile, got nil")
	}
}

func TestApp_Reconnect_NoProfile(t *testing.T) {
	a := newDisconnectedApp()
	err := a.Reconnect()
	if err == nil {
		t.Error("expected error from app.Reconnect, got nil")
	}
}

func TestConnectionService_SwitchDatabase_NoProfile(t *testing.T) {
	a := newDisconnectedApp()
	err := a.conn.SwitchDatabase("newdb")
	if err == nil {
		t.Error("expected error for SwitchDatabase with no active profile, got nil")
	}
}

func TestApp_SwitchDatabase_NoProfile(t *testing.T) {
	a := newDisconnectedApp()
	err := a.SwitchDatabase("newdb")
	if err == nil {
		t.Error("expected error from app.SwitchDatabase, got nil")
	}
}

func TestConnectionService_SwitchDatabase_SameDB(t *testing.T) {
	a := setupApp(t)
	a.profile = &models.ConnectionProfile{Name: "test", DBName: "same_db"}
	// Should return nil (no-op) when switching to same DB.
	err := a.conn.SwitchDatabase("same_db")
	if err != nil {
		t.Errorf("expected nil error switching to same db, got: %v", err)
	}
}

func TestConnectionService_FetchDatabaseSchema_NoProfile(t *testing.T) {
	a := newDisconnectedApp()
	err := a.conn.FetchDatabaseSchema("no_profile", "testdb")
	if err == nil {
		t.Error("expected error for FetchDatabaseSchema with no profile, got nil")
	}
}

func TestApp_FetchDatabaseSchema_NoProfile(t *testing.T) {
	a := newDisconnectedApp()
	err := a.FetchDatabaseSchema("no_profile", "testdb")
	if err == nil {
		t.Error("expected error from app.FetchDatabaseSchema, got nil")
	}
}

func TestConnectionService_FetchTableColumns_NoProfile(t *testing.T) {
	a := newDisconnectedApp()
	_, err := a.conn.FetchTableColumns("schema", "table")
	if err == nil {
		t.Error("expected error for FetchTableColumns with no profile, got nil")
	}
}

func TestApp_FetchTableColumns_NoProfile(t *testing.T) {
	a := newDisconnectedApp()
	_, err := a.FetchTableColumns("schema", "table")
	if err == nil {
		t.Error("expected error from app.FetchTableColumns, got nil")
	}
}

func TestConnectionService_AlterTableColumn_NoProfile(t *testing.T) {
	a := newDisconnectedApp()
	err := a.conn.AlterTableColumn("schema", "table", models.ColumnDef{}, models.ColumnDef{})
	if err == nil {
		t.Error("expected error for AlterTableColumn with no profile, got nil")
	}
}

func TestApp_AlterTableColumn_NoProfile(t *testing.T) {
	a := newDisconnectedApp()
	err := a.AlterTableColumn("schema", "table", models.ColumnDef{}, models.ColumnDef{})
	if err == nil {
		t.Error("expected error from app.AlterTableColumn, got nil")
	}
}

func TestConnectionService_ReorderTableColumns_NoProfile(t *testing.T) {
	a := newDisconnectedApp()
	err := a.conn.ReorderTableColumns("schema", "table", []string{"a", "b"})
	if err == nil {
		t.Error("expected error for ReorderTableColumns with no profile, got nil")
	}
}

func TestApp_ReorderTableColumns_NoProfile(t *testing.T) {
	a := newDisconnectedApp()
	err := a.ReorderTableColumns("schema", "table", []string{"a", "b"})
	if err == nil {
		t.Error("expected error from app.ReorderTableColumns, got nil")
	}
}

func TestConnectionService_AddTableColumn_NoProfile(t *testing.T) {
	a := newDisconnectedApp()
	err := a.conn.AddTableColumn("schema", "table", models.ColumnDef{Name: "new_col"})
	if err == nil {
		t.Error("expected error for AddTableColumn with no profile, got nil")
	}
}

func TestApp_AddTableColumn_NoProfile(t *testing.T) {
	a := newDisconnectedApp()
	err := a.AddTableColumn("schema", "table", models.ColumnDef{Name: "new_col"})
	if err == nil {
		t.Error("expected error from app.AddTableColumn, got nil")
	}
}

func TestConnectionService_DropTableColumn_NoProfile(t *testing.T) {
	a := newDisconnectedApp()
	err := a.conn.DropTableColumn("schema", "table", "col")
	if err == nil {
		t.Error("expected error for DropTableColumn with no profile, got nil")
	}
}

func TestApp_DropTableColumn_NoProfile(t *testing.T) {
	a := newDisconnectedApp()
	err := a.DropTableColumn("schema", "table", "col")
	if err == nil {
		t.Error("expected error from app.DropTableColumn, got nil")
	}
}

func TestConnectionService_FetchTableRelationships_NoProfile(t *testing.T) {
	a := newDisconnectedApp()
	_, err := a.conn.FetchTableRelationships("schema", "table")
	if err == nil {
		t.Error("expected error for FetchTableRelationships with no profile, got nil")
	}
}

func TestApp_FetchTableRelationships_NoProfile(t *testing.T) {
	a := newDisconnectedApp()
	_, err := a.FetchTableRelationships("schema", "table")
	if err == nil {
		t.Error("expected error from app.FetchTableRelationships, got nil")
	}
}

// ─── ConnectionService: SaveConnection ───────────────────────────────────────

func TestConnectionService_SaveConnection_NewProfile(t *testing.T) {
	a := setupApp(t)
	p := models.ConnectionProfile{Name: "test_save_conn_xyz", Driver: "sqlite", Host: "localhost"}
	if err := a.conn.SaveConnection(p); err != nil {
		t.Fatalf("SaveConnection error: %v", err)
	}
	// Clean up.
	_ = a.conn.DeleteConnection("test_save_conn_xyz")
}

func TestApp_SaveConnection(t *testing.T) {
	a := setupApp(t)
	p := models.ConnectionProfile{Name: "test_app_save_xyz", Driver: "sqlite"}
	_ = a.SaveConnection(p)
	_ = a.DeleteConnection("test_app_save_xyz")
}

// ─── ScriptService extra coverage ────────────────────────────────────────────

func TestApp_GetScriptContent_Missing(t *testing.T) {
	a := setupApp(t)
	// May return error or empty string; should not panic.
	_, _ = a.GetScriptContent("noconn", "noscript")
}

func TestApp_DeleteScript_Missing(t *testing.T) {
	a := setupApp(t)
	// Deleting a non-existent script should not panic.
	_ = a.DeleteScript("noconn", "noscript")
}
