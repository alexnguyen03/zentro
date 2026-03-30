package license

import (
	"strings"
	"sync"
	"time"
)

type MemoryProvider struct{}

func (p *MemoryProvider) Activate(key string, _ string) (State, error) {
	expiresAt := time.Now().Add(30 * 24 * time.Hour)
	return State{
		Status:       StatusActive,
		MaskedKey:    maskKey(key),
		SessionToken: "mock-session",
		ExpiresAt:    &expiresAt,
		Entitlements: []Entitlement{
			{FeatureID: "plugin.ui.commands", Enabled: true},
			{FeatureID: "plugin.data.providers", Enabled: true},
		},
		Policy: Policy{
			RequireOnlineRefresh:  true,
			RefreshIntervalMinute: 30,
		},
	}, nil
}

func (p *MemoryProvider) Refresh(sessionToken string) (State, error) {
	if strings.TrimSpace(sessionToken) == "" {
		return State{
			Status:    StatusError,
			LastError: "missing session token",
			Policy: Policy{
				RequireOnlineRefresh:  true,
				RefreshIntervalMinute: 30,
			},
		}, nil
	}

	expiresAt := time.Now().Add(30 * 24 * time.Hour)
	return State{
		Status:       StatusActive,
		SessionToken: sessionToken,
		ExpiresAt:    &expiresAt,
		Entitlements: []Entitlement{
			{FeatureID: "plugin.ui.commands", Enabled: true},
			{FeatureID: "plugin.data.providers", Enabled: true},
		},
		Policy: Policy{
			RequireOnlineRefresh:  true,
			RefreshIntervalMinute: 30,
		},
	}, nil
}

func (p *MemoryProvider) Deactivate(_ string) error {
	return nil
}

type LicenseService struct {
	mu       sync.RWMutex
	provider Provider
	state    State
}

func NewLicenseService(provider Provider) *LicenseService {
	if provider == nil {
		provider = &MemoryProvider{}
	}
	return &LicenseService{
		provider: provider,
		state: State{
			Status:       StatusInactive,
			Entitlements: []Entitlement{},
			Policy: Policy{
				RequireOnlineRefresh:  true,
				RefreshIntervalMinute: 30,
			},
		},
	}
}

func (s *LicenseService) ActivateLicense(key string, deviceInfo string) (State, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.state.Status = StatusActivating

	state, err := s.provider.Activate(key, deviceInfo)
	if err != nil {
		s.state.Status = StatusError
		s.state.LastError = err.Error()
		return s.state, err
	}
	s.state = state
	return s.state, nil
}

func (s *LicenseService) RefreshLicense(sessionToken string) (State, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.provider.Refresh(sessionToken)
	if err != nil {
		s.state.Status = StatusError
		s.state.LastError = err.Error()
		return s.state, err
	}
	s.state = state
	return s.state, nil
}

func (s *LicenseService) DeactivateLicense(reason string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.provider.Deactivate(reason); err != nil {
		s.state.Status = StatusError
		s.state.LastError = err.Error()
		return err
	}
	s.state = State{
		Status:       StatusInactive,
		Entitlements: []Entitlement{},
		Policy:       s.state.Policy,
	}
	return nil
}

func (s *LicenseService) GetLicenseState() (State, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.state, nil
}

func maskKey(value string) string {
	trimmed := strings.TrimSpace(value)
	if len(trimmed) <= 4 {
		return "****"
	}
	return strings.Repeat("*", len(trimmed)-4) + trimmed[len(trimmed)-4:]
}
