package app

import (
	"fmt"
	"log/slog"
	"strings"
	"time"

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
	if s.logger != nil {
		s.logger.Info("created project", "project_id", project.ID, "slug", project.Slug)
	}
	return utils.LoadProject(project.ID)
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
