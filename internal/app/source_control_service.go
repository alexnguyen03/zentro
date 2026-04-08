package app

import (
	"fmt"
	"os"
	pathpkg "path"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/object"
)

type SCFileStatus struct {
	Path   string `json:"path"`
	Staged bool   `json:"staged"`
	Status string `json:"status"` // "modified" | "added" | "deleted" | "untracked"
}

type SCStatus struct {
	Branch string         `json:"branch"`
	Files  []SCFileStatus `json:"files"`
	Clean  bool           `json:"clean"`
}

type SCCommit struct {
	Hash    string `json:"hash"`
	Message string `json:"message"`
	Author  string `json:"author"`
	When    string `json:"when"`
}

type SourceControlService struct {
	opMu sync.Mutex
}

func NewSourceControlService() *SourceControlService {
	return &SourceControlService{}
}

func (s *SourceControlService) openRepo(repoPath string) (*git.Repository, error) {
	if strings.TrimSpace(repoPath) == "" {
		return nil, fmt.Errorf("source control: git repo path is not configured")
	}
	repo, err := git.PlainOpen(repoPath)
	if err != nil {
		return nil, fmt.Errorf("source control: cannot open repo at %q: %w", repoPath, err)
	}
	return repo, nil
}

func (s *SourceControlService) InitRepo(repoPath string) error {
	s.opMu.Lock()
	defer s.opMu.Unlock()

	if strings.TrimSpace(repoPath) == "" {
		return fmt.Errorf("source control: git repo path is not configured")
	}

	_, err := git.PlainInit(repoPath, false)
	if err != nil {
		return fmt.Errorf("source control: cannot init repo at %q: %w", repoPath, err)
	}
	return nil
}

func (s *SourceControlService) GetStatus(repoPath string) (SCStatus, error) {
	repo, err := s.openRepo(repoPath)
	if err != nil {
		return SCStatus{}, err
	}

	wt, err := repo.Worktree()
	if err != nil {
		return SCStatus{}, fmt.Errorf("source control: worktree: %w", err)
	}

	gitStatus, err := wt.Status()
	if err != nil {
		return SCStatus{}, fmt.Errorf("source control: status: %w", err)
	}

	// Current branch
	head, err := repo.Head()
	branch := "HEAD"
	if err == nil {
		if head.Name().IsBranch() {
			branch = head.Name().Short()
		} else {
			branch = head.Hash().String()[:8]
		}
	}

	var files []SCFileStatus
	for path, st := range gitStatus {
		staged := st.Staging != git.Unmodified && st.Staging != git.Untracked

		// Determine status label from the most relevant code
		code := st.Worktree
		if staged {
			code = st.Staging
		}
		statusLabel := "modified"
		switch code {
		case git.Added:
			statusLabel = "added"
		case git.Deleted:
			statusLabel = "deleted"
		case git.Untracked:
			statusLabel = "untracked"
			staged = false
		}

		files = append(files, SCFileStatus{
			Path:   path,
			Staged: staged,
			Status: statusLabel,
		})
	}

	return SCStatus{
		Branch: branch,
		Files:  files,
		Clean:  len(files) == 0,
	}, nil
}

func (s *SourceControlService) StageFile(repoPath, path string) error {
	s.opMu.Lock()
	defer s.opMu.Unlock()

	repo, err := s.openRepo(repoPath)
	if err != nil {
		return err
	}
	wt, err := repo.Worktree()
	if err != nil {
		return fmt.Errorf("source control: worktree: %w", err)
	}
	_, err = wt.Add(path)
	if err != nil {
		return fmt.Errorf("source control: stage %q: %w", path, err)
	}
	return nil
}

func (s *SourceControlService) UnstageFile(repoPath, path string) error {
	s.opMu.Lock()
	defer s.opMu.Unlock()

	repo, err := s.openRepo(repoPath)
	if err != nil {
		return err
	}
	wt, err := repo.Worktree()
	if err != nil {
		return fmt.Errorf("source control: worktree: %w", err)
	}
	err = wt.Reset(&git.ResetOptions{
		Files: []string{path},
		Mode:  git.MixedReset,
	})
	if err != nil {
		return fmt.Errorf("source control: unstage %q: %w", path, err)
	}
	return nil
}

func (s *SourceControlService) StageAll(repoPath string) error {
	s.opMu.Lock()
	defer s.opMu.Unlock()

	repo, err := s.openRepo(repoPath)
	if err != nil {
		return err
	}
	wt, err := repo.Worktree()
	if err != nil {
		return fmt.Errorf("source control: worktree: %w", err)
	}
	_, err = wt.Add(".")
	if err != nil {
		return fmt.Errorf("source control: stage all: %w", err)
	}
	return nil
}

func (s *SourceControlService) Commit(repoPath, message string) (string, error) {
	s.opMu.Lock()
	defer s.opMu.Unlock()

	repo, err := s.openRepo(repoPath)
	if err != nil {
		return "", err
	}
	wt, err := repo.Worktree()
	if err != nil {
		return "", fmt.Errorf("source control: worktree: %w", err)
	}

	// Read author from git config
	cfg, _ := repo.Config()
	authorName := "Zentro"
	authorEmail := "zentro@local"
	if cfg != nil {
		if n := cfg.User.Name; n != "" {
			authorName = n
		}
		if e := cfg.User.Email; e != "" {
			authorEmail = e
		}
	}

	msg := strings.TrimSpace(message)
	if msg == "" {
		msg = "chore: commit via Zentro"
	}

	hash, err := wt.Commit(msg, &git.CommitOptions{
		Author: &object.Signature{
			Name:  authorName,
			Email: authorEmail,
			When:  time.Now(),
		},
	})
	if err != nil {
		return "", fmt.Errorf("source control: commit: %w", err)
	}
	return hash.String(), nil
}

func (s *SourceControlService) GetHistory(repoPath string, limit int) ([]SCCommit, error) {
	repo, err := s.openRepo(repoPath)
	if err != nil {
		return nil, err
	}

	head, err := repo.Head()
	if err != nil {
		if err == plumbing.ErrReferenceNotFound {
			return []SCCommit{}, nil
		}
		return nil, fmt.Errorf("source control: head: %w", err)
	}

	iter, err := repo.Log(&git.LogOptions{From: head.Hash()})
	if err != nil {
		return nil, fmt.Errorf("source control: log: %w", err)
	}
	defer iter.Close()

	if limit <= 0 {
		limit = 100
	}

	var commits []SCCommit
	for i := 0; i < limit; i++ {
		c, err := iter.Next()
		if err != nil {
			break
		}
		commits = append(commits, SCCommit{
			Hash:    c.Hash.String(),
			Message: strings.TrimSpace(c.Message),
			Author:  c.Author.Name,
			When:    c.Author.When.UTC().Format(time.RFC3339),
		})
	}
	return commits, nil
}

func (s *SourceControlService) GetFileDiffs(repoPath, hash string) ([]GitCommitFileDiff, error) {
	repo, err := s.openRepo(repoPath)
	if err != nil {
		return nil, err
	}

	commitHash := plumbing.NewHash(hash)
	commit, err := repo.CommitObject(commitHash)
	if err != nil {
		return nil, fmt.Errorf("source control: commit %q: %w", hash, err)
	}

	commitTree, err := commit.Tree()
	if err != nil {
		return nil, fmt.Errorf("source control: tree: %w", err)
	}

	var parentTree *object.Tree
	if commit.NumParents() > 0 {
		parent, err := commit.Parents().Next()
		if err == nil {
			parentTree, _ = parent.Tree()
		}
	}

	changes, err := object.DiffTree(parentTree, commitTree)
	if err != nil {
		return nil, fmt.Errorf("source control: diff tree: %w", err)
	}

	var diffs []GitCommitFileDiff
	for _, change := range changes {
		before := readBlobContent(repo, change.From.TreeEntry.Hash)
		after := readBlobContent(repo, change.To.TreeEntry.Hash)

		path := change.To.Name
		if path == "" {
			path = change.From.Name
		}
		diffs = append(diffs, GitCommitFileDiff{
			Path:   path,
			Before: before,
			After:  after,
		})
	}
	return diffs, nil
}

func (s *SourceControlService) GetWorkingFileDiff(repoPath, filePath string, staged bool) (GitCommitFileDiff, error) {
	repo, err := s.openRepo(repoPath)
	if err != nil {
		return GitCommitFileDiff{}, err
	}

	normalizedPath, err := normalizeRepoRelativePath(filePath)
	if err != nil {
		return GitCommitFileDiff{}, err
	}

	before := ""
	after := ""

	if staged {
		// Staged view compares HEAD (before) against index (after).
		before = readHeadFileContent(repo, normalizedPath)
		after = readIndexFileContent(repo, normalizedPath)
	} else {
		// Unstaged view compares index (before) against working tree (after).
		before = readIndexFileContent(repo, normalizedPath)
		after = readWorkingTreeFileContent(repoPath, normalizedPath)
	}

	return GitCommitFileDiff{
		Path:   normalizedPath,
		Before: before,
		After:  after,
	}, nil
}

func normalizeRepoRelativePath(filePath string) (string, error) {
	path := strings.TrimSpace(strings.ReplaceAll(filePath, "\\", "/"))
	if path == "" {
		return "", fmt.Errorf("source control: empty file path")
	}
	cleaned := strings.TrimPrefix(pathpkg.Clean("/"+path), "/")
	if cleaned == "." || cleaned == "" || strings.HasPrefix(cleaned, "../") || cleaned == ".." {
		return "", fmt.Errorf("source control: invalid file path %q", filePath)
	}
	return cleaned, nil
}

func readHeadFileContent(repo *git.Repository, filePath string) string {
	head, err := repo.Head()
	if err != nil {
		return ""
	}
	commit, err := repo.CommitObject(head.Hash())
	if err != nil {
		return ""
	}
	tree, err := commit.Tree()
	if err != nil {
		return ""
	}
	file, err := tree.File(filePath)
	if err != nil {
		return ""
	}
	content, err := file.Contents()
	if err != nil {
		return ""
	}
	return content
}

func readIndexFileContent(repo *git.Repository, filePath string) string {
	idx, err := repo.Storer.Index()
	if err != nil || idx == nil {
		return ""
	}
	for _, entry := range idx.Entries {
		if entry.Name == filePath {
			return readBlobContent(repo, entry.Hash)
		}
	}
	return ""
}

func readWorkingTreeFileContent(repoPath, filePath string) string {
	fullPath := filepath.Join(repoPath, filepath.FromSlash(filePath))
	content, err := os.ReadFile(fullPath)
	if err != nil {
		return ""
	}
	return string(content)
}

func readBlobContent(repo *git.Repository, hash plumbing.Hash) string {
	if hash.IsZero() {
		return ""
	}
	blob, err := repo.BlobObject(hash)
	if err != nil {
		return ""
	}
	r, err := blob.Reader()
	if err != nil {
		return ""
	}
	defer r.Close()
	var sb strings.Builder
	buf := make([]byte, 32*1024)
	for {
		n, e := r.Read(buf)
		if n > 0 {
			sb.Write(buf[:n])
		}
		if e != nil {
			break
		}
	}
	return sb.String()
}
