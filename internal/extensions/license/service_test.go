package license

import "testing"

func TestLicenseServiceActivateAndRefresh(t *testing.T) {
	service := NewLicenseService(nil)
	state, err := service.ActivateLicense("ABC-1234", "device-1")
	if err != nil {
		t.Fatalf("activate failed: %v", err)
	}
	if state.Status != StatusActive {
		t.Fatalf("expected active status, got %s", state.Status)
	}
	if state.MaskedKey == "" {
		t.Fatal("expected masked key")
	}

	refreshed, err := service.RefreshLicense(state.SessionToken)
	if err != nil {
		t.Fatalf("refresh failed: %v", err)
	}
	if refreshed.Status != StatusActive {
		t.Fatalf("expected active after refresh, got %s", refreshed.Status)
	}
}

func TestLicenseServiceDeactivate(t *testing.T) {
	service := NewLicenseService(nil)
	_, _ = service.ActivateLicense("ABC-1234", "device-1")
	if err := service.DeactivateLicense("test"); err != nil {
		t.Fatalf("deactivate failed: %v", err)
	}
	state, err := service.GetLicenseState()
	if err != nil {
		t.Fatalf("get state failed: %v", err)
	}
	if state.Status != StatusInactive {
		t.Fatalf("expected inactive, got %s", state.Status)
	}
}
