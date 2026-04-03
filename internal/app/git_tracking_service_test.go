package app

import (
	"os"
	"path/filepath"
	"testing"

	"zentro/internal/models"
)

func testTrackingProject(t *testing.T) *models.Project {
	t.Helper()
	return &models.Project{
		ID:          "project-test",
		StoragePath: t.TempDir(),
	}
}

func testSavedScript() models.SavedScript {
	return models.SavedScript{
		ID:             "script-1",
		ProjectID:      "project-test",
		ConnectionName: "Local Postgres",
		Name:           "Test Script",
		CreatedAt:      "2026-04-03T00:00:00Z",
		UpdatedAt:      "2026-04-03T00:00:00Z",
	}
}

func TestGitTrackingService_TrackScriptSave_DeduplicatesUnchangedContentWithoutCommit(t *testing.T) {
	svc := NewGitTrackingService(nil)
	project := testTrackingProject(t)
	if err := svc.BindProject(project); err != nil {
		t.Fatalf("bind project failed: %v", err)
	}

	script := testSavedScript()
	if err := svc.TrackScriptSave(project, script, "select 1;"); err != nil {
		t.Fatalf("first save failed: %v", err)
	}

	pending, err := svc.GetPendingChanges(project)
	if err != nil {
		t.Fatalf("get pending failed: %v", err)
	}
	if len(pending) < 1 {
		t.Fatalf("expected pending changes after first save")
	}
	expectedScriptPath := "scripts/local-postgres/script-1.sql"
	foundScript := false
	for _, file := range pending {
		if file == expectedScriptPath {
			foundScript = true
			break
		}
	}
	if !foundScript {
		t.Fatalf("expected pending change to include %s, got %v", expectedScriptPath, pending)
	}

	if err := svc.TrackScriptSave(project, script, "select 1;"); err != nil {
		t.Fatalf("second save failed: %v", err)
	}

	pending, err = svc.GetPendingChanges(project)
	if err != nil {
		t.Fatalf("get pending failed: %v", err)
	}
	foundScript = false
	for _, file := range pending {
		if file == expectedScriptPath {
			foundScript = true
			break
		}
	}
	if !foundScript {
		t.Fatalf("expected unchanged save to keep script pending, got %v", pending)
	}

	items, err := svc.ListTimeline(project, 20, "")
	if err != nil {
		t.Fatalf("list timeline failed: %v", err)
	}
	if len(items) != 0 {
		t.Fatalf("expected no commit before manual/close, got %d", len(items))
	}
}

func TestGitTrackingService_ManualCommit_CleanAndDirty(t *testing.T) {
	svc := NewGitTrackingService(nil)
	project := testTrackingProject(t)
	if err := svc.BindProject(project); err != nil {
		t.Fatalf("bind project failed: %v", err)
	}

	repoRoot, err := svc.repoRoot(project)
	if err != nil {
		t.Fatalf("repo root failed: %v", err)
	}
	filePath := filepath.Join(repoRoot, "scripts", "manual", "scratch.sql")
	if err := os.MkdirAll(filepath.Dir(filePath), 0o755); err != nil {
		t.Fatalf("mkdir failed: %v", err)
	}
	if err := os.WriteFile(filePath, []byte("select now();\n"), 0o644); err != nil {
		t.Fatalf("write file failed: %v", err)
	}

	result, err := svc.ManualCommit(project, "")
	if err != nil {
		t.Fatalf("manual commit failed: %v", err)
	}
	if result.NoChanges {
		t.Fatalf("expected manual commit to include changes")
	}
	if result.Hash == "" {
		t.Fatalf("expected commit hash")
	}
	if len(result.Files) == 0 {
		t.Fatalf("expected changed files in commit result")
	}

	cleanResult, err := svc.ManualCommit(project, "")
	if err != nil {
		t.Fatalf("manual commit on clean repo failed: %v", err)
	}
	if !cleanResult.NoChanges {
		t.Fatalf("expected no_changes=true on clean repo")
	}
}

func TestGitTrackingService_FlushAndCommitOnClose(t *testing.T) {
	svc := NewGitTrackingService(nil)
	project := testTrackingProject(t)
	if err := svc.BindProject(project); err != nil {
		t.Fatalf("bind project failed: %v", err)
	}

	repoRoot, err := svc.repoRoot(project)
	if err != nil {
		t.Fatalf("repo root failed: %v", err)
	}
	filePath := filepath.Join(repoRoot, "scripts", "flush", "pending.sql")
	if err := os.MkdirAll(filepath.Dir(filePath), 0o755); err != nil {
		t.Fatalf("mkdir failed: %v", err)
	}
	if err := os.WriteFile(filePath, []byte("select 42;\n"), 0o644); err != nil {
		t.Fatalf("write file failed: %v", err)
	}

	if err := svc.FlushAndCommitOnClose(project); err != nil {
		t.Fatalf("flush and commit on close failed: %v", err)
	}

	pending, err := svc.GetPendingChanges(project)
	if err != nil {
		t.Fatalf("get pending failed: %v", err)
	}
	if len(pending) != 0 {
		t.Fatalf("expected no pending changes after close flush, got %d", len(pending))
	}

	items, err := svc.ListTimeline(project, 20, "app.close")
	if err != nil {
		t.Fatalf("list timeline failed: %v", err)
	}
	if len(items) == 0 {
		t.Fatalf("expected app.close commit in timeline")
	}
}

func TestGitTrackingService_TrackScriptDelete_StagedUntilCloseCommit(t *testing.T) {
	svc := NewGitTrackingService(nil)
	project := testTrackingProject(t)
	if err := svc.BindProject(project); err != nil {
		t.Fatalf("bind project failed: %v", err)
	}

	script := testSavedScript()
	if err := svc.TrackScriptSave(project, script, "select 1;"); err != nil {
		t.Fatalf("seed save failed: %v", err)
	}
	if err := svc.TrackScriptDelete(project, script.ConnectionName, script.ID); err != nil {
		t.Fatalf("delete failed: %v", err)
	}

	items, err := svc.ListTimeline(project, 20, "")
	if err != nil {
		t.Fatalf("list timeline failed: %v", err)
	}
	if len(items) != 0 {
		t.Fatalf("expected no commit on save/delete before close/manual, got %d commits", len(items))
	}

	if err := svc.FlushAndCommitOnClose(project); err != nil {
		t.Fatalf("flush and commit on close failed: %v", err)
	}

	items, err = svc.ListTimeline(project, 20, "app.close")
	if err != nil {
		t.Fatalf("list timeline failed: %v", err)
	}
	if len(items) == 0 {
		t.Fatalf("expected close flush commit to include delete")
	}
}
