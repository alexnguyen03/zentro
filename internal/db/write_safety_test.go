package db

import "testing"

func TestAnalyzeStatementRisk_UpdateWithoutWhere(t *testing.T) {
	risk := AnalyzeStatementRisk("UPDATE users SET role = 'admin'")
	if !risk.UpdateNoWhere {
		t.Fatalf("expected update without where to be detected")
	}
	if !risk.Destructive {
		t.Fatalf("expected update to be destructive")
	}
}

func TestAnalyzeStatementRisk_IgnoreWhereInString(t *testing.T) {
	risk := AnalyzeStatementRisk("UPDATE users SET note = 'where here'")
	if !risk.UpdateNoWhere {
		t.Fatalf("expected where inside string to be ignored")
	}
}

func TestAnalyzeSQLRisk_MixedBatch(t *testing.T) {
	risk := AnalyzeSQLRisk(`
-- comment
UPDATE users SET name = 'alice' WHERE id = 1;
DELETE FROM sessions;
SELECT 1;
`)
	if !risk.HasWrite {
		t.Fatalf("expected write batch")
	}
	if !risk.HasDestructive {
		t.Fatalf("expected destructive batch")
	}
	if !risk.HasDeleteNoWhere {
		t.Fatalf("expected delete without where")
	}
}
