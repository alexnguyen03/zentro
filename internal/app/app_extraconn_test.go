package app

import (
	"context"
	"testing"

	"zentro/internal/models"
	"zentro/internal/utils"
)

// appWithProfileNoDB creates an App with a profile but nil db.
func appWithProfileNoDB() *App {
	a := NewApp()
	a.ctx = context.Background()
	a.logger = utils.NewLogger(false)
	a.conn.logger = a.logger
	a.query.logger = a.logger
	a.profile = &models.ConnectionProfile{Name: "testprofile", Driver: "no_such_driver_xyz"}
	// a.db remains nil
	return a
}

// ─── FetchTable* nil-db paths ────────────────────────────────────────────────

func TestConnectionService_FetchTableColumns_NoDB(t *testing.T) {
	a := appWithProfileNoDB()
	_, err := a.conn.FetchTableColumns("schema", "table")
	if err == nil {
		t.Error("expected error for FetchTableColumns with nil db, got nil")
	}
}

func TestConnectionService_AlterTableColumn_NoDB(t *testing.T) {
	a := appWithProfileNoDB()
	err := a.conn.AlterTableColumn("schema", "table", models.ColumnDef{}, models.ColumnDef{})
	if err == nil {
		t.Error("expected error for AlterTableColumn with nil db, got nil")
	}
}

func TestConnectionService_ReorderTableColumns_NoDB(t *testing.T) {
	a := appWithProfileNoDB()
	err := a.conn.ReorderTableColumns("schema", "table", []string{"a"})
	if err == nil {
		t.Error("expected error for ReorderTableColumns with nil db, got nil")
	}
}

func TestConnectionService_AddTableColumn_NoDB(t *testing.T) {
	a := appWithProfileNoDB()
	err := a.conn.AddTableColumn("schema", "table", models.ColumnDef{Name: "col"})
	if err == nil {
		t.Error("expected error for AddTableColumn with nil db, got nil")
	}
}

func TestConnectionService_DropTableColumn_NoDB(t *testing.T) {
	a := appWithProfileNoDB()
	err := a.conn.DropTableColumn("schema", "table", "col")
	if err == nil {
		t.Error("expected error for DropTableColumn with nil db, got nil")
	}
}

func TestConnectionService_FetchTableRelationships_NoDB(t *testing.T) {
	a := appWithProfileNoDB()
	_, err := a.conn.FetchTableRelationships("schema", "table")
	if err == nil {
		t.Error("expected error for FetchTableRelationships with nil db, got nil")
	}
}

// ─── SwitchDatabase: unregistered driver triggers error path ─────────────────

func TestConnectionService_SwitchDatabase_UnknownDriver(t *testing.T) {
	emitEvent = func(_ context.Context, _ string, _ ...interface{}) {}

	a := appWithProfileNoDB()
	a.profile = &models.ConnectionProfile{Name: "test", DBName: "db_a", Driver: "no_driver_switch"}
	err := a.conn.SwitchDatabase("db_b")
	if err == nil {
		t.Error("expected error when SwitchDatabase uses unregistered driver, got nil")
	}
}

// ─── SaveConnection: update existing profile path ────────────────────────────

func TestConnectionService_SaveConnection_UpdateExisting(t *testing.T) {
	a := setupApp(t)

	p := models.ConnectionProfile{Name: "test_update_xyz", Driver: "sqlite", Host: "localhost", Port: 5432}
	if err := a.conn.SaveConnection(p); err != nil {
		t.Fatalf("initial SaveConnection error: %v", err)
	}

	p.Port = 5433
	if err := a.conn.SaveConnection(p); err != nil {
		t.Fatalf("update SaveConnection error: %v", err)
	}

	profiles, err := a.conn.LoadConnections()
	if err != nil {
		t.Fatalf("LoadConnections error: %v", err)
	}
	found := false
	for _, prof := range profiles {
		if prof.Name == "test_update_xyz" && prof.Port == 5433 {
			found = true
		}
	}
	if !found {
		t.Error("updated profile not found with new port")
	}

	_ = a.conn.DeleteConnection("test_update_xyz")
}
