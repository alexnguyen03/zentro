package app

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/object"
)

func testInitSourceControlRepoWithSeedCommit(t *testing.T) string {
	t.Helper()

	repoPath := t.TempDir()
	repo, err := git.PlainInit(repoPath, false)
	if err != nil {
		t.Fatalf("init repo failed: %v", err)
	}

	readmePath := filepath.Join(repoPath, "README.md")
	if err := os.WriteFile(readmePath, []byte("seed\n"), 0o644); err != nil {
		t.Fatalf("write seed file failed: %v", err)
	}

	wt, err := repo.Worktree()
	if err != nil {
		t.Fatalf("worktree failed: %v", err)
	}
	if _, err := wt.Add("README.md"); err != nil {
		t.Fatalf("stage seed file failed: %v", err)
	}
	if _, err := wt.Commit("seed", &git.CommitOptions{
		Author: &object.Signature{Name: "Test", Email: "test@local", When: time.Now()},
	}); err != nil {
		t.Fatalf("seed commit failed: %v", err)
	}

	return repoPath
}

func TestSourceControlService_InitRepo_CreatesManagedGitIgnoreAndMainHead(t *testing.T) {
	svc := NewSourceControlService()
	repoPath := t.TempDir()

	if err := svc.InitRepo(repoPath); err != nil {
		t.Fatalf("init repo failed: %v", err)
	}

	repo, err := git.PlainOpen(repoPath)
	if err != nil {
		t.Fatalf("open repo failed: %v", err)
	}

	head, err := repo.Reference(plumbing.HEAD, false)
	if err != nil {
		t.Fatalf("read HEAD failed: %v", err)
	}
	if head.Target() != plumbing.NewBranchReferenceName("main") {
		t.Fatalf("expected HEAD target refs/heads/main, got %s", head.Target().String())
	}
	headRef, err := repo.Head()
	if err != nil {
		t.Fatalf("resolve HEAD commit failed: %v", err)
	}
	commit, err := repo.CommitObject(headRef.Hash())
	if err != nil {
		t.Fatalf("load HEAD commit failed: %v", err)
	}
	if commit.Message != initialProjectCommitMessage {
		t.Fatalf("expected initial commit message %q, got %q", initialProjectCommitMessage, commit.Message)
	}

	gitignoreBytes, err := os.ReadFile(filepath.Join(repoPath, ".gitignore"))
	if err != nil {
		t.Fatalf("read .gitignore failed: %v", err)
	}
	gitignore := string(gitignoreBytes)
	if !strings.Contains(gitignore, "!scripts/queries/**/*.sql") {
		t.Fatalf("expected managed query tracking rule in .gitignore, got:\n%s", gitignore)
	}
}

func TestSourceControlService_CommitAllIfDirty_OnlyCommitsTrackedSQLFiles(t *testing.T) {
	svc := NewSourceControlService()
	repoPath := testInitSourceControlRepoWithSeedCommit(t)

	sqlPath := filepath.Join(repoPath, "scripts", "queries", "local-postgres", "tab-1.sql")
	if err := os.MkdirAll(filepath.Dir(sqlPath), 0o755); err != nil {
		t.Fatalf("mkdir sql dir failed: %v", err)
	}
	if err := os.WriteFile(sqlPath, []byte("select 1;\n"), 0o644); err != nil {
		t.Fatalf("write sql failed: %v", err)
	}
	if err := os.WriteFile(filepath.Join(repoPath, "project.json"), []byte("{\"name\":\"x\"}\n"), 0o644); err != nil {
		t.Fatalf("write project.json failed: %v", err)
	}

	hash, skipped, err := svc.CommitAllIfDirty(repoPath, "app.close: autosave flush")
	if err != nil {
		t.Fatalf("CommitAllIfDirty failed: %v", err)
	}
	if skipped {
		t.Fatalf("expected commit to be created when tracked SQL is dirty")
	}
	if strings.TrimSpace(hash) == "" {
		t.Fatalf("expected commit hash")
	}

	repo, err := git.PlainOpen(repoPath)
	if err != nil {
		t.Fatalf("open repo failed: %v", err)
	}
	head, err := repo.Head()
	if err != nil {
		t.Fatalf("head failed: %v", err)
	}
	commit, err := repo.CommitObject(head.Hash())
	if err != nil {
		t.Fatalf("commit object failed: %v", err)
	}
	parent, err := commit.Parent(0)
	if err != nil {
		t.Fatalf("read parent failed: %v", err)
	}
	patch, err := parent.Patch(commit)
	if err != nil {
		t.Fatalf("patch failed: %v", err)
	}
	stats := patch.Stats()
	if len(stats) != 1 || stats[0].Name != "scripts/queries/local-postgres/tab-1.sql" {
		t.Fatalf("expected only tracked SQL file in commit, got %+v", stats)
	}

	wt, err := repo.Worktree()
	if err != nil {
		t.Fatalf("worktree failed: %v", err)
	}
	status, err := wt.Status()
	if err != nil {
		t.Fatalf("status failed: %v", err)
	}
	if _, ok := status["project.json"]; !ok {
		t.Fatalf("expected project.json to remain uncommitted in working tree")
	}
}

func TestSourceControlService_ReadWriteGitIgnore_RoundTrip(t *testing.T) {
	svc := NewSourceControlService()
	repoPath := t.TempDir()
	if err := svc.InitRepo(repoPath); err != nil {
		t.Fatalf("init repo failed: %v", err)
	}

	content := "# custom\n*.tmp\n"
	if err := svc.WriteGitIgnore(repoPath, content); err != nil {
		t.Fatalf("WriteGitIgnore failed: %v", err)
	}

	got, err := svc.ReadGitIgnore(repoPath)
	if err != nil {
		t.Fatalf("ReadGitIgnore failed: %v", err)
	}
	if got != content {
		t.Fatalf("expected exact .gitignore content round trip, want=%q got=%q", content, got)
	}
}
