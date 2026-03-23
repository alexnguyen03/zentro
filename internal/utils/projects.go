package utils

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"

	"zentro/internal/models"
)

type projectRegistry struct {
	Projects []*models.Project `json:"projects"`
}

func projectsPath() (string, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("projects: config dir: %w", err)
	}
	dir := filepath.Join(base, "zentro")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", fmt.Errorf("projects: mkdir: %w", err)
	}
	return filepath.Join(dir, "projects.json"), nil
}

func loadProjectRegistry() (*projectRegistry, error) {
	path, err := projectsPath()
	if err != nil {
		return &projectRegistry{Projects: []*models.Project{}}, err
	}

	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return &projectRegistry{Projects: []*models.Project{}}, nil
	}
	if err != nil {
		return &projectRegistry{Projects: []*models.Project{}}, fmt.Errorf("projects: read: %w", err)
	}

	var registry projectRegistry
	if err := json.Unmarshal(data, &registry); err != nil {
		return &projectRegistry{Projects: []*models.Project{}}, fmt.Errorf("projects: unmarshal: %w", err)
	}
	if registry.Projects == nil {
		registry.Projects = []*models.Project{}
	}

	for _, project := range registry.Projects {
		normalizeProject(project)
		loadProjectConnectionSecrets(project)
	}

	return &registry, nil
}

func saveProjectRegistry(registry *projectRegistry) error {
	path, err := projectsPath()
	if err != nil {
		return err
	}

	existing, _ := loadProjectRegistry()
	existingSecrets := collectProjectConnectionSecretKeys(existing.Projects)
	nextSecrets := make(map[string]bool)

	sanitizedProjects := make([]*models.Project, 0, len(registry.Projects))
	for _, project := range registry.Projects {
		cp := cloneProject(project)
		normalizeProject(cp)
		storeProjectConnectionSecrets(cp)
		for _, connection := range cp.Connections {
			nextSecrets[projectConnectionSecretKey(connection.ID)] = true
		}
		sanitizedProjects = append(sanitizedProjects, cp)
	}

	for secretKey := range existingSecrets {
		if !nextSecrets[secretKey] {
			_ = DeletePassword(secretKey)
		}
	}

	data, err := json.MarshalIndent(projectRegistry{Projects: sanitizedProjects}, "", "  ")
	if err != nil {
		return fmt.Errorf("projects: marshal: %w", err)
	}

	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return fmt.Errorf("projects: write: %w", err)
	}
	return os.Rename(tmp, path)
}

func LoadProjects() ([]*models.Project, error) {
	registry, err := loadProjectRegistry()
	return registry.Projects, err
}

func SaveProjects(projects []*models.Project) error {
	return saveProjectRegistry(&projectRegistry{Projects: projects})
}

func LoadProject(projectID string) (*models.Project, error) {
	registry, err := loadProjectRegistry()
	if err != nil {
		return nil, err
	}
	for _, project := range registry.Projects {
		if project.ID == projectID {
			return project, nil
		}
	}
	return nil, fmt.Errorf("project %q not found", projectID)
}

func UpsertProject(project *models.Project) error {
	registry, err := loadProjectRegistry()
	if err != nil {
		return err
	}

	updated := false
	for i, existing := range registry.Projects {
		if existing.ID == project.ID {
			registry.Projects[i] = project
			updated = true
			break
		}
	}
	if !updated {
		registry.Projects = append(registry.Projects, project)
	}

	return saveProjectRegistry(registry)
}

func DeleteProject(projectID string) error {
	registry, err := loadProjectRegistry()
	if err != nil {
		return err
	}

	filtered := registry.Projects[:0]
	for _, project := range registry.Projects {
		if project.ID == projectID {
			for _, connection := range project.Connections {
				if connection.ID != "" {
					_ = DeletePassword(projectConnectionSecretKey(connection.ID))
				}
			}
			continue
		}
		filtered = append(filtered, project)
	}
	registry.Projects = filtered
	return saveProjectRegistry(registry)
}

func normalizeProject(project *models.Project) {
	if project == nil {
		return
	}

	now := time.Now().UTC().Format(time.RFC3339)
	if project.ID == "" {
		project.ID = models.NewProject(project.Name).ID
	}
	if project.Slug == "" {
		project.Slug = models.Slugify(project.Name)
	}
	if project.CreatedAt == "" {
		project.CreatedAt = now
	}
	if project.UpdatedAt == "" {
		project.UpdatedAt = now
	}
	if project.DefaultEnvironmentKey == "" {
		project.DefaultEnvironmentKey = models.EnvironmentLocal
	}
	if project.Tags == nil {
		project.Tags = []string{}
	}

	if len(project.Environments) == 0 {
		project.Environments = []models.ProjectEnvironment{
			models.NewProjectEnvironment(project.ID, project.DefaultEnvironmentKey),
		}
	}
	for i := range project.Environments {
		env := &project.Environments[i]
		if env.ID == "" {
			env.ID = models.NewProjectEnvironment(project.ID, env.Key).ID
		}
		env.ProjectID = project.ID
		if env.Key == "" {
			env.Key = project.DefaultEnvironmentKey
		}
		if env.Label == "" {
			env.Label = models.DefaultEnvironmentLabel(env.Key)
		}
		if env.BadgeColor == "" {
			env.BadgeColor = models.DefaultEnvironmentColor(env.Key)
		}
		if env.Key == models.EnvironmentProduction {
			env.IsProtected = true
		}
	}

	for i := range project.Connections {
		conn := &project.Connections[i]
		if conn.ID == "" {
			conn.ID = uuid.NewString()
		}
		conn.ProjectID = project.ID
		if conn.AdvancedMeta == nil {
			conn.AdvancedMeta = map[string]string{}
		}
	}

	if project.Workspaces == nil {
		project.Workspaces = []models.Workspace{}
	}
	if len(project.Workspaces) == 0 {
		workspace := models.NewWorkspace(project.ID, project.DefaultEnvironmentKey, "Workspace", models.WorkspaceScratch)
		project.Workspaces = []models.Workspace{workspace}
		project.LastWorkspaceID = workspace.ID
	}
	for i := range project.Workspaces {
		workspace := &project.Workspaces[i]
		if workspace.ID == "" {
			workspace.ID = models.NewWorkspace(project.ID, workspace.EnvironmentKey, workspace.Name, workspace.Type).ID
		}
		workspace.ProjectID = project.ID
		if workspace.EnvironmentKey == "" {
			workspace.EnvironmentKey = project.DefaultEnvironmentKey
		}
		if workspace.Name == "" {
			workspace.Name = "Workspace"
		}
		if workspace.Type == "" {
			workspace.Type = models.WorkspaceScratch
		}
		if workspace.LastOpenedAt == "" {
			workspace.LastOpenedAt = now
		}
	}

	if project.LastWorkspaceID == "" && len(project.Workspaces) > 0 {
		project.LastWorkspaceID = project.Workspaces[0].ID
	}

	if project.Assets == nil {
		project.Assets = []models.ProjectAsset{}
	}
	for i := range project.Assets {
		asset := &project.Assets[i]
		if asset.ID == "" {
			asset.ID = uuid.NewString()
		}
		asset.ProjectID = project.ID
		if asset.CreatedAt == "" {
			asset.CreatedAt = now
		}
		if asset.UpdatedAt == "" {
			asset.UpdatedAt = now
		}
		if asset.Tags == nil {
			asset.Tags = []string{}
		}
	}

	for i := range project.Environments {
		env := &project.Environments[i]
		if env.ConnectionID == "" {
			for _, connection := range project.Connections {
				if connection.EnvironmentKey == env.Key {
					env.ConnectionID = connection.ID
					break
				}
			}
		}
	}
}

func projectConnectionSecretKey(connectionID string) string {
	return "project-connection:" + connectionID
}

func loadProjectConnectionSecrets(project *models.Project) {
	for i := range project.Connections {
		connection := &project.Connections[i]
		if !connection.SavePassword || connection.ID == "" {
			connection.Password = ""
			continue
		}
		password, err := GetPassword(projectConnectionSecretKey(connection.ID))
		if err == nil {
			connection.Password = password
		}
	}
}

func storeProjectConnectionSecrets(project *models.Project) {
	for i := range project.Connections {
		connection := &project.Connections[i]
		if connection.ID == "" {
			continue
		}
		secretKey := projectConnectionSecretKey(connection.ID)
		if connection.SavePassword && connection.Password != "" {
			_ = StorePassword(secretKey, connection.Password)
		} else {
			_ = DeletePassword(secretKey)
		}
		connection.Password = ""
	}
}

func collectProjectConnectionSecretKeys(projects []*models.Project) map[string]bool {
	keys := make(map[string]bool)
	for _, project := range projects {
		for _, connection := range project.Connections {
			if connection.ID != "" {
				keys[projectConnectionSecretKey(connection.ID)] = true
			}
		}
	}
	return keys
}

func cloneProject(project *models.Project) *models.Project {
	if project == nil {
		return nil
	}

	raw, _ := json.Marshal(project)
	var copy models.Project
	_ = json.Unmarshal(raw, &copy)
	return &copy
}
