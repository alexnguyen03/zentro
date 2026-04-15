package app

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/google/uuid"

	"zentro/internal/models"
	"zentro/internal/utils"
)

type ProjectService struct {
	logger *slog.Logger
}

func NewProjectService(logger *slog.Logger) *ProjectService {
	return &ProjectService{logger: logger}
}

func (s *ProjectService) ListProjects() ([]*models.Project, error) {
	return utils.LoadProjects()
}

func (s *ProjectService) GetProject(projectID string) (*models.Project, error) {
	return utils.LoadProject(projectID)
}

func (s *ProjectService) CreateProject(input models.Project) (*models.Project, error) {
	if strings.TrimSpace(input.Name) == "" {
		return nil, fmt.Errorf("project name is required")
	}

	projects, err := utils.LoadProjects()
	if err != nil {
		return nil, err
	}

	if input.ID == "" {
		input.ID = uuid.NewString()
	}
	if input.Slug == "" {
		input.Slug = models.Slugify(input.Name)
	}

	for _, existing := range projects {
		if existing.ID == input.ID {
			return nil, fmt.Errorf("project %q already exists", input.ID)
		}
		if existing.Slug == input.Slug {
			return nil, fmt.Errorf("project slug %q already exists", input.Slug)
		}
	}

	now := time.Now().UTC().Format(time.RFC3339)
	if input.CreatedAt == "" {
		input.CreatedAt = now
	}
	input.UpdatedAt = now

	project := &input
	if err := utils.UpsertProject(project); err != nil {
		return nil, err
	}

	created, err := utils.LoadProject(project.ID)
	if err != nil {
		return nil, err
	}

	// Auto-initialize git repository in project directory so source control
	// is ready immediately after creating a project.
	repoPath := strings.TrimSpace(created.StoragePath)
	if repoPath != "" {
		if err := ensureGitRepository(repoPath); err != nil {
			_ = utils.DeleteProject(created.ID)
			return nil, fmt.Errorf("initialize project git repository: %w", err)
		}
		created.GitRepoPath = repoPath
		created.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
		if err := utils.UpsertProject(created); err != nil {
			_ = utils.DeleteProject(created.ID)
			return nil, fmt.Errorf("persist project git repository path: %w", err)
		}
	}

	if s.logger != nil {
		s.logger.Info("created project", "project_id", project.ID, "slug", project.Slug)
	}
	return utils.LoadProject(project.ID)
}

func ensureGitRepository(repoPath string) error {
	if strings.TrimSpace(repoPath) == "" {
		return fmt.Errorf("repository path is required")
	}
	if _, err := git.PlainOpen(repoPath); err == nil {
		if ensureErr := ensureManagedProjectGitIgnore(repoPath); ensureErr != nil {
			return ensureErr
		}
		repo, openErr := git.PlainOpen(repoPath)
		if openErr != nil {
			return openErr
		}
		return ensureInitialProjectCommit(repo, repoPath, initialProjectCommitMessage)
	} else if !errors.Is(err, git.ErrRepositoryNotExists) {
		return err
	}
	repo, err := git.PlainInit(repoPath, false)
	if err != nil {
		return err
	}
	if err := repo.Storer.SetReference(
		plumbing.NewSymbolicReference(plumbing.HEAD, plumbing.NewBranchReferenceName("main")),
	); err != nil {
		return err
	}
	if err := ensureManagedProjectGitIgnore(repoPath); err != nil {
		return err
	}
	return ensureInitialProjectCommit(repo, repoPath, initialProjectCommitMessage)
}

func (s *ProjectService) SaveProject(project models.Project) (*models.Project, error) {
	if strings.TrimSpace(project.Name) == "" {
		return nil, fmt.Errorf("project name is required")
	}

	project.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	if err := utils.UpsertProject(&project); err != nil {
		return nil, err
	}
	if s.logger != nil {
		s.logger.Info("saved project", "project_id", project.ID, "slug", project.Slug)
	}
	return utils.LoadProject(project.ID)
}

func (s *ProjectService) DeleteProject(projectID string) error {
	if s.logger != nil {
		s.logger.Info("deleting project", "project_id", projectID)
	}
	return utils.DeleteProject(projectID)
}

func (s *ProjectService) GetDefaultProjectStorageRoot() (string, error) {
	return utils.DefaultProjectStorageRoot()
}

func (s *ProjectService) OpenProjectFromDirectory(directoryPath string) (*models.Project, error) {
	path := strings.TrimSpace(directoryPath)
	if path == "" {
		return nil, fmt.Errorf("project directory is required")
	}

	absPath, err := filepath.Abs(path)
	if err != nil {
		return nil, fmt.Errorf("resolve project directory: %w", err)
	}

	manifestPath := filepath.Join(absPath, "project.json")
	data, err := os.ReadFile(manifestPath)
	if err != nil {
		return nil, fmt.Errorf("read project manifest: %w", err)
	}

	var project models.Project
	if err := json.Unmarshal(data, &project); err != nil {
		return nil, fmt.Errorf("parse project manifest: %w", err)
	}
	project.StoragePath = absPath

	if err := utils.UpsertProject(&project); err != nil {
		return nil, err
	}
	return utils.LoadProject(project.ID)
}
