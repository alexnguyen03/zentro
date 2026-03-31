// Package utils provides config persistence and logging helpers.
// Pattern: Facade — hides file I/O details from callers.
// No dependency on fyne or any UI framework.
package utils

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"zentro/internal/models"
)

// Preferences holds all user-configurable settings.
type ShortcutRule struct {
	ID        string `json:"id"`
	CommandID string `json:"command_id"`
	Binding   string `json:"binding"`
	When      string `json:"when"`
	Source    string `json:"source"`
	Order     int    `json:"order"`
}

type Preferences struct {
	Theme            string            `json:"theme"`              // "light" | "dark" | "system"
	FontSize         int               `json:"font_size"`          // default 14
	DefaultLimit     int               `json:"default_limit"`      // default 1000
	ChunkSize        int               `json:"chunk_size"`         // default 500
	ToastPlacement   string            `json:"toast_placement"`    // default bottom-left
	QueryTimeout     int               `json:"query_timeout"`      // seconds, default 60
	ConnectTimeout   int               `json:"connect_timeout"`    // seconds, default 10
	SchemaTimeout    int               `json:"schema_timeout"`     // seconds, default 15
	AutoCheckUpdates bool              `json:"auto_check_updates"` // default true
	ViewMode         bool              `json:"view_mode"`          // default false (read-only DB mode)
	Shortcuts        map[string]string `json:"shortcuts"`
	ShortcutRules    []ShortcutRule    `json:"shortcut_rules"`
}

// config is the root JSON structure written to disk.
type config struct {
	Preferences Preferences                 `json:"preferences"`
	Connections []*models.ConnectionProfile `json:"connections"`
}

// configPath returns the path to zentro's config file.
// Creates the directory if it doesn't exist.
func configPath() (string, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("prefs: config dir: %w", err)
	}
	dir := filepath.Join(base, "zentro")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", fmt.Errorf("prefs: mkdir: %w", err)
	}
	return filepath.Join(dir, "config.json"), nil
}

// loadConfig reads and parses the config file.
// Returns a default config if the file doesn't exist.
// Legacy encrypted config files are still supported for backward compatibility.
func loadConfig() (*config, error) {
	path, err := configPath()
	if err != nil {
		return defaultConfig(), err
	}
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return defaultConfig(), nil
	}
	if err != nil {
		return defaultConfig(), fmt.Errorf("prefs: read: %w", err)
	}

	needsEncryptMigration := false
	needsPasswordMigration := false

	// Try to decrypt first for backward compatibility with legacy encrypted config files.
	plaintext, decryptErr := decryptConfig(data)
	if decryptErr == nil {
		data = plaintext
	} else {
		needsEncryptMigration = true
	}

	var cfg config
	if err := json.Unmarshal(data, &cfg); err != nil {
		// If both encrypted and plaintext fail, return default
		return defaultConfig(), fmt.Errorf("prefs: unmarshal: %w", err)
	}
	// Apply defaults for zero values
	if cfg.Preferences.DefaultLimit == 0 {
		cfg.Preferences.DefaultLimit = 1000
	}
	if cfg.Preferences.ChunkSize == 0 {
		cfg.Preferences.ChunkSize = 500
	}
	if cfg.Preferences.FontSize == 0 {
		cfg.Preferences.FontSize = 14
	}
	if cfg.Preferences.Theme == "" {
		cfg.Preferences.Theme = "system"
	}
	if cfg.Preferences.ToastPlacement == "" {
		cfg.Preferences.ToastPlacement = "bottom-left"
	}
	if cfg.Preferences.QueryTimeout == 0 {
		cfg.Preferences.QueryTimeout = 60
	} else if cfg.Preferences.QueryTimeout > 1000000 {
		cfg.Preferences.QueryTimeout /= int(time.Second)
	}

	if cfg.Preferences.ConnectTimeout == 0 {
		cfg.Preferences.ConnectTimeout = 10
	} else if cfg.Preferences.ConnectTimeout > 1000000 {
		cfg.Preferences.ConnectTimeout /= int(time.Second)
	}

	if cfg.Preferences.SchemaTimeout == 0 {
		cfg.Preferences.SchemaTimeout = 15
	} else if cfg.Preferences.SchemaTimeout > 1000000 {
		cfg.Preferences.SchemaTimeout /= int(time.Second)
	}
	if cfg.Preferences.Shortcuts == nil {
		cfg.Preferences.Shortcuts = map[string]string{}
	}
	if cfg.Preferences.ShortcutRules == nil {
		cfg.Preferences.ShortcutRules = []ShortcutRule{}
	}
	// Load passwords from keyring or migrate legacy base64 values.
	for _, p := range cfg.Connections {
		if p.SavePassword && !p.EncryptPassword {
			p.EncryptPassword = true
			needsPasswordMigration = true
		}
		if p.SavePassword {
			// First try keyring
			keyringPw, err := GetPassword(p.Name)
			if err == nil && keyringPw != "" {
				p.Password = keyringPw
			} else if keyringPw == "" && p.Password != "" {
				// Fall back to base64 (legacy), then migrate.
				if b, err := base64.StdEncoding.DecodeString(p.Password); err == nil {
					p.Password = string(b)
					needsPasswordMigration = true
				}
			}
		} else {
			p.Password = ""
		}
	}

	if needsEncryptMigration || needsPasswordMigration {
		if err := saveConfig(&cfg); err != nil {
			// Migration is best-effort. The config was already loaded successfully,
			// so callers should keep working even if a concurrent writer temporarily
			// prevents rewriting the file in the new format.
			return &cfg, nil
		}
	}

	return &cfg, nil
}

// saveConfig writes the config to disk atomically.
// Passwords are stored in OS keyring, not in the config file.
// The config file itself is intentionally stored as plaintext JSON so it remains human-readable.
func saveConfig(cfg *config) error {
	path, err := configPath()
	if err != nil {
		return err
	}
	// Store passwords in keyring and create config without actual passwords
	encoded := make([]*models.ConnectionProfile, len(cfg.Connections))
	for i, p := range cfg.Connections {
		cp := *p
		if cp.SavePassword && cp.Password != "" {
			if !cp.EncryptPassword {
				cp.EncryptPassword = true
			}
			// Store in keyring
			if err := StorePassword(cp.Name, cp.Password); err != nil {
				return fmt.Errorf("keyring store: %w", err)
			}
			// Don't store actual password in config
			cp.Password = ""
		} else {
			cp.Password = ""
			cp.EncryptPassword = false
			if cp.Name != "" {
				if err := DeletePassword(cp.Name); err != nil {
					return fmt.Errorf("keyring delete: %w", err)
				}
			}
		}
		encoded[i] = &cp
	}
	out := config{Preferences: cfg.Preferences, Connections: encoded}
	data, err := json.MarshalIndent(out, "", "  ")
	if err != nil {
		return fmt.Errorf("prefs: marshal: %w", err)
	}
	data = append(data, '\n')

	// Write to a unique temp file in the same directory, then rename for atomicity.
	tmpFile, err := os.CreateTemp(filepath.Dir(path), "config.json.*.tmp")
	if err != nil {
		return fmt.Errorf("prefs: write: %w", err)
	}
	tmp := tmpFile.Name()
	defer func() {
		_ = os.Remove(tmp)
	}()

	if _, err := tmpFile.Write(data); err != nil {
		_ = tmpFile.Close()
		return fmt.Errorf("prefs: write: %w", err)
	}
	if err := tmpFile.Close(); err != nil {
		return fmt.Errorf("prefs: write: %w", err)
	}

	return os.Rename(tmp, path)
}

func defaultConfig() *config {
	return &config{
		Preferences: Preferences{
			Theme:            "system",
			FontSize:         14,
			DefaultLimit:     1000,
			ChunkSize:        500,
			ToastPlacement:   "bottom-left",
			QueryTimeout:     60,
			ConnectTimeout:   10,
			SchemaTimeout:    15,
			AutoCheckUpdates: true,
			ViewMode:         false,
			Shortcuts:        map[string]string{},
			ShortcutRules:    []ShortcutRule{},
		},
		Connections: []*models.ConnectionProfile{},
	}
}

// --- Public API ---

// LoadPreferences reads preferences from disk.
func LoadPreferences() (Preferences, error) {
	cfg, err := loadConfig()
	return cfg.Preferences, err
}

// SavePreferences writes preferences to disk.
func SavePreferences(p Preferences) error {
	cfg, _ := loadConfig()
	cfg.Preferences = p
	return saveConfig(cfg)
}

// LoadConnections reads all connection profiles from disk.
func LoadConnections() ([]*models.ConnectionProfile, error) {
	cfg, err := loadConfig()
	return cfg.Connections, err
}

// SaveConnections writes the full list of connection profiles to disk.
func SaveConnections(profiles []*models.ConnectionProfile) error {
	cfg, _ := loadConfig()
	cfg.Connections = profiles
	return saveConfig(cfg)
}

// DeleteConnection removes the profile by name.
func DeleteConnection(name string) error {
	cfg, err := loadConfig()
	if err != nil {
		return err
	}
	filtered := cfg.Connections[:0]
	for _, p := range cfg.Connections {
		if p.Name != name {
			filtered = append(filtered, p)
		}
	}
	// Also delete password from keyring
	if err := DeletePassword(name); err != nil {
		return fmt.Errorf("keyring delete: %w", err)
	}
	cfg.Connections = filtered
	return saveConfig(cfg)
}
