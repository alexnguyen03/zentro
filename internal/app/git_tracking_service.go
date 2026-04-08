package app

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/object"

	"zentro/internal/models"
)

const (
	trackingDirName        = ".zentro-tracking"
	trackingConfigFileName = "tracking-config.json"
)

type trackingConfig struct {
	Version   int    `json:"version"`
	Enabled   bool   `json:"enabled"`
	UpdatedAt string `json:"updated_at"`
}

type GitTrackingService struct {
	mu     sync.RWMutex
	opMu   sync.Mutex
	logger *slog.Logger
}

func NewGitTrackingService(logger *slog.Logger) *GitTrackingService {
	return &GitTrackingService{logger: logger}
}

func (s *GitTrackingService) SetLogger(logger *slog.Logger) {
	s.mu.Lock()
	s.logger = logger
	s.mu.Unlock()
}

func (s *GitTrackingService) Close() {}

func (s *GitTrackingService) logWarn(msg string, args ...any) {
	s.mu.RLock()
	logger := s.logger
	s.mu.RUnlock()
	if logger != nil {
		logger.Warn(msg, args...)
	}
}

func (s *GitTrackingService) logInfo(msg string, args ...any) {
	s.mu.RLock()
	logger := s.logger
	s.mu.RUnlock()
	if logger != nil {
		logger.Info(msg, args...)
	}
}

func (s *GitTrackingService) repoRoot(project *models.Project) (string, error) {
	if project == nil {
		return "", fmt.Errorf("tracking: active project is required")
	}
	storage := strings.TrimSpace(project.StoragePath)
	if storage == "" {
		return "", fmt.Errorf("tracking: project storage path is empty")
	}
	return filepath.Join(storage, trackingDirName), nil
}

func (s *GitTrackingService) ensureRepo(repoRoot string) (*git.Repository, error) {
	if err := os.MkdirAll(repoRoot, 0o755); err != nil {
		return nil, err
	}
	if err := s.ensureTrackingConfig(repoRoot, true); err != nil {
		return nil, err
	}

	repo, err := git.PlainOpen(repoRoot)
	if err == nil {
		return repo, nil
	}
	if !errors.Is(err, git.ErrRepositoryNotExists) {
		return nil, err
	}

	repo, err = git.PlainInit(repoRoot, false)
	if err != nil {
		return nil, err
	}
	return repo, nil
}

func (s *GitTrackingService) ensureTrackingConfig(repoRoot string, enabled bool) error {
	path := filepath.Join(repoRoot, trackingConfigFileName)
	if _, err := os.Stat(path); err == nil {
		return nil
	} else if !os.IsNotExist(err) {
		return err
	}
	cfg := trackingConfig{Version: 1, Enabled: enabled, UpdatedAt: time.Now().UTC().Format(time.RFC3339)}
	return writeJSON(path, cfg)
}

func (s *GitTrackingService) readTrackingConfig(repoRoot string) (trackingConfig, error) {
	path := filepath.Join(repoRoot, trackingConfigFileName)
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return trackingConfig{Version: 1, Enabled: true}, nil
	}
	if err != nil {
		return trackingConfig{}, err
	}
	var cfg trackingConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return trackingConfig{}, err
	}
	if cfg.Version == 0 {
		cfg.Version = 1
	}
	return cfg, nil
}

func (s *GitTrackingService) setTrackingEnabled(repoRoot string, enabled bool) error {
	cfg, err := s.readTrackingConfig(repoRoot)
	if err != nil {
		return err
	}
	cfg.Enabled = enabled
	cfg.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	return writeJSON(filepath.Join(repoRoot, trackingConfigFileName), cfg)
}

func (s *GitTrackingService) isEnabled(repoRoot string) bool {
	cfg, err := s.readTrackingConfig(repoRoot)
	if err != nil {
		s.logWarn("tracking: read config failed", "repo", repoRoot, "err", err)
		return false
	}
	return cfg.Enabled
}

func (s *GitTrackingService) BindProject(project *models.Project) error {
	repoRoot, err := s.repoRoot(project)
	if err != nil {
		return err
	}
	s.opMu.Lock()
	defer s.opMu.Unlock()
	_, err = s.ensureRepo(repoRoot)
	return err
}

func (s *GitTrackingService) Enable(project *models.Project) error {
	repoRoot, err := s.repoRoot(project)
	if err != nil {
		return err
	}
	s.opMu.Lock()
	defer s.opMu.Unlock()
	if _, err := s.ensureRepo(repoRoot); err != nil {
		return err
	}
	if err := s.setTrackingEnabled(repoRoot, true); err != nil {
		return err
	}
	_, err = s.commitAllLocked(repoRoot, "tracking.enable: set enabled=true")
	return err
}

func (s *GitTrackingService) Disable(project *models.Project) error {
	repoRoot, err := s.repoRoot(project)
	if err != nil {
		return err
	}
	s.opMu.Lock()
	defer s.opMu.Unlock()
	if _, err := s.ensureRepo(repoRoot); err != nil {
		return err
	}
	if err := s.setTrackingEnabled(repoRoot, false); err != nil {
		return err
	}
	_, err = s.commitAllLocked(repoRoot, "tracking.disable: set enabled=false")
	return err
}

func (s *GitTrackingService) GetStatus(project *models.Project) (GitTrackingStatus, error) {
	repoRoot, err := s.repoRoot(project)
	if err != nil {
		return GitTrackingStatus{}, err
	}
	status := GitTrackingStatus{RepoPath: repoRoot, ProjectID: project.ID}

	cfg, cfgErr := s.readTrackingConfig(repoRoot)
	if cfgErr == nil {
		status.Enabled = cfg.Enabled
	} else {
		status.Enabled = false
		status.LastError = cfgErr.Error()
	}

	repo, err := git.PlainOpen(repoRoot)
	if errors.Is(err, git.ErrRepositoryNotExists) {
		status.Initialized = false
		return status, nil
	}
	if err != nil {
		status.LastError = err.Error()
		return status, nil
	}
	status.Initialized = true

	ref, err := repo.Head()
	if err == nil {
		status.LastCommitHash = ref.Hash().String()
	}

	wt, wtErr := repo.Worktree()
	if wtErr == nil {
		ws, stErr := wt.Status()
		if stErr == nil {
			status.PendingCount = len(changedFilesFromStatus(ws))
		}
	}

	return status, nil
}

func (s *GitTrackingService) GetPendingChanges(project *models.Project) ([]string, error) {
	repoRoot, err := s.repoRoot(project)
	if err != nil {
		return nil, err
	}
	repo, err := git.PlainOpen(repoRoot)
	if errors.Is(err, git.ErrRepositoryNotExists) {
		return []string{}, nil
	}
	if err != nil {
		return nil, err
	}
	wt, err := repo.Worktree()
	if err != nil {
		return nil, err
	}
	status, err := wt.Status()
	if err != nil {
		return nil, err
	}
	return changedFilesFromStatus(status), nil
}

func (s *GitTrackingService) ListTimeline(project *models.Project, limit int, eventType string) ([]GitTimelineItem, error) {
	repoRoot, err := s.repoRoot(project)
	if err != nil {
		return nil, err
	}
	repo, err := git.PlainOpen(repoRoot)
	if errors.Is(err, git.ErrRepositoryNotExists) {
		return []GitTimelineItem{}, nil
	}
	if err != nil {
		return nil, err
	}
	if limit <= 0 {
		limit = 100
	}
	if _, err := repo.Head(); err != nil {
		if errors.Is(err, plumbing.ErrReferenceNotFound) || strings.Contains(strings.ToLower(err.Error()), "reference not found") {
			return []GitTimelineItem{}, nil
		}
		return nil, err
	}

	iter, err := repo.Log(&git.LogOptions{})
	if err != nil {
		return nil, err
	}
	defer iter.Close()

	items := make([]GitTimelineItem, 0, limit)
	for len(items) < limit {
		commit, nextErr := iter.Next()
		if errors.Is(nextErr, io.EOF) {
			break
		}
		if nextErr != nil {
			return nil, nextErr
		}
		message := strings.TrimSpace(commit.Message)
		evt := parseEventType(message)
		if eventType != "" && !strings.EqualFold(eventType, evt) {
			continue
		}
		files, _ := changedFilesForCommit(commit)
		items = append(items, GitTimelineItem{
			Hash:      commit.Hash.String(),
			Message:   message,
			EventType: evt,
			Author:    commit.Committer.Name,
			When:      commit.Committer.When.UTC().Format(time.RFC3339),
			Files:     files,
		})
	}
	return items, nil
}

func parseEventType(message string) string {
	trimmed := strings.TrimSpace(message)
	if trimmed == "" {
		return "tracking.update"
	}
	parts := strings.SplitN(trimmed, ":", 2)
	return strings.TrimSpace(parts[0])
}

func changedFilesForCommit(commit *object.Commit) ([]string, error) {
	if commit == nil {
		return []string{}, nil
	}
	if commit.NumParents() == 0 {
		tree, err := commit.Tree()
		if err != nil {
			return nil, err
		}
		files := []string{}
		err = tree.Files().ForEach(func(file *object.File) error {
			files = append(files, file.Name)
			return nil
		})
		sort.Strings(files)
		return files, err
	}
	parent, err := commit.Parent(0)
	if err != nil {
		return nil, err
	}
	patch, err := parent.Patch(commit)
	if err != nil {
		return nil, err
	}
	stats := patch.Stats()
	files := make([]string, 0, len(stats))
	for _, stat := range stats {
		files = append(files, stat.Name)
	}
	sort.Strings(files)
	return files, nil
}

func (s *GitTrackingService) GetCommitDiff(project *models.Project, commitHash string) (string, error) {
	repoRoot, err := s.repoRoot(project)
	if err != nil {
		return "", err
	}
	repo, err := git.PlainOpen(repoRoot)
	if err != nil {
		return "", err
	}

	commit, err := repo.CommitObject(plumbing.NewHash(strings.TrimSpace(commitHash)))
	if err != nil {
		return "", err
	}

	var patch *object.Patch
	if commit.NumParents() == 0 {
		patch, err = commit.Patch(nil)
	} else {
		parent, parentErr := commit.Parent(0)
		if parentErr != nil {
			return "", parentErr
		}
		patch, err = parent.Patch(commit)
	}
	if err != nil {
		return "", err
	}
	return patch.String(), nil
}

func (s *GitTrackingService) GetCommitFileDiffs(project *models.Project, commitHash string) ([]GitCommitFileDiff, error) {
	repoRoot, err := s.repoRoot(project)
	if err != nil {
		return nil, err
	}
	repo, err := git.PlainOpen(repoRoot)
	if err != nil {
		return nil, err
	}

	commit, err := repo.CommitObject(plumbing.NewHash(strings.TrimSpace(commitHash)))
	if err != nil {
		return nil, err
	}

	commitTree, err := commit.Tree()
	if err != nil {
		return nil, err
	}

	var parentTree *object.Tree
	if commit.NumParents() > 0 {
		parent, parentErr := commit.Parent(0)
		if parentErr != nil {
			return nil, parentErr
		}
		parentTree, err = parent.Tree()
		if err != nil {
			return nil, err
		}
	}

	changes, err := object.DiffTree(parentTree, commitTree)
	if err != nil {
		return nil, err
	}

	result := make([]GitCommitFileDiff, 0, len(changes))
	for _, change := range changes {
		var before, after string
		if change.From.Name != "" && parentTree != nil {
			if f, fErr := parentTree.File(change.From.Name); fErr == nil {
				before, _ = f.Contents()
			}
		}
		if change.To.Name != "" {
			if f, fErr := commitTree.File(change.To.Name); fErr == nil {
				after, _ = f.Contents()
			}
		}
		path := change.To.Name
		if path == "" {
			path = change.From.Name
		}
		result = append(result, GitCommitFileDiff{Path: path, Before: before, After: after})
	}
	return result, nil
}

func (s *GitTrackingService) RestoreCommit(project *models.Project, commitHash string) error {
	repoRoot, err := s.repoRoot(project)
	if err != nil {
		return err
	}
	if !s.isEnabled(repoRoot) {
		return fmt.Errorf("tracking is disabled")
	}

	s.opMu.Lock()
	defer s.opMu.Unlock()

	repo, err := git.PlainOpen(repoRoot)
	if err != nil {
		return err
	}
	wt, err := repo.Worktree()
	if err != nil {
		return err
	}

	hash := plumbing.NewHash(strings.TrimSpace(commitHash))
	commit, err := repo.CommitObject(hash)
	if err != nil {
		return fmt.Errorf("tracking: commit not found: %w", err)
	}
	tree, err := commit.Tree()
	if err != nil {
		return err
	}

	if err := tree.Files().ForEach(func(f *object.File) error {
		content, readErr := f.Contents()
		if readErr != nil {
			return readErr
		}
		absPath := filepath.Join(repoRoot, filepath.FromSlash(f.Name))
		if mkErr := os.MkdirAll(filepath.Dir(absPath), 0o755); mkErr != nil {
			return mkErr
		}
		return os.WriteFile(absPath, []byte(content), 0o644)
	}); err != nil {
		return fmt.Errorf("tracking: restore files failed: %w", err)
	}

	if err := wt.AddWithOptions(&git.AddOptions{All: true}); err != nil {
		return err
	}

	shortHash := strings.TrimSpace(commitHash)
	if len(shortHash) > 8 {
		shortHash = shortHash[:8]
	}
	msg := fmt.Sprintf("tracking.restore: restored to %s", shortHash)
	_, err = wt.Commit(msg, &git.CommitOptions{
		Author: &object.Signature{
			Name:  "Zentro Tracking",
			Email: "tracking@zentro.local",
			When:  time.Now().UTC(),
		},
	})
	return err
}

func (s *GitTrackingService) TrackScriptSave(project *models.Project, script models.SavedScript, content string) error {
	repoRoot, err := s.repoRoot(project)
	if err != nil {
		return nil
	}
	if !s.isEnabled(repoRoot) {
		return nil
	}

	s.opMu.Lock()
	defer s.opMu.Unlock()

	if _, err := s.ensureRepo(repoRoot); err != nil {
		return err
	}

	relPath := filepath.ToSlash(filepath.Join("scripts", sanitizePathSegment(script.ConnectionName), sanitizePathSegment(script.ID)+".sql"))
	absPath := filepath.Join(repoRoot, filepath.FromSlash(relPath))

	if existing, readErr := os.ReadFile(absPath); readErr == nil {
		if string(existing) == content {
			return nil
		}
	}

	if err := os.MkdirAll(filepath.Dir(absPath), 0o755); err != nil {
		return err
	}
	if err := os.WriteFile(absPath, []byte(content), 0o644); err != nil {
		return err
	}
	return nil
}

func (s *GitTrackingService) TrackScriptDelete(project *models.Project, connectionName, scriptID string) error {
	repoRoot, err := s.repoRoot(project)
	if err != nil {
		return nil
	}
	if !s.isEnabled(repoRoot) {
		return nil
	}

	s.opMu.Lock()
	defer s.opMu.Unlock()

	if _, err := s.ensureRepo(repoRoot); err != nil {
		return err
	}

	relPath := filepath.ToSlash(filepath.Join("scripts", sanitizePathSegment(connectionName), sanitizePathSegment(scriptID)+".sql"))
	absPath := filepath.Join(repoRoot, filepath.FromSlash(relPath))
	_ = os.Remove(absPath)
	return nil
}

func (s *GitTrackingService) ManualCommit(project *models.Project, message string) (GitCommitResult, error) {
	repoRoot, err := s.repoRoot(project)
	if err != nil {
		return GitCommitResult{}, err
	}
	if !s.isEnabled(repoRoot) {
		return GitCommitResult{}, fmt.Errorf("tracking is disabled")
	}

	msg := strings.TrimSpace(message)
	if msg == "" {
		msg = fmt.Sprintf("manual.commit: %s", time.Now().UTC().Format(time.RFC3339))
	} else if !strings.HasPrefix(strings.ToLower(msg), "manual.commit:") {
		msg = fmt.Sprintf("manual.commit: %s", msg)
	}

	s.opMu.Lock()
	defer s.opMu.Unlock()
	if _, err := s.ensureRepo(repoRoot); err != nil {
		return GitCommitResult{}, err
	}
	return s.commitAllLocked(repoRoot, msg)
}

func (s *GitTrackingService) FlushAndCommitOnClose(project *models.Project) error {
	repoRoot, err := s.repoRoot(project)
	if err != nil {
		return err
	}
	if !s.isEnabled(repoRoot) {
		return nil
	}

	s.opMu.Lock()
	defer s.opMu.Unlock()
	if _, err := s.ensureRepo(repoRoot); err != nil {
		return err
	}
	_, err = s.commitAllLocked(repoRoot, "app.close: autosave flush")
	return err
}

func (s *GitTrackingService) commitAllLocked(repoRoot, message string) (GitCommitResult, error) {
	repo, err := git.PlainOpen(repoRoot)
	if err != nil {
		return GitCommitResult{}, err
	}
	wt, err := repo.Worktree()
	if err != nil {
		return GitCommitResult{}, err
	}
	if err := wt.AddWithOptions(&git.AddOptions{All: true}); err != nil {
		return GitCommitResult{}, err
	}
	status, err := wt.Status()
	if err != nil {
		return GitCommitResult{}, err
	}
	files := changedFilesFromStatus(status)
	result := GitCommitResult{
		Message:   strings.TrimSpace(message),
		Files:     files,
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
		NoChanges: len(files) == 0,
	}
	if len(files) == 0 {
		return result, nil
	}
	commitHash, err := wt.Commit(result.Message, &git.CommitOptions{Author: &object.Signature{
		Name:  "Zentro Tracking",
		Email: "tracking@zentro.local",
		When:  time.Now().UTC(),
	}})
	if err != nil {
		return GitCommitResult{}, err
	}
	result.Hash = commitHash.String()
	s.logInfo("tracking: committed", "repo", repoRoot, "message", result.Message, "files", len(result.Files), "hash", result.Hash)
	return result, nil
}

func changedFilesFromStatus(status git.Status) []string {
	if len(status) == 0 {
		return []string{}
	}
	files := make([]string, 0, len(status))
	for path, st := range status {
		if st.Staging == git.Unmodified && st.Worktree == git.Unmodified {
			continue
		}
		files = append(files, path)
	}
	sort.Strings(files)
	return files
}

// Legacy APIs kept for compatibility. They are intentionally no-op in SQL-only v2.
func (s *GitTrackingService) TrackTemplateSave(_ *models.Project, _ models.Template) error {
	return nil
}
func (s *GitTrackingService) TrackTemplateDelete(_ *models.Project, _ string) error { return nil }
func (s *GitTrackingService) TrackBookmarkSave(_ *models.Project, _, _ string, _ models.Bookmark) error {
	return nil
}
func (s *GitTrackingService) TrackBookmarkDelete(_ *models.Project, _, _ string, _ int) error {
	return nil
}
func (s *GitTrackingService) TrackQueryExecution(_ *models.Project, _ string, _ *models.ConnectionProfile, _ QueryExecutionAuditEvent) error {
	return nil
}
func (s *GitTrackingService) TrackStoredProcedureSnapshot(_ *models.Project, _ []StoredProcedureSnapshot) error {
	return nil
}
func (s *GitTrackingService) RunMigration(_ *models.Project) error { return nil }

func sanitizePathSegment(input string) string {
	trimmed := strings.TrimSpace(strings.ToLower(input))
	if trimmed == "" {
		return "unknown"
	}
	var out strings.Builder
	lastDash := false
	for _, r := range trimmed {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '_' {
			out.WriteRune(r)
			lastDash = false
			continue
		}
		if !lastDash {
			out.WriteByte('-')
			lastDash = true
		}
	}
	result := strings.Trim(out.String(), "-")
	if result == "" {
		return "unknown"
	}
	return result
}

func writeJSON(path string, value any) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	data = append(data, '\n')
	return os.WriteFile(path, data, 0o644)
}
