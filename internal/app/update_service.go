package app

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
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
	client  *http.Client
}

func NewUpdateService(repoURL string) *UpdateService {
	return &UpdateService{
		repoURL: repoURL,
		client:  &http.Client{Timeout: 10 * time.Second},
	}
}

// CheckForUpdates fetches the latest release from GitHub and compares versions.
func (s *UpdateService) CheckForUpdates(currentVersion string) (*UpdateInfo, error) {
	repoPath, err := normalizeGitHubRepoPath(s.repoURL)
	if err != nil {
		return nil, fmt.Errorf("invalid repository value %q: %w", s.repoURL, err)
	}

	releaseAPIURL := fmt.Sprintf("https://api.github.com/repos/%s/releases/latest", repoPath)
	log.Printf("[UpdateService] checking latest release via GitHub API: %s", releaseAPIURL)

	release, statusCode, err := s.fetchLatestRelease(releaseAPIURL, repoPath)
	if err != nil {
		// GitHub returns 404 for repos that have tags but no Release object.
		if statusCode == http.StatusNotFound {
			log.Printf("[UpdateService] no /releases/latest found for %s; falling back to /tags", repoPath)
			return s.checkByLatestTag(repoPath, currentVersion)
		}
		return nil, fmt.Errorf("failed to check for updates: %w", err)
	}

	log.Printf("[UpdateService] latest release url: %s (tag: %s)", release.HTMLURL, release.TagName)
	return buildUpdateInfo(currentVersion, release.TagName, release.HTMLURL, release.Body), nil
}

type githubRelease struct {
	TagName string `json:"tag_name"`
	HTMLURL string `json:"html_url"`
	Body    string `json:"body"`
}

type githubTag struct {
	Name string `json:"name"`
}

func normalizeGitHubRepoPath(repoURL string) (string, error) {
	value := strings.TrimSpace(repoURL)
	if value == "" {
		return "", fmt.Errorf("empty repository")
	}

	// Handle direct owner/repo form.
	if !strings.Contains(value, "://") && !strings.HasPrefix(value, "github.com/") {
		trimmed := strings.Trim(value, "/")
		parts := strings.Split(trimmed, "/")
		if len(parts) >= 2 && parts[0] != "" && parts[1] != "" {
			return strings.TrimSuffix(parts[0]+"/"+parts[1], ".git"), nil
		}
		return "", fmt.Errorf("expected owner/repo")
	}

	if strings.HasPrefix(value, "github.com/") {
		value = "https://" + value
	}

	u, err := url.Parse(value)
	if err != nil {
		return "", fmt.Errorf("parse github url: %w", err)
	}
	if !strings.EqualFold(u.Host, "github.com") {
		return "", fmt.Errorf("unsupported host %q", u.Host)
	}

	path := strings.Trim(u.Path, "/")
	parts := strings.Split(path, "/")
	if len(parts) < 2 || parts[0] == "" || parts[1] == "" {
		return "", fmt.Errorf("expected github.com/owner/repo")
	}
	return strings.TrimSuffix(parts[0]+"/"+parts[1], ".git"), nil
}

func buildUpdateInfo(currentVersion, tagName, releaseURL, changelog string) *UpdateInfo {
	latest := strings.TrimPrefix(tagName, "v")
	current := strings.TrimPrefix(currentVersion, "v")
	return &UpdateInfo{
		LatestVersion: latest,
		ReleaseURL:    releaseURL,
		Changelog:     changelog,
		HasUpdate:     isNewer(current, latest),
	}
}

func (s *UpdateService) fetchLatestRelease(apiURL, repoPath string) (*githubRelease, int, error) {
	resp, status, err := s.doGitHubGET(apiURL)
	if err != nil {
		return nil, status, err
	}
	defer resp.Body.Close()

	var release githubRelease
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return nil, status, fmt.Errorf("failed to parse release info: %w", err)
	}
	if strings.TrimSpace(release.TagName) == "" {
		return nil, status, fmt.Errorf("latest release response missing tag_name")
	}
	if strings.TrimSpace(release.HTMLURL) == "" {
		release.HTMLURL = fmt.Sprintf("https://github.com/%s/releases/tag/%s", repoPath, release.TagName)
	}
	return &release, status, nil
}

func (s *UpdateService) checkByLatestTag(repoPath, currentVersion string) (*UpdateInfo, error) {
	tagsURL := fmt.Sprintf("https://api.github.com/repos/%s/tags?per_page=1", repoPath)
	log.Printf("[UpdateService] checking latest tag via GitHub API: %s", tagsURL)

	resp, _, err := s.doGitHubGET(tagsURL)
	if err != nil {
		return nil, fmt.Errorf("failed fallback tag check: %w", err)
	}
	defer resp.Body.Close()

	var tags []githubTag
	if err := json.NewDecoder(resp.Body).Decode(&tags); err != nil {
		return nil, fmt.Errorf("failed to parse tag info: %w", err)
	}
	if len(tags) == 0 || strings.TrimSpace(tags[0].Name) == "" {
		return nil, fmt.Errorf("no releases or tags found in repository %s", repoPath)
	}

	tagName := strings.TrimSpace(tags[0].Name)
	releaseURL := fmt.Sprintf("https://github.com/%s/releases/tag/%s", repoPath, tagName)
	log.Printf("[UpdateService] latest tag fallback url: %s (tag: %s)", releaseURL, tagName)

	return buildUpdateInfo(currentVersion, tagName, releaseURL, ""), nil
}

func (s *UpdateService) doGitHubGET(apiURL string) (*http.Response, int, error) {
	req, err := http.NewRequest(http.MethodGet, apiURL, nil)
	if err != nil {
		return nil, 0, fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "zentro-update-checker")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("request github api: %w", err)
	}
	if resp.StatusCode == http.StatusOK {
		return resp, resp.StatusCode, nil
	}

	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
	return nil, resp.StatusCode, fmt.Errorf(
		"github api returned status %d for %s: %s",
		resp.StatusCode,
		apiURL,
		strings.TrimSpace(string(body)),
	)
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
