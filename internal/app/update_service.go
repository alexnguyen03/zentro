package app

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// UpdateInfo contains information about the latest release.
type UpdateInfo struct {
	LatestVersion string `json:"latest_version"`
	ReleaseURL    string `json:"release_url"`
	Changelog     string `json:"changelog"`
	HasUpdate     bool   `json:"has_update"`
}

// UpdateService handles checking for new versions via GitHub API.
type UpdateService struct {
	repoURL string
}

func NewUpdateService(repoURL string) *UpdateService {
	return &UpdateService{repoURL: repoURL}
}

// CheckForUpdates fetches the latest release from GitHub and compares versions.
func (s *UpdateService) CheckForUpdates(currentVersion string) (*UpdateInfo, error) {
	apiURL := fmt.Sprintf("https://api.github.com/repos/%s/releases/latest", s.repoURL)
	
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(apiURL)
	if err != nil {
		return nil, fmt.Errorf("failed to check for updates: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("github api returned status: %d", resp.StatusCode)
	}

	var release struct {
		TagName string `json:"tag_name"`
		HTMLURL string `json:"html_url"`
		Body    string `json:"body"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return nil, fmt.Errorf("failed to parse release info: %w", err)
	}

	latest := strings.TrimPrefix(release.TagName, "v")
	current := strings.TrimPrefix(currentVersion, "v")

	hasUpdate := isNewer(current, latest)

	return &UpdateInfo{
		LatestVersion: latest,
		ReleaseURL:    release.HTMLURL,
		Changelog:     release.Body,
		HasUpdate:     hasUpdate,
	}, nil
}

// isNewer is a simple semver comparison.
// Returns true if latest > current.
func isNewer(current, latest string) bool {
	if current == latest || latest == "" {
		return false
	}
	// Simple string comparison for now as tags are usually v0.1.0 etc.
	// For production quality, we could use a semver library if versions get complex.
	return latest > current
}
