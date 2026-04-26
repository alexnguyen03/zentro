package app

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"

	"zentro/internal/models"
	"zentro/internal/utils"
)

func TestProjectServiceCreateProject_InitializesGitRepoInStoragePath(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	t.Setenv("APPDATA", t.TempDir())
	t.Setenv("HOME", t.TempDir())

	svc := NewProjectService(utils.NewLogger(false))
	projectDir := filepath.Join(t.TempDir(), "my-project")

	created, err := svc.CreateProject(models.Project{
		Name:        "My Project",
		Slug:        "my-project",
		StoragePath: projectDir,
	})
	if err != nil {
		t.Fatalf("CreateProject error: %v", err)
	}
	if created == nil {
		t.Fatal("CreateProject returned nil project")
	}
	if created.GitRepoPath != projectDir {
		t.Fatalf("expected GitRepoPath=%q, got %q", projectDir, created.GitRepoPath)
	}

	if _, err := os.Stat(filepath.Join(projectDir, ".git")); err != nil {
		t.Fatalf("expected .git directory to exist: %v", err)
	}
	if _, err := git.PlainOpen(projectDir); err != nil {
		t.Fatalf("expected initialized git repo: %v", err)
	}
	repo, err := git.PlainOpen(projectDir)
	if err != nil {
		t.Fatalf("open repo: %v", err)
	}
	head, err := repo.Reference(plumbing.HEAD, false)
	if err != nil {
		t.Fatalf("read HEAD: %v", err)
	}
	if head.Target() != plumbing.NewBranchReferenceName("main") {
		t.Fatalf("expected HEAD target refs/heads/main, got %s", head.Target().String())
	}
	headRef, err := repo.Head()
	if err != nil {
		t.Fatalf("resolve HEAD commit: %v", err)
	}
	commit, err := repo.CommitObject(headRef.Hash())
	if err != nil {
		t.Fatalf("load HEAD commit: %v", err)
	}
	if commit.Message != initialProjectCommitMessage {
		t.Fatalf("expected initial commit message %q, got %q", initialProjectCommitMessage, commit.Message)
	}

	gitignorePath := filepath.Join(projectDir, ".gitignore")
	content, err := os.ReadFile(gitignorePath)
	if err != nil {
		t.Fatalf("expected .gitignore to exist: %v", err)
	}
	gitignoreText := string(content)
	if !strings.Contains(gitignoreText, "!scripts/queries/**/*.sql") {
		t.Fatalf("expected managed .gitignore to unignore tracked SQL path, got:\n%s", gitignoreText)
	}

	before := gitignoreText
	if err := ensureManagedProjectGitIgnore(projectDir); err != nil {
		t.Fatalf("ensureManagedProjectGitIgnore failed: %v", err)
	}
	afterBytes, err := os.ReadFile(gitignorePath)
	if err != nil {
		t.Fatalf("read .gitignore after ensure failed: %v", err)
	}
	if string(afterBytes) != before {
		t.Fatalf("expected idempotent .gitignore merge, before=%q after=%q", before, string(afterBytes))
	}
}
