package app

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"zentro/internal/models"
)

func (a *App) ListProjects() ([]*models.Project, error) { return a.projects.ListProjects() }

func (a *App) GetProject(projectID string) (*models.Project, error) {
	return a.projects.GetProject(projectID)
}

func (a *App) CreateProject(p models.Project) (*models.Project, error) {
	project, err := a.projects.CreateProject(p)
	if err != nil {
		return nil, err
	}
	a.project = project
	a.currentEnvironmentKey = project.DefaultEnvironmentKey
	a.draft = []*models.ConnectionProfile{}
	a.bindTrackingProject(project)
	return project, nil
}

func (a *App) SaveProject(p models.Project) (*models.Project, error) {
	project, err := a.projects.SaveProject(p)
	if err != nil {
		return nil, err
	}
	if a.project == nil || a.project.ID == project.ID {
		a.project = project
		if a.currentEnvironmentKey == "" {
			a.currentEnvironmentKey = project.DefaultEnvironmentKey
		}
	}
	a.bindTrackingProject(project)
	return project, nil
}

func (a *App) DeleteProject(projectID string) error {
	if a.project != nil && a.project.ID == projectID {
		a.project = nil
		a.currentEnvironmentKey = ""
	}
	return a.projects.DeleteProject(projectID)
}

func (a *App) OpenProject(projectID string) (*models.Project, error) {
	project, err := a.projects.GetProject(projectID)
	if err != nil {
		return nil, err
	}
	a.project = project
	a.currentEnvironmentKey = project.DefaultEnvironmentKey
	a.draft = []*models.ConnectionProfile{}
	a.bindTrackingProject(project)
	return project, nil
}

func (a *App) GetActiveProject() *models.Project { return a.project }

func (a *App) GetDefaultProjectStorageRoot() (string, error) {
	return a.projects.GetDefaultProjectStorageRoot()
}

func (a *App) PickDirectory(initialPath string) (string, error) {
	defaultDir := strings.TrimSpace(initialPath)
	if defaultDir == "" {
		root, err := a.projects.GetDefaultProjectStorageRoot()
		if err == nil {
			defaultDir = root
		}
	}
	return a.openDirectoryDialog("Select directory", defaultDir)
}

func (a *App) OpenProjectFromDirectory(directoryPath string) (*models.Project, error) {
	project, err := a.projects.OpenProjectFromDirectory(directoryPath)
	if err != nil {
		return nil, err
	}
	a.project = project
	a.currentEnvironmentKey = project.DefaultEnvironmentKey
	a.draft = []*models.ConnectionProfile{}
	a.bindTrackingProject(project)
	return project, nil
}

func (a *App) OpenDirectoryInExplorer(path string) error {
	trimmedPath := strings.TrimSpace(path)
	if trimmedPath == "" {
		return fmt.Errorf("path is required")
	}

	absPath, err := filepath.Abs(trimmedPath)
	if err != nil {
		return fmt.Errorf("resolve path: %w", err)
	}

	stat, err := os.Stat(absPath)
	if err != nil {
		return fmt.Errorf("path does not exist: %w", err)
	}

	target := absPath
	if !stat.IsDir() {
		target = filepath.Dir(absPath)
	}

	cmd := fileManagerCmd(target)
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("open explorer: %w", err)
	}
	return nil
}
