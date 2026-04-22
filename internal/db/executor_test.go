package db

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"testing"

	"zentro/internal/core"
	"zentro/internal/models"

	_ "modernc.org/sqlite"
)

// ─── Stub driver ─────────────────────────────────────────────────────────────

// stubDriver implements driver.DatabaseDriver with a real SQLite backend.
type stubDriver struct {
	name    string
	openErr error
}

func (s *stubDriver) Name() string { return s.name }
func (s *stubDriver) Open(_ *models.ConnectionProfile) (*sql.DB, error) {
	if s.openErr != nil {
		return nil, s.openErr
	}
	return sql.Open("sqlite", ":memory:")
}
func (s *stubDriver) FriendlyError(err error) error { return fmt.Errorf("stub: %w", err) }
func (s *stubDriver) InjectPageClause(query string, limit, offset int) string {
	if offset > 0 {
		return fmt.Sprintf("%s STUB_LIMIT %d STUB_OFFSET %d", query, limit, offset)
	}
	return fmt.Sprintf("%s STUB_LIMIT %d", query, limit)
}
func (s *stubDriver) DefaultSchema() string { return "main" }
func (s *stubDriver) FetchDatabases(_ context.Context, _ *sql.DB, _ string, _ bool, _ *slog.Logger) ([]*models.DatabaseInfo, error) {
	return []*models.DatabaseInfo{{Name: "testdb"}}, nil
}
func (s *stubDriver) FetchSchema(_ context.Context, _ *sql.DB, _ bool, _ *slog.Logger) ([]*models.SchemaNode, error) {
	return []*models.SchemaNode{{Name: "main"}}, nil
}
func (s *stubDriver) FetchTablePrimaryKeys(_ context.Context, _ *sql.DB, _, _ string) ([]string, error) {
	return []string{"id"}, nil
}
func (s *stubDriver) FetchTableColumns(_ context.Context, _ *sql.DB, _, _ string) ([]*models.ColumnDef, error) {
	return nil, nil
}
func (s *stubDriver) AlterTableColumn(_ context.Context, _ *sql.DB, _, _ string, _, _ *models.ColumnDef) error {
	return nil
}
func (s *stubDriver) AddTableColumn(_ context.Context, _ *sql.DB, _, _ string, _ *models.ColumnDef) error {
	return nil
}
func (s *stubDriver) DropTableColumn(_ context.Context, _ *sql.DB, _, _, _ string) error {
	return nil
}
func (s *stubDriver) FetchTableRelationships(_ context.Context, _ *sql.DB, _, _ string) ([]models.TableRelationship, error) {
	return nil, nil
}
func (s *stubDriver) ReorderTableColumns(_ context.Context, _ *sql.DB, _, _ string, _ []string) error {
	return nil
}

// registerStub registers a stub driver with a unique name for the given test.
func registerStub(name string) *stubDriver {
	d := &stubDriver{name: name}
	core.Register(d)
	return d
}

// ─── IsSelectQuery ────────────────────────────────────────────────────────────

func TestIsSelectQuery(t *testing.T) {
	cases := []struct {
		query string
		want  bool
	}{
		{"SELECT * FROM users", true},
		{"select * from users", true},
		{"  SELECT 1", true},
		{"WITH cte AS (SELECT 1) SELECT * FROM cte", true},
		{"SHOW TABLES", true},
		{"EXPLAIN SELECT * FROM users", true},
		{"INSERT INTO t VALUES (1)", false},
		{"UPDATE t SET x=1", false},
		{"DELETE FROM t", false},
		{"DROP TABLE t", false},
		{"CREATE TABLE t (id INT)", false},
		{"", false},
	}

	for _, c := range cases {
		t.Run(c.query, func(t *testing.T) {
			if got := IsSelectQuery(c.query); got != c.want {
				t.Errorf("IsSelectQuery(%q) = %v, want %v", c.query, got, c.want)
			}
		})
	}
}

// ─── ExtractTableFromQuery ────────────────────────────────────────────────────

func TestExtractTableFromQuery(t *testing.T) {
	cases := []struct {
		query      string
		wantSchema string
		wantTable  string
	}{
		{"SELECT * FROM users", "", "users"},
		{"SELECT * FROM public.users", "public", "users"},
		{`SELECT * FROM "dbo"."Orders"`, "dbo", "Orders"},
		{"SELECT * FROM [dbo].[Orders]", "dbo", "Orders"},
		{"SELECT * FROM schema1.table1", "schema1", "table1"},
		{"SELECT 1", "", ""},
		{"INSERT INTO t VALUES (1)", "", ""},
	}

	for _, c := range cases {
		t.Run(c.query, func(t *testing.T) {
			schema, table := ExtractTableFromQuery(c.query)
			if schema != c.wantSchema || table != c.wantTable {
				t.Errorf("ExtractTableFromQuery(%q) = (%q, %q), want (%q, %q)",
					c.query, schema, table, c.wantSchema, c.wantTable)
			}
		})
	}
}

// ─── fallbackInjectPage ───────────────────────────────────────────────────────

func TestFallbackInjectPage(t *testing.T) {
	cases := []struct {
		query  string
		limit  int
		offset int
		want   string
	}{
		{"SELECT * FROM t", 50, 0, "SELECT * FROM t LIMIT 50"},
		{"SELECT * FROM t", 50, 100, "SELECT * FROM t LIMIT 50 OFFSET 100"},
		{"SELECT * FROM t LIMIT 10", 50, 0, "SELECT * FROM t LIMIT 10"},
		{"SELECT * FROM t OFFSET 5", 50, 0, "SELECT * FROM t OFFSET 5"},
		{"SELECT TOP 10 * FROM t", 50, 0, "SELECT TOP 10 * FROM t"},
		{"SELECT * FROM t FETCH NEXT 5 ROWS ONLY", 50, 0, "SELECT * FROM t FETCH NEXT 5 ROWS ONLY"},
		{"SELECT * FROM t  ", 100, 0, "SELECT * FROM t LIMIT 100"},
	}

	for _, c := range cases {
		t.Run(c.query, func(t *testing.T) {
			got := fallbackInjectPage(c.query, c.limit, c.offset)
			if got != c.want {
				t.Errorf("fallbackInjectPage(%q, %d, %d) = %q, want %q",
					c.query, c.limit, c.offset, got, c.want)
			}
		})
	}
}

// ─── InjectPageClause ─────────────────────────────────────────────────────────

func TestInjectPageClause_UnregisteredDriver_UsesFallback(t *testing.T) {
	got := InjectPageClause("unregistered_driver", "SELECT * FROM t", 50, 0)
	want := "SELECT * FROM t LIMIT 50"
	if got != want {
		t.Errorf("InjectPageClause unregistered = %q, want %q", got, want)
	}
}

func TestInjectPageClause_RegisteredDriver_UsesDialect(t *testing.T) {
	d := registerStub("stub_inject_with_offset")
	_ = d

	got := InjectPageClause("stub_inject_with_offset", "SELECT * FROM t", 25, 50)
	want := "SELECT * FROM t STUB_LIMIT 25 STUB_OFFSET 50"
	if got != want {
		t.Errorf("InjectPageClause with offset = %q, want %q", got, want)
	}
}

func TestInjectPageClause_RegisteredDriver_NoOffset(t *testing.T) {
	registerStub("stub_inject_no_offset")

	got := InjectPageClause("stub_inject_no_offset", "SELECT * FROM t", 100, 0)
	want := "SELECT * FROM t STUB_LIMIT 100"
	if got != want {
		t.Errorf("InjectPageClause no offset = %q, want %q", got, want)
	}
}

// ─── OpenConnection ───────────────────────────────────────────────────────────

func TestOpenConnection_UnknownDriver_ReturnsError(t *testing.T) {
	_, err := OpenConnection(&models.ConnectionProfile{Driver: "no_such_driver"})
	if err == nil {
		t.Fatal("expected error for unknown driver, got nil")
	}
}

func TestOpenConnection_DriverOpenError_ReturnsError(t *testing.T) {
	d := &stubDriver{name: "stub_open_err", openErr: fmt.Errorf("open failed")}
	core.Register(d)

	_, err := OpenConnection(&models.ConnectionProfile{Driver: "stub_open_err"})
	if err == nil {
		t.Fatal("expected error when driver.Open fails, got nil")
	}
}

func TestOpenConnection_Success_SetsPoolConfig(t *testing.T) {
	registerStub("stub_open_ok")

	db, err := OpenConnection(&models.ConnectionProfile{Driver: "stub_open_ok"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	db.Close()
}

// ─── TestConnection ───────────────────────────────────────────────────────────

func TestTestConnection_UnknownDriver_ReturnsError(t *testing.T) {
	err := TestConnection(&models.ConnectionProfile{Driver: "no_such_driver_ping"})
	if err == nil {
		t.Fatal("expected error for unknown driver, got nil")
	}
}

func TestTestConnection_Success(t *testing.T) {
	registerStub("stub_ping_ok")

	err := TestConnection(&models.ConnectionProfile{Driver: "stub_ping_ok"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

// ─── FriendlyError ───────────────────────────────────────────────────────────

func TestFriendlyError_NilError(t *testing.T) {
	if err := FriendlyError("any_driver", nil); err != nil {
		t.Errorf("expected nil, got %v", err)
	}
}

func TestFriendlyError_UnknownDriver_GenericMessage(t *testing.T) {
	err := FriendlyError("unknown_driver_friendly", fmt.Errorf("raw error"))
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestFriendlyError_KnownDriver_Delegates(t *testing.T) {
	registerStub("stub_friendly")

	err := FriendlyError("stub_friendly", fmt.Errorf("original"))
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

// ─── FetchDatabases ───────────────────────────────────────────────────────────

func TestFetchDatabases_UnknownDriver(t *testing.T) {
	_, err := FetchDatabases(nil, "no_such_driver_schema", "", false, nil)
	if err == nil {
		t.Fatal("expected error for unknown driver, got nil")
	}
}

func TestFetchDatabases_Success(t *testing.T) {
	registerStub("stub_fetch_db")
	db, _ := sql.Open("sqlite", ":memory:")
	defer db.Close()

	dbs, err := FetchDatabases(db, "stub_fetch_db", "testdb", false, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(dbs) == 0 {
		t.Error("expected at least one database, got none")
	}
}

// ─── FetchTablePrimaryKeys ────────────────────────────────────────────────────

func TestFetchTablePrimaryKeys_UnknownDriver(t *testing.T) {
	_, err := FetchTablePrimaryKeys(nil, "no_such_driver_pk", "", "users")
	if err == nil {
		t.Fatal("expected error for unknown driver, got nil")
	}
}

func TestFetchTablePrimaryKeys_Success(t *testing.T) {
	registerStub("stub_pk")
	db, _ := sql.Open("sqlite", ":memory:")
	defer db.Close()

	pks, err := FetchTablePrimaryKeys(db, "stub_pk", "main", "users")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(pks) == 0 {
		t.Error("expected primary keys, got none")
	}
}

// ─── FetchAllDatabaseSchemas ──────────────────────────────────────────────────

func TestFetchAllDatabaseSchemas_UnknownDriver_NoOp(t *testing.T) {
	databases := []*models.DatabaseInfo{{Name: "db1"}}
	// Must not panic; unknown driver just logs a warning and returns.
	FetchAllDatabaseSchemas(databases, "main", "no_such_driver_all", false,
		func(dbName string) (*sql.DB, error) {
			return sql.Open("sqlite", ":memory:")
		}, nil)
}

func TestFetchAllDatabaseSchemas_FetchesUnloadedDatabases(t *testing.T) {
	registerStub("stub_all_schemas")

	databases := []*models.DatabaseInfo{
		{Name: "current", Schemas: []*models.SchemaNode{{Name: "already loaded"}}},
		{Name: "unloaded"},
	}

	FetchAllDatabaseSchemas(databases, "current", "stub_all_schemas", false,
		func(dbName string) (*sql.DB, error) {
			return sql.Open("sqlite", ":memory:")
		}, nil)

	if len(databases[1].Schemas) == 0 {
		t.Error("expected unloaded database to have schemas fetched")
	}
}

func TestFetchAllDatabaseSchemas_OpenError_SkipsDatabase(t *testing.T) {
	registerStub("stub_all_open_err")

	databases := []*models.DatabaseInfo{{Name: "bad_db"}}
	// Should not panic or fail — just skip on open error.
	FetchAllDatabaseSchemas(databases, "other", "stub_all_open_err", false,
		func(dbName string) (*sql.DB, error) {
			return nil, fmt.Errorf("cannot open")
		}, nil)
}
