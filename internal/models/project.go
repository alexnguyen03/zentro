package models

import (
	"strings"
	"time"

	"github.com/google/uuid"
)

type EnvironmentKey string

const (
	EnvironmentLocal       EnvironmentKey = "loc"
	EnvironmentTesting     EnvironmentKey = "tes"
	EnvironmentDevelopment EnvironmentKey = "dev"
	EnvironmentStaging     EnvironmentKey = "sta"
	EnvironmentProduction  EnvironmentKey = "pro"
)

var defaultEnvironmentLabels = map[EnvironmentKey]string{
	EnvironmentLocal:       "Local",
	EnvironmentTesting:     "Testing",
	EnvironmentDevelopment: "Development",
	EnvironmentStaging:     "Staging",
	EnvironmentProduction:  "Production",
}

var defaultEnvironmentColors = map[EnvironmentKey]string{
	EnvironmentLocal:       "green",
	EnvironmentTesting:     "purple",
	EnvironmentDevelopment: "blue",
	EnvironmentStaging:     "yellow",
	EnvironmentProduction:  "red",
}

type AssetType string

const (
	AssetSavedQuery     AssetType = "saved_query"
	AssetTemplate       AssetType = "template"
	AssetFavoriteObject AssetType = "favorite_object"
	AssetResultSnapshot AssetType = "result_snapshot"
)

type Project struct {
	ID                    string               `json:"id"`
	Slug                  string               `json:"slug"`
	Name                  string               `json:"name"`
	Description           string               `json:"description,omitempty"`
	StoragePath           string               `json:"storage_path,omitempty"`
	Tags                  []string             `json:"tags,omitempty"`
	CreatedAt             string               `json:"created_at"`
	UpdatedAt             string               `json:"updated_at"`
	DefaultEnvironmentKey EnvironmentKey       `json:"default_environment_key"`
	LayoutState           string               `json:"layout_state,omitempty"`
	Environments          []ProjectEnvironment `json:"environments,omitempty"`
	Connections           []ProjectConnection  `json:"connections,omitempty"`
	Assets                []ProjectAsset       `json:"assets,omitempty"`
	GitRepoPath           string               `json:"git_repo_path,omitempty"`
}

type ProjectEnvironment struct {
	ID           string         `json:"id"`
	ProjectID    string         `json:"project_id"`
	Key          EnvironmentKey `json:"key"`
	Label        string         `json:"label"`
	BadgeColor   string         `json:"badge_color,omitempty"`
	IsProtected  bool           `json:"is_protected"`
	IsReadOnly   bool           `json:"is_read_only"`
	LastDatabase string         `json:"last_database,omitempty"`
	LastSchema   string         `json:"last_schema,omitempty"`
	LastCatalog  string         `json:"last_catalog,omitempty"`
	ConnectionID string         `json:"connection_id,omitempty"`
}

type ProjectConnection struct {
	ID             string            `json:"id"`
	ProjectID      string            `json:"project_id"`
	EnvironmentKey EnvironmentKey    `json:"environment_key"`
	Name           string            `json:"name"`
	Driver         string            `json:"driver"`
	Version        string            `json:"version,omitempty"`
	Host           string            `json:"host,omitempty"`
	Port           int               `json:"port,omitempty"`
	Database       string            `json:"database,omitempty"`
	Username       string            `json:"username,omitempty"`
	Password       string            `json:"password,omitempty"`
	PasswordPolicy string            `json:"password_policy,omitempty"`
	SavePassword   bool              `json:"save_password"`
	SSLMode        string            `json:"ssl_mode,omitempty"`
	SocketPath     string            `json:"socket_path,omitempty"`
	UseSocket      bool              `json:"use_socket"`
	SSHEnabled     bool              `json:"ssh_enabled"`
	StatusColor    string            `json:"status_color,omitempty"`
	AdvancedMeta   map[string]string `json:"advanced_meta,omitempty"`
}

type ProjectAsset struct {
	ID          string    `json:"id"`
	ProjectID   string    `json:"project_id"`
	Type        AssetType `json:"type"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	Tags        []string  `json:"tags,omitempty"`
	CreatedAt   string    `json:"created_at"`
	UpdatedAt   string    `json:"updated_at"`
}

type ExecutionContext struct {
	ProjectID      string `json:"project_id"`
	EnvironmentKey string `json:"environment_key"`
	ConnectionID   string `json:"connection_id"`
	Database       string `json:"database,omitempty"`
	Schema         string `json:"schema,omitempty"`
	TabID          string `json:"tab_id,omitempty"`
}

func DefaultEnvironmentKeys() []EnvironmentKey {
	return []EnvironmentKey{
		EnvironmentLocal,
		EnvironmentTesting,
		EnvironmentDevelopment,
		EnvironmentStaging,
		EnvironmentProduction,
	}
}

func DefaultEnvironmentLabel(key EnvironmentKey) string {
	if label, ok := defaultEnvironmentLabels[key]; ok {
		return label
	}
	return strings.ToUpper(string(key))
}

func DefaultEnvironmentColor(key EnvironmentKey) string {
	if color, ok := defaultEnvironmentColors[key]; ok {
		return color
	}
	return "gray"
}

func NewProject(name string) *Project {
	now := time.Now().UTC().Format(time.RFC3339)
	projectID := uuid.NewString()
	project := &Project{
		ID:                    projectID,
		Slug:                  Slugify(name),
		Name:                  strings.TrimSpace(name),
		CreatedAt:             now,
		UpdatedAt:             now,
		DefaultEnvironmentKey: EnvironmentLocal,
	}
	project.Environments = []ProjectEnvironment{
		NewProjectEnvironment(projectID, EnvironmentLocal),
	}
	return project
}

func NewProjectEnvironment(projectID string, key EnvironmentKey) ProjectEnvironment {
	return ProjectEnvironment{
		ID:          uuid.NewString(),
		ProjectID:   projectID,
		Key:         key,
		Label:       DefaultEnvironmentLabel(key),
		BadgeColor:  DefaultEnvironmentColor(key),
		IsProtected: key == EnvironmentProduction,
		IsReadOnly:  false,
	}
}

func Slugify(input string) string {
	input = strings.TrimSpace(strings.ToLower(input))
	if input == "" {
		return "project"
	}

	var b strings.Builder
	lastDash := false
	for _, r := range input {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
			lastDash = false
			continue
		}
		if !lastDash {
			b.WriteByte('-')
			lastDash = true
		}
	}

	slug := strings.Trim(b.String(), "-")
	if slug == "" {
		return "project"
	}
	return slug
}
