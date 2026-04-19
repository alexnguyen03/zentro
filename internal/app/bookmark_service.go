package app

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"

	"zentro/internal/models"
)

type bookmarkFile map[string]map[string][]models.Bookmark

type BookmarkService struct {
	mu   sync.Mutex
	data bookmarkFile
}

func NewBookmarkService() *BookmarkService {
	return &BookmarkService{}
}

func (s *BookmarkService) GetBookmarks(connectionID, tabID string) ([]models.Bookmark, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.ensureLoaded(); err != nil {
		return nil, err
	}
	if connectionID == "" || tabID == "" {
		return []models.Bookmark{}, nil
	}

	bookmarks := append([]models.Bookmark(nil), s.data[connectionID][tabID]...)
	sort.Slice(bookmarks, func(i, j int) bool { return bookmarks[i].Line < bookmarks[j].Line })
	return bookmarks, nil
}

func (s *BookmarkService) GetBookmarksByConnection(connectionID string) (map[string][]models.Bookmark, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.ensureLoaded(); err != nil {
		return nil, err
	}
	if connectionID == "" {
		return map[string][]models.Bookmark{}, nil
	}

	result := map[string][]models.Bookmark{}
	for tabID, items := range s.data[connectionID] {
		sorted := append([]models.Bookmark(nil), items...)
		sort.Slice(sorted, func(i, j int) bool { return sorted[i].Line < sorted[j].Line })
		result[tabID] = sorted
	}
	return result, nil
}

func (s *BookmarkService) SaveBookmark(connectionID, tabID string, bookmark models.Bookmark) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if connectionID == "" || tabID == "" {
		return fmt.Errorf("bookmark: connectionID and tabID are required")
	}
	if bookmark.Line <= 0 {
		return fmt.Errorf("bookmark: line must be >= 1")
	}

	if err := s.ensureLoaded(); err != nil {
		return err
	}

	if s.data[connectionID] == nil {
		s.data[connectionID] = map[string][]models.Bookmark{}
	}

	if bookmark.ID == "" {
		bookmark.ID = fmt.Sprintf("%d", time.Now().UnixNano())
	}
	if bookmark.CreatedAt.IsZero() {
		bookmark.CreatedAt = time.Now().UTC()
	}

	items := s.data[connectionID][tabID]
	updated := false
	for i := range items {
		if items[i].Line == bookmark.Line {
			items[i].Label = bookmark.Label
			updated = true
			break
		}
	}
	if !updated {
		items = append(items, bookmark)
	}
	sort.Slice(items, func(i, j int) bool { return items[i].Line < items[j].Line })
	s.data[connectionID][tabID] = items

	return s.saveToFile()
}

func (s *BookmarkService) DeleteBookmark(connectionID, tabID string, line int) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if connectionID == "" || tabID == "" {
		return fmt.Errorf("bookmark: connectionID and tabID are required")
	}
	if line <= 0 {
		return fmt.Errorf("bookmark: line must be >= 1")
	}
	if err := s.ensureLoaded(); err != nil {
		return err
	}

	items := s.data[connectionID][tabID]
	next := make([]models.Bookmark, 0, len(items))
	for _, item := range items {
		if item.Line != line {
			next = append(next, item)
		}
	}
	s.data[connectionID][tabID] = next
	return s.saveToFile()
}

func (s *BookmarkService) ensureLoaded() error {
	if s.data != nil {
		return nil
	}
	loaded, err := s.loadFromFile()
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	if loaded == nil {
		loaded = bookmarkFile{}
	}
	s.data = loaded
	return nil
}

func (s *BookmarkService) filePath() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "zentro", "bookmarks.json"), nil
}

func (s *BookmarkService) saveToFile() error {
	path, err := s.filePath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	return json.NewEncoder(f).Encode(s.data)
}

func (s *BookmarkService) loadFromFile() (bookmarkFile, error) {
	path, err := s.filePath()
	if err != nil {
		return nil, err
	}
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	var data bookmarkFile
	if err := json.NewDecoder(f).Decode(&data); err != nil {
		return nil, err
	}
	return data, nil
}
