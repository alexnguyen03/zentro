package utils

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"zentro/internal/models"
)

func setupConfigHome(t *testing.T) string {
	t.Helper()
	configRoot := t.TempDir()
	t.Setenv("AppData", configRoot)
	t.Setenv("APPDATA", configRoot)
	return configRoot
}

func makeScript(projectID, connectionName, id, name string) models.SavedScript {
	return models.SavedScript{
		ID:             id,
		ProjectID:      projectID,
		ConnectionName: connectionName,
		Name:           name,
		CreatedAt:      "2026-01-01T00:00:00Z",
		UpdatedAt:      "2026-01-01T00:00:00Z",
	}
}

func TestScriptsAreScopedByProjectAndConnection(t *testing.T) {
	setupConfigHome(t)

	scriptA := makeScript("project-a", "shared-conn", "s-a", "Project A Script")
	scriptB := makeScript("project-b", "shared-conn", "s-b", "Project B Script")

	if err := SaveScript(scriptA, "select 'A';"); err != nil {
		t.Fatalf("save script A: %v", err)
	}
	if err := SaveScript(scriptB, "select 'B';"); err != nil {
		t.Fatalf("save script B: %v", err)
	}

	listA, err := LoadScripts("project-a", "shared-conn")
	if err != nil {
		t.Fatalf("load scripts for project A: %v", err)
	}
	if len(listA) != 1 || listA[0].ID != scriptA.ID {
		t.Fatalf("expected only script A, got %+v", listA)
	}

	listB, err := LoadScripts("project-b", "shared-conn")
	if err != nil {
		t.Fatalf("load scripts for project B: %v", err)
	}
	if len(listB) != 1 || listB[0].ID != scriptB.ID {
		t.Fatalf("expected only script B, got %+v", listB)
	}

	contentA, err := GetScriptContent("project-a", "shared-conn", scriptA.ID)
	if err != nil {
		t.Fatalf("get content A: %v", err)
	}
	if contentA != "select 'A';" {
		t.Fatalf("unexpected content for script A: %q", contentA)
	}
}

func TestDeleteScriptOnlyAffectsItsProjectScope(t *testing.T) {
	setupConfigHome(t)

	scriptA := makeScript("project-a", "shared-conn", "s-a", "Project A Script")
	scriptB := makeScript("project-b", "shared-conn", "s-b", "Project B Script")

	if err := SaveScript(scriptA, "select 1;"); err != nil {
		t.Fatalf("save script A: %v", err)
	}
	if err := SaveScript(scriptB, "select 2;"); err != nil {
		t.Fatalf("save script B: %v", err)
	}

	if err := DeleteScript("project-a", "shared-conn", scriptA.ID); err != nil {
		t.Fatalf("delete script A: %v", err)
	}

	listA, err := LoadScripts("project-a", "shared-conn")
	if err != nil {
		t.Fatalf("load scripts for project A: %v", err)
	}
	if len(listA) != 0 {
		t.Fatalf("expected project A to be empty, got %+v", listA)
	}

	listB, err := LoadScripts("project-b", "shared-conn")
	if err != nil {
		t.Fatalf("load scripts for project B: %v", err)
	}
	if len(listB) != 1 || listB[0].ID != scriptB.ID {
		t.Fatalf("expected project B script to remain, got %+v", listB)
	}
}

func TestLegacyScriptsRemainHidden(t *testing.T) {
	configRoot := setupConfigHome(t)

	legacyDir := filepath.Join(configRoot, "zentro", "scripts", slugify("shared-conn"))
	if err := os.MkdirAll(legacyDir, 0o755); err != nil {
		t.Fatalf("mkdir legacy dir: %v", err)
	}
	legacyIndex := []models.SavedScript{
		{
			ID:             "legacy-1",
			ConnectionName: "shared-conn",
			Name:           "Legacy Script",
			CreatedAt:      "2025-01-01T00:00:00Z",
			UpdatedAt:      "2025-01-01T00:00:00Z",
		},
	}
	data, err := json.MarshalIndent(legacyIndex, "", "  ")
	if err != nil {
		t.Fatalf("marshal legacy index: %v", err)
	}
	if err := os.WriteFile(filepath.Join(legacyDir, "index.json"), data, 0o644); err != nil {
		t.Fatalf("write legacy index: %v", err)
	}

	list, err := LoadScripts("project-a", "shared-conn")
	if err != nil {
		t.Fatalf("load scripts for project scope: %v", err)
	}
	if len(list) != 0 {
		t.Fatalf("expected legacy scripts to remain hidden, got %+v", list)
	}
}
