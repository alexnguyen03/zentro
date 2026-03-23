package app

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"zentro/internal/constant"
	"zentro/internal/utils"
)

func TestBuildExplainQuery(t *testing.T) {
	tests := []struct {
		name    string
		driver  string
		analyze bool
		want    string
		wantErr bool
	}{
		{
			name:    "postgres analyze",
			driver:  constant.DriverPostgres,
			analyze: true,
			want:    "EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT 1",
		},
		{
			name:    "mysql no analyze",
			driver:  constant.DriverMySQL,
			analyze: false,
			want:    "EXPLAIN FORMAT=JSON SELECT 1",
		},
		{
			name:    "sqlite no analyze",
			driver:  constant.DriverSQLite,
			analyze: false,
			want:    "EXPLAIN QUERY PLAN SELECT 1",
		},
		{
			name:    "sqlserver unsupported",
			driver:  constant.DriverSQLServer,
			analyze: false,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := buildExplainQuery(tt.driver, "SELECT 1;", tt.analyze)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tt.want {
				t.Fatalf("unexpected explain query: got %q want %q", got, tt.want)
			}
		})
	}
}

func TestResultTabIDAndSourceTabID(t *testing.T) {
	if got := resultTabID("tab-1", 0); got != "tab-1" {
		t.Fatalf("unexpected tab id: %s", got)
	}
	if got := resultTabID("tab-1", 2); got != "tab-1::result:3" {
		t.Fatalf("unexpected result tab id: %s", got)
	}
	if got := sourceTabID("tab-1::result:3"); got != "tab-1" {
		t.Fatalf("unexpected source tab id: %s", got)
	}
}

func TestFormatSQLServerUUID(t *testing.T) {
	raw := []byte{
		0x67, 0x45, 0x23, 0x01,
		0xab, 0x89,
		0xef, 0xcd,
		0x01, 0x23,
		0x45, 0x67, 0x89, 0xab, 0xcd, 0xef,
	}

	got := formatSQLServerUUID(raw)
	want := "01234567-89ab-cdef-0123-456789abcdef"
	if got != want {
		t.Fatalf("unexpected uuid: got %s want %s", got, want)
	}
}

func TestStreamSelect_SkipsPrimaryKeyLookupWhenDBIsNil(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	if _, err := db.Exec("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);"); err != nil {
		t.Fatalf("failed to create table: %v", err)
	}
	if _, err := db.Exec("INSERT INTO users (name) VALUES ('alice'), ('bob');"); err != nil {
		t.Fatalf("failed to seed table: %v", err)
	}

	doneCh := make(chan map[string]any, 1)
	svc := NewQueryService(
		context.Background(),
		utils.NewLogger(false),
		func() utils.Preferences {
			return utils.Preferences{DefaultLimit: 100, ChunkSize: 10, QueryTimeout: 5}
		},
		func() *sql.DB { return nil },
		func() sqlExecutor { return db },
		func() string { return constant.DriverSQLite },
		func(string, int64, time.Duration, error) {},
		funcEventEmitter{fn: func(_ context.Context, eventName string, payload any) {
			if eventName != constant.EventQueryDone {
				return
			}
			data, ok := payload.(map[string]any)
			if ok {
				doneCh <- data
			}
		}},
	)

	err := svc.streamSelect(
		context.Background(),
		db,
		queryStatement{
			SourceTabID: "source-tab",
			TabID:       "tab-users",
			Text:        "SELECT id, name FROM users",
			Index:       0,
			Count:       1,
		},
		0,
		time.Now(),
	)
	if err != nil {
		t.Fatalf("expected query to succeed even without metadata db, got %v", err)
	}

	select {
	case done := <-doneCh:
		if got, ok := done["affected"].(int64); !ok || got != 2 {
			t.Fatalf("expected affected=2, got %#v", done["affected"])
		}
		if _, hasErr := done["error"]; hasErr {
			t.Fatalf("expected no query error, got %#v", done["error"])
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timeout waiting for done event")
	}
}
