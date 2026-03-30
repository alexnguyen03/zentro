package utils

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"zentro/internal/models"
)

const (
	projectRegistryFileName = "project-index.json"
	legacyProjectsFileName  = "projects.json"
	projectManifestFileName = "project.json"
)

type projectIndexEntry struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	UpdatedAt   string `json:"updated_at"`
	CreatedAt   string `json:"created_at"`
	StoragePath string `json:"storage_path"`
}

type projectRegistry struct {
	Projects []projectIndexEntry `json:"projects"`
}

func projectConfigDir() (string, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("projects: config dir: %w", err)
	}
	dir := filepath.Join(base, "zentro")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", fmt.Errorf("projects: mkdir: %w", err)
	}
	return dir, nil
}

func projectRegistryPath() (string, error) {
	dir, err := projectConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, projectRegistryFileName), nil
}

func legacyProjectsPath() (string, error) {
	dir, err := projectConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, legacyProjectsFileName), nil
}

// DefaultProjectStorageRoot returns the runtime default root folder for project data.
func DefaultProjectStorageRoot() (string, error) {
	dir, err := projectConfigDir()
	if err != nil {
		return "", err
	}
	root := filepath.Join(dir, "projects")
	if err := os.MkdirAll(root, 0o755); err != nil {
		return "", fmt.Errorf("projects: mkdir storage root: %w", err)
	}
	return root, nil
}

func projectManifestPath(storagePath string) string {
	return filepath.Join(storagePath, projectManifestFileName)
}

func readManifestProject(path string) (*models.Project, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var project models.Project
	if err := json.Unmarshal(data, &project); err != nil {
		return nil, err
	}
	return &project, nil
}

func resolveUniqueProjectDirectory(root string, slug string, projectID string) (string, error) {
	baseSlug := strings.TrimSpace(slug)
	if baseSlug == "" {
		baseSlug = "project"
	}
	for i := 0; i < 1000; i++ {
		suffix := ""
		if i > 0 {
			suffix = "-" + strconv.Itoa(i+1)
		}
		candidate := filepath.Join(root, baseSlug+suffix)
		manifestPath := projectManifestPath(candidate)

		data, err := os.ReadFile(manifestPath)
		if os.IsNotExist(err) {
			return candidate, nil
		}
		if err != nil {
			return "", fmt.Errorf("projects: read manifest: %w", err)
		}

		var existing models.Project
		if err := json.Unmarshal(data, &existing); err != nil {
			// If manifest is corrupted, skip this candidate instead of overwriting unknown data.
			continue
		}
		if existing.ID == projectID {
			return candidate, nil
		}
	}
	return "", fmt.Errorf("projects: unable to resolve unique storage folder for %q", slug)
}

func ensureProjectStoragePath(project *models.Project) (string, error) {
	if project == nil {
		return "", fmt.Errorf("projects: nil project")
	}

	if strings.TrimSpace(project.StoragePath) != "" {
		absPath, err := filepath.Abs(strings.TrimSpace(project.StoragePath))
		if err != nil {
			return "", fmt.Errorf("projects: resolve storage path: %w", err)
		}
		if err := os.MkdirAll(absPath, 0o755); err != nil {
			return "", fmt.Errorf("projects: mkdir storage path: %w", err)
		}
		manifestPath := projectManifestPath(absPath)
		if _, err := os.Stat(manifestPath); err == nil {
			existing, err := readManifestProject(manifestPath)
			if err == nil && existing.ID != "" && existing.ID != project.ID {
				return "", fmt.Errorf("projects: storage path already belongs to another project")
			}
		}
		return absPath, nil
	}

	root, err := DefaultProjectStorageRoot()
	if err != nil {
		return "", err
	}
	candidate, err := resolveUniqueProjectDirectory(root, project.Slug, project.ID)
	if err != nil {
		return "", err
	}
	if err := os.MkdirAll(candidate, 0o755); err != nil {
		return "", fmt.Errorf("projects: mkdir candidate: %w", err)
	}
	return candidate, nil
}

func loadLegacyRegistry(path string) ([]*models.Project, error) {
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return []*models.Project{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("projects: read legacy registry: %w", err)
	}

	var legacy struct {
		Projects []*models.Project `json:"projects"`
	}
	if err := json.Unmarshal(data, &legacy); err != nil {
		return nil, fmt.Errorf("projects: unmarshal legacy registry: %w", err)
	}
	if legacy.Projects == nil {
		legacy.Projects = []*models.Project{}
	}
	return legacy.Projects, nil
}

func loadProjectRegistry() (*projectRegistry, error) {
	path, err := projectRegistryPath()
	if err != nil {
		return &projectRegistry{Projects: []projectIndexEntry{}}, err
	}

	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		legacyPath, legacyErr := legacyProjectsPath()
		if legacyErr != nil {
			return &projectRegistry{Projects: []projectIndexEntry{}}, legacyErr
		}
		legacyProjects, legacyErr := loadLegacyRegistry(legacyPath)
		if legacyErr != nil {
			return &projectRegistry{Projects: []projectIndexEntry{}}, legacyErr
		}
		if len(legacyProjects) == 0 {
			return &projectRegistry{Projects: []projectIndexEntry{}}, nil
		}

		registry := &projectRegistry{Projects: []projectIndexEntry{}}
		for _, project := range legacyProjects {
			if project == nil {
				continue
			}
			normalizeProject(project)
			storagePath, storageErr := ensureProjectStoragePath(project)
			if storageErr != nil {
				return nil, storageErr
			}
			project.StoragePath = storagePath
			if manifestErr := saveProjectManifest(project); manifestErr != nil {
				return nil, manifestErr
			}
			registry.Projects = append(registry.Projects, buildProjectIndexEntry(project))
		}
		if saveErr := saveProjectRegistry(registry); saveErr != nil {
			return nil, saveErr
		}
		return registry, nil
	}
	if err != nil {
		return &projectRegistry{Projects: []projectIndexEntry{}}, fmt.Errorf("projects: read registry: %w", err)
	}

	var registry projectRegistry
	if err := json.Unmarshal(data, &registry); err != nil {
		return &projectRegistry{Projects: []projectIndexEntry{}}, fmt.Errorf("projects: unmarshal registry: %w", err)
	}
	if registry.Projects == nil {
		registry.Projects = []projectIndexEntry{}
	}
	return &registry, nil
}

func saveProjectRegistry(registry *projectRegistry) error {
	path, err := projectRegistryPath()
	if err != nil {
		return err
	}
	if registry == nil {
		registry = &projectRegistry{Projects: []projectIndexEntry{}}
	}
	if registry.Projects == nil {
		registry.Projects = []projectIndexEntry{}
	}

	data, err := json.MarshalIndent(registry, "", "  ")
	if err != nil {
		return fmt.Errorf("projects: marshal registry: %w", err)
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return fmt.Errorf("projects: write registry: %w", err)
	}
	return os.Rename(tmp, path)
}

func buildProjectIndexEntry(project *models.Project) projectIndexEntry {
	return projectIndexEntry{
		ID:          project.ID,
		Name:        project.Name,
		Slug:        project.Slug,
		CreatedAt:   project.CreatedAt,
		UpdatedAt:   project.UpdatedAt,
		StoragePath: project.StoragePath,
	}
}

func loadProjectFromEntry(entry projectIndexEntry) (*models.Project, error) {
	manifestPath := projectManifestPath(entry.StoragePath)
	project, err := readManifestProject(manifestPath)
	if err != nil {
		return nil, fmt.Errorf("projects: read manifest for %q: %w", entry.ID, err)
	}
	normalizeProject(project)
	if project.ID == "" {
		project.ID = entry.ID
	}
	project.StoragePath = entry.StoragePath
	loadProjectConnectionSecrets(project)
	return project, nil
}

func saveProjectManifest(project *models.Project) error {
	if project == nil {
		return fmt.Errorf("projects: nil project")
	}
	if strings.TrimSpace(project.StoragePath) == "" {
		return fmt.Errorf("projects: storage path is required")
	}
	if err := os.MkdirAll(project.StoragePath, 0o755); err != nil {
		return fmt.Errorf("projects: mkdir storage path: %w", err)
	}

	copy := cloneProject(project)
	normalizeProject(copy)
	storeProjectConnectionSecrets(copy)

	data, err := json.MarshalIndent(copy, "", "  ")
	if err != nil {
		return fmt.Errorf("projects: marshal manifest: %w", err)
	}

	path := projectManifestPath(copy.StoragePath)
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return fmt.Errorf("projects: write manifest: %w", err)
	}
	return os.Rename(tmp, path)
}

func LoadProjects() ([]*models.Project, error) {
	registry, err := loadProjectRegistry()
	if err != nil {
		return []*models.Project{}, err
	}
	projects := make([]*models.Project, 0, len(registry.Projects))
	for _, entry := range registry.Projects {
		project, loadErr := loadProjectFromEntry(entry)
		if loadErr != nil {
			continue
		}
		projects = append(projects, project)
	}

	sort.SliceStable(projects, func(i, j int) bool {
		return projects[i].UpdatedAt > projects[j].UpdatedAt
	})
	return projects, nil
}

func SaveProjects(projects []*models.Project) error {
	registry, err := loadProjectRegistry()
	if err != nil {
		return err
	}

	existingByID := make(map[string]projectIndexEntry, len(registry.Projects))
	for _, entry := range registry.Projects {
		existingByID[entry.ID] = entry
	}

	nextRegistry := &projectRegistry{Projects: []projectIndexEntry{}}
	seen := make(map[string]bool)
	for _, project := range projects {
		if project == nil {
			continue
		}
		normalizeProject(project)
		storagePath, pathErr := ensureProjectStoragePath(project)
		if pathErr != nil {
			return pathErr
		}
		project.StoragePath = storagePath
		if err := saveProjectManifest(project); err != nil {
			return err
		}
		nextRegistry.Projects = append(nextRegistry.Projects, buildProjectIndexEntry(project))
		seen[project.ID] = true
	}

	for id, entry := range existingByID {
		if seen[id] {
			continue
		}
		project, loadErr := loadProjectFromEntry(entry)
		if loadErr == nil {
			for _, connection := range project.Connections {
				if connection.ID != "" {
					_ = DeletePassword(projectConnectionSecretKey(connection.ID))
				}
			}
		}
	}

	return saveProjectRegistry(nextRegistry)
}

func LoadProject(projectID string) (*models.Project, error) {
	registry, err := loadProjectRegistry()
	if err != nil {
		return nil, err
	}
	for _, entry := range registry.Projects {
		if entry.ID == projectID {
			return loadProjectFromEntry(entry)
		}
	}
	return nil, fmt.Errorf("project %q not found", projectID)
}

func UpsertProject(project *models.Project) error {
	if project == nil {
		return fmt.Errorf("project is required")
	}
	normalizeProject(project)
	storagePath, err := ensureProjectStoragePath(project)
	if err != nil {
		return err
	}
	project.StoragePath = storagePath

	if err := saveProjectManifest(project); err != nil {
		return err
	}

	registry, err := loadProjectRegistry()
	if err != nil {
		return err
	}

	entry := buildProjectIndexEntry(project)
	updated := false
	for i := range registry.Projects {
		if registry.Projects[i].ID == project.ID {
			registry.Projects[i] = entry
			updated = true
			break
		}
	}
	if !updated {
		registry.Projects = append(registry.Projects, entry)
	}
	return saveProjectRegistry(registry)
}

func DeleteProject(projectID string) error {
	registry, err := loadProjectRegistry()
	if err != nil {
		return err
	}

	filtered := make([]projectIndexEntry, 0, len(registry.Projects))
	for _, entry := range registry.Projects {
		if entry.ID == projectID {
			project, loadErr := loadProjectFromEntry(entry)
			if loadErr == nil {
				for _, connection := range project.Connections {
					if connection.ID != "" {
						_ = DeletePassword(projectConnectionSecretKey(connection.ID))
					}
				}
			}
			continue
		}
		filtered = append(filtered, entry)
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
	project.StoragePath = strings.TrimSpace(project.StoragePath)
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

func cloneProject(project *models.Project) *models.Project {
	if project == nil {
		return nil
	}

	raw, _ := json.Marshal(project)
	var copy models.Project
	_ = json.Unmarshal(raw, &copy)
	return &copy
}
