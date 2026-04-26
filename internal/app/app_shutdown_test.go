package app

import (
	"context"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing/object"

	"zentro/internal/models"
)

func testInitRepoWithBaseCommit(t *testing.T) string {
	t.Helper()

	repoPath := t.TempDir()
	repo, err := git.PlainInit(repoPath, false)
	if err != nil {
		t.Fatalf("init repo failed: %v", err)
	}

	readmePath := filepath.Join(repoPath, "README.md")
	if err := os.WriteFile(readmePath, []byte("base\n"), 0o644); err != nil {
		t.Fatalf("write seed file failed: %v", err)
	}

	wt, err := repo.Worktree()
	if err != nil {
		t.Fatalf("worktree failed: %v", err)
	}
	if _, err := wt.Add("."); err != nil {
		t.Fatalf("stage seed file failed: %v", err)
	}
	if _, err := wt.Commit("seed", &git.CommitOptions{
		Author: &object.Signature{
			Name:  "Test",
			Email: "test@local",
			When:  time.Now(),
		},
	}); err != nil {
		t.Fatalf("seed commit failed: %v", err)
	}

	return repoPath
}

func testCommitCount(t *testing.T, repoPath string) int {
	t.Helper()

	repo, err := git.PlainOpen(repoPath)
	if err != nil {
		t.Fatalf("open repo failed: %v", err)
	}

	head, err := repo.Head()
	if err != nil {
		t.Fatalf("head failed: %v", err)
	}

	iter, err := repo.Log(&git.LogOptions{From: head.Hash()})
	if err != nil {
		t.Fatalf("log failed: %v", err)
	}
	defer iter.Close()

	count := 0
	_ = iter.ForEach(func(_ *object.Commit) error {
		count++
		return nil
	})
	return count
}

func testHeadMessage(t *testing.T, repoPath string) string {
	t.Helper()

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
	return commit.Message
}

func newTestAppWithProject(project *models.Project) *App {
	a := NewApp()
	a.ctx = context.Background()
	a.logger = slog.New(slog.NewTextHandler(io.Discard, nil))
	noop := funcEventEmitter{fn: func(context.Context, string, any) {}}
	a.emitter = noop
	a.conn.emitter = noop
	a.query.emitter = noop
	a.tx.emitter = noop
	a.project = project
	return a
}

func TestAppShutdown_AutoCommitOnExit_EnabledDirtyRepoCreatesCommit(t *testing.T) {
	repoPath := testInitRepoWithBaseCommit(t)
	queryTrackingPath := filepath.Join(repoPath, "scripts", "queries", "local-postgres", "tab-1.sql")
	if err := os.MkdirAll(filepath.Dir(queryTrackingPath), 0o755); err != nil {
		t.Fatalf("mkdir query tracking path failed: %v", err)
	}
	if err := os.WriteFile(queryTrackingPath, []byte("select 1;\n"), 0o644); err != nil {
		t.Fatalf("write dirty file failed: %v", err)
	}

	before := testCommitCount(t, repoPath)
	app := newTestAppWithProject(&models.Project{
		ID:               "p1",
		GitRepoPath:      repoPath,
		AutoCommitOnExit: true,
	})

	app.Shutdown()

	after := testCommitCount(t, repoPath)
	if after != before+1 {
		t.Fatalf("expected one new commit, before=%d after=%d", before, after)
	}
	if got := testHeadMessage(t, repoPath); got != "app.close: autosave flush" {
		t.Fatalf("expected auto-commit message, got %q", got)
	}
}

func TestAppShutdown_AutoCommitOnExit_EnabledCleanRepoSkipsCommit(t *testing.T) {
	repoPath := testInitRepoWithBaseCommit(t)
	before := testCommitCount(t, repoPath)

	app := newTestAppWithProject(&models.Project{
		ID:               "p1",
		GitRepoPath:      repoPath,
		AutoCommitOnExit: true,
	})

	app.Shutdown()

	after := testCommitCount(t, repoPath)
	if after != before {
		t.Fatalf("expected no new commit on clean repo, before=%d after=%d", before, after)
	}
}

func TestAppShutdown_AutoCommitOnExit_DisabledSkipsCommit(t *testing.T) {
	repoPath := testInitRepoWithBaseCommit(t)
	queryTrackingPath := filepath.Join(repoPath, "scripts", "queries", "local-postgres", "tab-2.sql")
	if err := os.MkdirAll(filepath.Dir(queryTrackingPath), 0o755); err != nil {
		t.Fatalf("mkdir query tracking path failed: %v", err)
	}
	if err := os.WriteFile(queryTrackingPath, []byte("select 2;\n"), 0o644); err != nil {
		t.Fatalf("write dirty file failed: %v", err)
	}
	before := testCommitCount(t, repoPath)

	app := newTestAppWithProject(&models.Project{
		ID:               "p1",
		GitRepoPath:      repoPath,
		AutoCommitOnExit: false,
	})

	app.Shutdown()

	after := testCommitCount(t, repoPath)
	if after != before {
		t.Fatalf("expected no new commit when disabled, before=%d after=%d", before, after)
	}
}

func TestAppShutdown_AutoCommitOnExit_InvalidRepoPathDoesNotBlockShutdown(t *testing.T) {
	app := newTestAppWithProject(&models.Project{
		ID:               "p1",
		GitRepoPath:      filepath.Join(t.TempDir(), "not-a-repo"),
		AutoCommitOnExit: true,
	})

	// Should not panic or error; shutdown must continue.
	app.Shutdown()
}

func TestAppShutdown_AutoCommitOnExit_IgnoresProjectConfigFiles(t *testing.T) {
	repoPath := testInitRepoWithBaseCommit(t)
	if err := os.WriteFile(filepath.Join(repoPath, "project.json"), []byte("{\"name\":\"x\"}\n"), 0o644); err != nil {
		t.Fatalf("write project.json failed: %v", err)
	}
	before := testCommitCount(t, repoPath)

	app := newTestAppWithProject(&models.Project{
		ID:               "p1",
		GitRepoPath:      repoPath,
		AutoCommitOnExit: true,
	})

	app.Shutdown()

	after := testCommitCount(t, repoPath)
	if after != before {
		t.Fatalf("expected no new commit for project config changes, before=%d after=%d", before, after)
	}
}
