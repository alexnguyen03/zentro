package app

import (
	"strings"
	"testing"
)

func TestCompareQueries(t *testing.T) {
	svc := NewQueryCompareService()
	diff, err := svc.CompareQueries("select 1\nfrom users", "select 1\nfrom accounts")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(diff, "-from users") || !strings.Contains(diff, "+from accounts") {
		t.Fatalf("unexpected diff: %s", diff)
	}
}

func TestCompareQueriesEmpty(t *testing.T) {
	svc := NewQueryCompareService()
	_, err := svc.CompareQueries(" ", "\n")
	if err == nil {
		t.Fatalf("expected error for empty inputs")
	}
}
