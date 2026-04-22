package db

import (
	"errors"
	"strings"
	"testing"

	"zentro/internal/models"
)

const unknownDriver = "__nonexistent_driver__"

func TestOpenConnection_UnknownDriver(t *testing.T) {
	_, err := OpenConnection(&models.ConnectionProfile{Driver: unknownDriver})
	if err == nil {
		t.Fatal("expected error for unknown driver")
	}
	if !strings.Contains(err.Error(), "unsupported driver") {
		t.Errorf("unexpected error message: %v", err)
	}
}

func TestTestConnection_UnknownDriver(t *testing.T) {
	err := TestConnection(&models.ConnectionProfile{Driver: unknownDriver})
	if err == nil {
		t.Fatal("expected error for unknown driver")
	}
}

func TestFriendlyError_NilInput(t *testing.T) {
	if err := FriendlyError(unknownDriver, nil); err != nil {
		t.Errorf("expected nil for nil input, got %v", err)
	}
}

func TestFriendlyError_UnknownDriver(t *testing.T) {
	raw := errors.New("connection refused")
	err := FriendlyError(unknownDriver, raw)
	if err == nil {
		t.Fatal("expected non-nil error")
	}
	if !strings.Contains(err.Error(), "connection error") {
		t.Errorf("unexpected error message: %v", err)
	}
}
