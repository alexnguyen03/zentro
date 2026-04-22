package db

import (
	"testing"
)

func TestIsSelectQuery(t *testing.T) {
	tests := []struct {
		name  string
		query string
		want  bool
	}{
		{"SELECT", "SELECT id FROM users", true},
		{"select lowercase", "select * from t", true},
		{"WITH CTE", "WITH x AS (SELECT 1) SELECT * FROM x", true},
		{"SHOW", "SHOW TABLES", true},
		{"EXPLAIN", "EXPLAIN SELECT 1", true},
		{"INSERT", "INSERT INTO t VALUES (1)", false},
		{"UPDATE", "UPDATE t SET x=1", false},
		{"DELETE", "DELETE FROM t", false},
		{"DROP", "DROP TABLE t", false},
		{"CREATE", "CREATE TABLE t (id INT)", false},
		{"leading whitespace", "  SELECT 1", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsSelectQuery(tt.query); got != tt.want {
				t.Errorf("IsSelectQuery(%q) = %v, want %v", tt.query, got, tt.want)
			}
		})
	}
}

func TestExtractTableFromQuery(t *testing.T) {
	tests := []struct {
		name       string
		query      string
		wantSchema string
		wantTable  string
	}{
		{"simple table", "SELECT * FROM users", "", "users"},
		{"schema.table", "SELECT * FROM public.users", "public", "users"},
		{"quoted table", `SELECT * FROM "my_table"`, "", "my_table"},
		{"bracketed schema.table", "SELECT * FROM [dbo].[orders]", "dbo", "orders"},
		{"no FROM clause", "SELECT 1", "", ""},
		{"table with alias", "SELECT * FROM orders o WHERE o.id = 1", "", "orders"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotSchema, gotTable := ExtractTableFromQuery(tt.query)
			if gotSchema != tt.wantSchema || gotTable != tt.wantTable {
				t.Errorf("ExtractTableFromQuery(%q) = (%q, %q), want (%q, %q)",
					tt.query, gotSchema, gotTable, tt.wantSchema, tt.wantTable)
			}
		})
	}
}

func TestInjectPageClause_Fallback(t *testing.T) {
	// Uses an unregistered driver name to exercise the fallback path.
	const unknownDriver = "__nonexistent__"
	tests := []struct {
		name   string
		query  string
		limit  int
		offset int
		want   string
	}{
		{
			"adds LIMIT",
			"SELECT * FROM t",
			100, 0,
			"SELECT * FROM t LIMIT 100",
		},
		{
			"adds LIMIT OFFSET when offset > 0",
			"SELECT * FROM t",
			100, 200,
			"SELECT * FROM t LIMIT 100 OFFSET 200",
		},
		{
			"skips injection when LIMIT already present",
			"SELECT * FROM t LIMIT 50",
			100, 0,
			"SELECT * FROM t LIMIT 50",
		},
		{
			"skips injection when OFFSET already present",
			"SELECT * FROM t LIMIT 50 OFFSET 0",
			100, 0,
			"SELECT * FROM t LIMIT 50 OFFSET 0",
		},
		{
			"skips injection when TOP already present",
			"SELECT TOP 10 * FROM t",
			100, 0,
			"SELECT TOP 10 * FROM t",
		},
		{
			"skips injection when FETCH already present",
			"SELECT * FROM t FETCH NEXT 10 ROWS ONLY",
			100, 0,
			"SELECT * FROM t FETCH NEXT 10 ROWS ONLY",
		},
		{
			"trims trailing whitespace before appending",
			"SELECT * FROM t  ",
			10, 0,
			"SELECT * FROM t LIMIT 10",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := InjectPageClause(unknownDriver, tt.query, tt.limit, tt.offset)
			if got != tt.want {
				t.Errorf("InjectPageClause(%q, %d, %d) = %q, want %q",
					tt.query, tt.limit, tt.offset, got, tt.want)
			}
		})
	}
}
