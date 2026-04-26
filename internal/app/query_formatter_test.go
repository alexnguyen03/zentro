package app

import "testing"

func TestFormatSQL(t *testing.T) {
	svc := NewQueryFormatterService()

	tests := []struct {
		name    string
		query   string
		dialect string
		wantErr bool
	}{
		{name: "postgres", query: "select id,name from users where active=1", dialect: "postgres"},
		{name: "mysql", query: "select * from orders where amount>10 and status='ok'", dialect: "mysql"},
		{name: "sqlserver", query: "select top 10 * from logs order by created_at desc", dialect: "sqlserver"},
		{name: "sqlite", query: "select * from sqlite_master where type='table'", dialect: "sqlite"},
		{name: "invalid", query: "select 1", dialect: "oracle", wantErr: true},
		{name: "empty", query: "   ", dialect: "postgres", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := svc.FormatSQL(tt.query, tt.dialect)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got == "" {
				t.Fatalf("expected formatted output")
			}
		})
	}
}
