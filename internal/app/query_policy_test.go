package app

import "testing"

func TestGetExecutionPolicy(t *testing.T) {
	a := NewApp()
	a.prefs.QueryTimeout = 45

	dev := a.GetExecutionPolicy("dev")
	if dev.EnvironmentStrictness != "normal" {
		t.Fatalf("expected normal strictness for dev, got %s", dev.EnvironmentStrictness)
	}
	if dev.TimeoutSeconds != 45 {
		t.Fatalf("expected timeout 45, got %d", dev.TimeoutSeconds)
	}

	prod := a.GetExecutionPolicy("pro")
	if prod.EnvironmentStrictness != "strict" {
		t.Fatalf("expected strict policy for prod, got %s", prod.EnvironmentStrictness)
	}
	if prod.RowCapPerTab >= dev.RowCapPerTab {
		t.Fatalf("expected stricter row cap for prod")
	}
}
