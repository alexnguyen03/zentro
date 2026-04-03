package app

import (
	"strings"
	"testing"
)

func TestRedactSQLLiteralsMasksQuotedValues(t *testing.T) {
	masked, hash := RedactSQLLiterals("SELECT * FROM users WHERE email = 'admin@example.com' AND note = \"secret\"")
	if strings.Contains(masked, "admin@example.com") {
		t.Fatalf("expected masked SQL to redact single-quoted literal, got %q", masked)
	}
	if strings.Contains(masked, "secret") {
		t.Fatalf("expected masked SQL to redact double-quoted literal, got %q", masked)
	}
	if hash == "" {
		t.Fatal("expected statement hash")
	}
}

func TestRedactSQLLiteralsProducesStableHash(t *testing.T) {
	_, hash1 := RedactSQLLiterals("SELECT 1")
	_, hash2 := RedactSQLLiterals("SELECT 1")
	if hash1 == "" || hash2 == "" {
		t.Fatal("expected non-empty hashes")
	}
	if hash1 != hash2 {
		t.Fatalf("expected stable hash, got %q and %q", hash1, hash2)
	}
}
