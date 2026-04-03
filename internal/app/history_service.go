package app

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"zentro/internal/models"
)

const maxHistoryEntries = 500

type HistoryService struct {
	mu         sync.Mutex
	entries    []models.HistoryEntry
	getProfile func() *models.ConnectionProfile
	getProject func() *models.Project
	getEnvKey  func() string
}

func NewHistoryService(
	getProfile func() *models.ConnectionProfile,
	getProject func() *models.Project,
	getEnvKey func() string,
) *HistoryService {
	return &HistoryService{
		getProfile: getProfile,
		getProject: getProject,
		getEnvKey:  getEnvKey,
	}
}

func (s *HistoryService) AppendEntry(query string, rowCount int64, duration time.Duration, err error) {
	profile := ""
	db := ""
	if p := s.getProfile(); p != nil {
		profile = p.Name
		db = p.DBName
	}

	errStr := ""
	if err != nil {
		errStr = err.Error()
	}

	e := models.HistoryEntry{
		ID:         fmt.Sprintf("%d", time.Now().UnixNano()),
		Query:      query,
		Profile:    profile,
		Database:   db,
		DurationMs: duration.Milliseconds(),
		RowCount:   rowCount,
		Error:      errStr,
		ExecutedAt: time.Now().Format(time.RFC3339),
	}
	if s.getProject != nil {
		if project := s.getProject(); project != nil {
			e.ProjectID = project.ID
		}
	}
	if s.getEnvKey != nil {
		e.EnvKey = s.getEnvKey()
	}

	s.mu.Lock()
	s.entries = append([]models.HistoryEntry{e}, s.entries...) // newest first
	if len(s.entries) > maxHistoryEntries {
		s.entries = s.entries[:maxHistoryEntries]
	}
	toSave := make([]models.HistoryEntry, len(s.entries))
	copy(toSave, s.entries)
	s.mu.Unlock()

	_ = s.saveHistoryFile(toSave)
}

func (s *HistoryService) GetHistory() []models.HistoryEntry {
	s.mu.Lock()
	if s.entries == nil {
		s.mu.Unlock()
		loaded, _ := s.loadHistoryFile()
		s.mu.Lock()
		s.entries = loaded
	}
	out := make([]models.HistoryEntry, len(s.entries))
	copy(out, s.entries)
	s.mu.Unlock()
	return out
}

func (s *HistoryService) ClearHistory() error {
	s.mu.Lock()
	s.entries = nil
	s.mu.Unlock()

	p, err := s.historyFilePath()
	if err != nil {
		return err
	}
	if err := os.Remove(p); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

func (s *HistoryService) historyFilePath() (string, error) {
	if s.getProject != nil {
		if project := s.getProject(); project != nil && project.StoragePath != "" {
			dir := filepath.Join(project.StoragePath, trackingDirName, "runtime")
			if err := os.MkdirAll(dir, 0o755); err != nil {
				return "", err
			}
			return filepath.Join(dir, "history.json"), nil
		}
	}

	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "zentro", "history.json"), nil
}

func (s *HistoryService) saveHistoryFile(entries []models.HistoryEntry) error {
	p, err := s.historyFilePath()
	if err != nil {
		return err
	}
	_ = os.MkdirAll(filepath.Dir(p), 0o755)
	f, err := os.Create(p)
	if err != nil {
		return err
	}
	defer f.Close()
	return json.NewEncoder(f).Encode(entries)
}

func (s *HistoryService) loadHistoryFile() ([]models.HistoryEntry, error) {
	p, err := s.historyFilePath()
	if err != nil {
		return nil, err
	}
	f, err := os.Open(p)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	var entries []models.HistoryEntry
	if err := json.NewDecoder(f).Decode(&entries); err != nil {
		return nil, err
	}
	return entries, nil
}
