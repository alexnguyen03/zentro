package app

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/object"
)

const initialProjectCommitMessage = "Initial Zentro project"

func ensureInitialProjectCommit(repo *git.Repository, repoPath, message string) error {
	if repo == nil {
		return fmt.Errorf("source control: repository is required")
	}

	if _, err := repo.Head(); err == nil {
		return nil
	} else if !errors.Is(err, plumbing.ErrReferenceNotFound) && !strings.Contains(strings.ToLower(err.Error()), "reference not found") {
		return fmt.Errorf("source control: read HEAD: %w", err)
	}

	gitignorePath := filepath.Join(repoPath, ".gitignore")
	if _, err := os.Stat(gitignorePath); err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("source control: stat .gitignore: %w", err)
	}

	wt, err := repo.Worktree()
	if err != nil {
		return fmt.Errorf("source control: worktree: %w", err)
	}
	if _, err := wt.Add(".gitignore"); err != nil {
		return fmt.Errorf("source control: stage .gitignore: %w", err)
	}

	commitMsg := strings.TrimSpace(message)
	if commitMsg == "" {
		commitMsg = initialProjectCommitMessage
	}
	_, err = wt.Commit(commitMsg, &git.CommitOptions{
		Author: &object.Signature{
			Name:  "Zentro",
			Email: "zentro@local",
			When:  time.Now().UTC(),
		},
	})
	if err != nil {
		return fmt.Errorf("source control: initial commit: %w", err)
	}
	return nil
}
