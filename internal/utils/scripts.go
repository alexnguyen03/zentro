package utils

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"zentro/internal/models"
)

// slugify converts a connection name into a safe directory name.
// E.g. "My Postgres!" → "my-postgres"
func slugify(s string) string {
	s = strings.ToLower(s)
	re := regexp.MustCompile(`[^a-z0-9]+`)
	s = re.ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	if s == "" {
		return "default"
	}
	return s
}

// scriptDir returns and ensures the per-connection script directory exists.
// Path: ~/.config/zentro/scripts/<slug>/
func scriptDir(connectionName string) (string, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("scripts: config dir: %w", err)
	}
	dir := filepath.Join(base, "zentro", "scripts", slugify(connectionName))
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", fmt.Errorf("scripts: mkdir: %w", err)
	}
	return dir, nil
}

// indexPath returns the path to index.json inside the connection script dir.
func indexPath(dir string) string {
	return filepath.Join(dir, "index.json")
}

// loadIndex reads all script metadata for a connection.
// Returns empty slice (not error) if file doesn't exist.
func loadIndex(dir string) ([]models.SavedScript, error) {
	p := indexPath(dir)
	data, err := os.ReadFile(p)
	if err != nil {
		if os.IsNotExist(err) {
			return []models.SavedScript{}, nil
		}
		return nil, fmt.Errorf("scripts: read index: %w", err)
	}
	var entries []models.SavedScript
	if err := json.Unmarshal(data, &entries); err != nil {
		// Corrupted index — return empty list, don't crash.
		return []models.SavedScript{}, nil
	}
	return entries, nil
}

// saveIndex writes script metadata atomically.
func saveIndex(dir string, entries []models.SavedScript) error {
	data, err := json.MarshalIndent(entries, "", "  ")
	if err != nil {
		return fmt.Errorf("scripts: marshal index: %w", err)
	}
	p := indexPath(dir)
	tmp := p + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return fmt.Errorf("scripts: write index: %w", err)
	}
	return os.Rename(tmp, p)
}

// LoadScripts returns all saved script metadata for a connection.
// Content (SQL) is NOT loaded here — only metadata from index.json.
func LoadScripts(connectionName string) ([]models.SavedScript, error) {
	dir, err := scriptDir(connectionName)
	if err != nil {
		return nil, err
	}
	return loadIndex(dir)
}

// GetScriptContent reads the SQL content of a single script file.
func GetScriptContent(connectionName, scriptID string) (string, error) {
	dir, err := scriptDir(connectionName)
	if err != nil {
		return "", err
	}
	p := filepath.Join(dir, scriptID+".sql")
	data, err := os.ReadFile(p)
	if err != nil {
		return "", fmt.Errorf("scripts: read sql file: %w", err)
	}
	return string(data), nil
}

// SaveScript writes the .sql file and upserts the metadata in index.json.
func SaveScript(script models.SavedScript, content string) error {
	dir, err := scriptDir(script.ConnectionName)
	if err != nil {
		return err
	}

	// Write .sql file
	sqlPath := filepath.Join(dir, script.ID+".sql")
	if err := os.WriteFile(sqlPath, []byte(content), 0o644); err != nil {
		return fmt.Errorf("scripts: write sql: %w", err)
	}

	// Upsert index
	entries, _ := loadIndex(dir)
	found := false
	for i, e := range entries {
		if e.ID == script.ID {
			entries[i] = script
			found = true
			break
		}
	}
	if !found {
		entries = append(entries, script)
	}
	return saveIndex(dir, entries)
}

// DeleteScript removes the .sql file and its entry from index.json.
func DeleteScript(connectionName, scriptID string) error {
	dir, err := scriptDir(connectionName)
	if err != nil {
		return err
	}

	// Remove sql file (ignore not-found)
	sqlPath := filepath.Join(dir, scriptID+".sql")
	if err := os.Remove(sqlPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("scripts: remove sql: %w", err)
	}

	// Update index
	entries, _ := loadIndex(dir)
	filtered := entries[:0]
	for _, e := range entries {
		if e.ID != scriptID {
			filtered = append(filtered, e)
		}
	}
	return saveIndex(dir, filtered)
}
