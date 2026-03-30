package db

import "testing"

func TestIsSelectQuery(t *testing.T) {
	tests := []struct {
		name  string
		query string
		want  bool
	}{
		{name: "select", query: "SELECT 1", want: true},
		{name: "with", query: "with cte as (select 1) select * from cte", want: true},
		{name: "show", query: "SHOW TABLES", want: true},
		{name: "explain", query: "EXPLAIN SELECT 1", want: true},
		{name: "insert", query: "INSERT INTO t VALUES (1)", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsSelectQuery(tt.query); got != tt.want {
				t.Fatalf("IsSelectQuery() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestExtractTableFromQuery(t *testing.T) {
	schema, table := ExtractTableFromQuery(`SELECT * FROM public.users WHERE id = 1`)
	if schema != "public" || table != "users" {
		t.Fatalf("unexpected result schema=%q table=%q", schema, table)
	}

	schema, table = ExtractTableFromQuery(`SELECT * FROM [dbo].[employees]`)
	if schema != "dbo" || table != "employees" {
		t.Fatalf("unexpected bracket result schema=%q table=%q", schema, table)
	}
}

func TestSplitStatements(t *testing.T) {
	query := "SELECT ';'; -- keep semicolon\nSELECT 2; /* block;comment */ SELECT 3;"
	got := SplitStatements(query)
	if len(got) != 3 {
		t.Fatalf("expected 3 statements, got %d (%v)", len(got), got)
	}
}

func TestInjectPageClauseFallback(t *testing.T) {
	got := InjectPageClause("missing-driver", "SELECT * FROM users", 100, 200)
	want := "SELECT * FROM users LIMIT 100 OFFSET 200"
	if got != want {
		t.Fatalf("unexpected pagination query: got %q want %q", got, want)
	}
}

func TestIsReadOnlyStatement(t *testing.T) {
	tests := []struct {
		name  string
		query string
		want  bool
	}{
		{name: "select", query: "SELECT * FROM users", want: true},
		{name: "show", query: "SHOW TABLES", want: true},
		{name: "explain", query: "EXPLAIN SELECT 1", want: true},
		{name: "with select", query: "WITH cte AS (SELECT 1) SELECT * FROM cte", want: true},
		{name: "with insert", query: "WITH cte AS (INSERT INTO t VALUES (1) RETURNING *) SELECT * FROM cte", want: false},
		{name: "insert", query: "INSERT INTO t VALUES (1)", want: false},
		{name: "update", query: "UPDATE t SET a = 1", want: false},
		{name: "leading comments", query: "/* hello */ -- world\nSELECT 1", want: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsReadOnlyStatement(tt.query); got != tt.want {
				t.Fatalf("IsReadOnlyStatement() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestBatchHasMutatingStatements(t *testing.T) {
	if BatchHasMutatingStatements([]string{"SELECT 1", "SHOW TABLES"}) {
		t.Fatalf("expected read-only batch to be allowed")
	}

	if !BatchHasMutatingStatements([]string{"SELECT 1", "UPDATE users SET name='x'"}) {
		t.Fatalf("expected mixed batch to be marked mutating")
	}
}

func BenchmarkSplitStatements(b *testing.B) {
	query := `
SELECT * FROM users WHERE id = 1;
SELECT * FROM orders WHERE note = ';inside';
/* comment with ; */
SELECT * FROM products;
`
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = SplitStatements(query)
	}
}

func BenchmarkInjectPageClauseFallback(b *testing.B) {
	query := "SELECT id, name, created_at FROM huge_table WHERE status = 'active'"
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = InjectPageClause("missing-driver", query, 500, i%1000)
	}
}
