package license

import "time"

type ActivationStatus string

const (
	StatusInactive   ActivationStatus = "inactive"
	StatusActivating ActivationStatus = "activating"
	StatusActive     ActivationStatus = "active"
	StatusExpired    ActivationStatus = "expired"
	StatusRevoked    ActivationStatus = "revoked"
	StatusError      ActivationStatus = "error"
)

type Entitlement struct {
	FeatureID string `json:"feature_id"`
	Enabled   bool   `json:"enabled"`
	Limit     int64  `json:"limit,omitempty"`
}

type Policy struct {
	RequireOnlineRefresh  bool  `json:"require_online_refresh"`
	RefreshIntervalMinute int64 `json:"refresh_interval_minute"`
}

type State struct {
	Status       ActivationStatus `json:"status"`
	MaskedKey    string           `json:"masked_key,omitempty"`
	SessionToken string           `json:"session_token,omitempty"`
	ExpiresAt    *time.Time       `json:"expires_at,omitempty"`
	Entitlements []Entitlement    `json:"entitlements"`
	Policy       Policy           `json:"policy"`
	LastError    string           `json:"last_error,omitempty"`
}

type Service interface {
	ActivateLicense(key string, deviceInfo string) (State, error)
	RefreshLicense(sessionToken string) (State, error)
	DeactivateLicense(reason string) error
	GetLicenseState() (State, error)
}

type Provider interface {
	Activate(key string, deviceInfo string) (State, error)
	Refresh(sessionToken string) (State, error)
	Deactivate(reason string) error
}
