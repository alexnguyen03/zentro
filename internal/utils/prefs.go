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

	"zentro/internal/models"
)

// Preferences holds all user-configurable settings.
type Preferences struct {
	Theme        string `json:"theme"`         // "light" | "dark" | "system"
	FontSize     int    `json:"font_size"`     // default 14
	DefaultLimit int    `json:"default_limit"` // default 1000
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
	var cfg config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return defaultConfig(), fmt.Errorf("prefs: unmarshal: %w", err)
	}
	// Apply defaults for zero values
	if cfg.Preferences.DefaultLimit == 0 {
		cfg.Preferences.DefaultLimit = 1000
	}
	if cfg.Preferences.FontSize == 0 {
		cfg.Preferences.FontSize = 14
	}
	if cfg.Preferences.Theme == "" {
		cfg.Preferences.Theme = "system"
	}
	// Decode passwords
	for _, p := range cfg.Connections {
		if p.SavePassword && p.Password != "" {
			if b, err := base64.StdEncoding.DecodeString(p.Password); err == nil {
				p.Password = string(b)
			}
		}
	}
	return &cfg, nil
}

// saveConfig writes the config to disk atomically.
func saveConfig(cfg *config) error {
	path, err := configPath()
	if err != nil {
		return err
	}
	// Deep copy connections to encode passwords without mutating originals
	encoded := make([]*models.ConnectionProfile, len(cfg.Connections))
	for i, p := range cfg.Connections {
		cp := *p
		if cp.SavePassword && cp.Password != "" {
			cp.Password = base64.StdEncoding.EncodeToString([]byte(cp.Password))
		} else {
			cp.Password = ""
		}
		encoded[i] = &cp
	}
	out := config{Preferences: cfg.Preferences, Connections: encoded}
	data, err := json.MarshalIndent(out, "", "  ")
	if err != nil {
		return fmt.Errorf("prefs: marshal: %w", err)
	}
	// Write to temp file then rename for atomicity
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return fmt.Errorf("prefs: write: %w", err)
	}
	return os.Rename(tmp, path)
}

func defaultConfig() *config {
	return &config{
		Preferences: Preferences{Theme: "system", FontSize: 14, DefaultLimit: 1000},
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

// DeleteConnection removes the profile with the given name.
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
	cfg.Connections = filtered
	return saveConfig(cfg)
}
