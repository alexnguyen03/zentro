package utils

import (
	"os"
	"path/filepath"
	"testing"

	"zentro/internal/models"
)

func TestProjectPersistence_RoundTrip(t *testing.T) {
	temp := t.TempDir()
	t.Setenv("APPDATA", temp)
	t.Setenv("XDG_CONFIG_HOME", temp)
	t.Setenv("HOME", temp)

	project := models.NewProject("Payments Platform")
	project.Description = "Primary analytics and operational data project"
	project.Tags = []string{"payments", "analytics"}
	project.Environments = append(project.Environments, models.NewProjectEnvironment(project.ID, models.EnvironmentDevelopment))

	if err := UpsertProject(project); err != nil {
		t.Fatalf("upsert project: %v", err)
	}

	projects, err := LoadProjects()
	if err != nil {
		t.Fatalf("load projects: %v", err)
	}
	if len(projects) != 1 {
		t.Fatalf("expected 1 project, got %d", len(projects))
	}

	got := projects[0]
	if got.ID == "" {
		t.Fatal("expected project ID to be populated")
	}
	if got.StoragePath == "" {
		t.Fatal("expected project storage path to be populated")
	}
	if _, err := os.Stat(filepath.Join(got.StoragePath, "project.json")); err != nil {
		t.Fatalf("expected project manifest to exist: %v", err)
	}
	if got.Slug != "payments-platform" {
		t.Fatalf("unexpected slug: %s", got.Slug)
	}
	if len(got.Workspaces) == 0 {
		t.Fatal("expected default workspace to be created")
	}
	if got.LastWorkspaceID == "" {
		t.Fatal("expected last workspace ID")
	}
}

func TestDeleteProject_RemovesProject(t *testing.T) {
	temp := t.TempDir()
	t.Setenv("APPDATA", temp)
	t.Setenv("XDG_CONFIG_HOME", temp)
	t.Setenv("HOME", temp)

	project := models.NewProject("Warehouse")
	if err := UpsertProject(project); err != nil {
		t.Fatalf("upsert project: %v", err)
	}
	manifestPath := filepath.Join(project.StoragePath, "project.json")

	if err := DeleteProject(project.ID); err != nil {
		t.Fatalf("delete project: %v", err)
	}

	projects, err := LoadProjects()
	if err != nil {
		t.Fatalf("load projects: %v", err)
	}
	if len(projects) != 0 {
		t.Fatalf("expected no projects after delete, got %d", len(projects))
	}
	if _, err := os.Stat(manifestPath); err != nil {
		t.Fatalf("expected soft delete to keep project manifest: %v", err)
	}
}
