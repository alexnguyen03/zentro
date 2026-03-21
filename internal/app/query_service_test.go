package app

import (
	"testing"

	"zentro/internal/constant"
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
