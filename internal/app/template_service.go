package app

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"

	"zentro/internal/models"
)

type TemplateService struct {
	mu        sync.Mutex
	templates []models.Template
}

func NewTemplateService() *TemplateService {
	return &TemplateService{}
}

func (s *TemplateService) LoadTemplates() ([]models.Template, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.templates == nil {
		loaded, err := s.loadFromFile()
		if err != nil && !os.IsNotExist(err) {
			return nil, err
		}
		if loaded == nil {
			s.templates = []models.Template{}
		} else {
			s.templates = loaded
		}
	}

	out := make([]models.Template, len(s.templates))
	copy(out, s.templates)
	return out, nil
}

func (s *TemplateService) SaveTemplate(t models.Template) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Ensure templates are loaded
	if s.templates == nil {
		loaded, _ := s.loadFromFile()
		if loaded == nil {
			s.templates = []models.Template{}
		} else {
			s.templates = loaded
		}
	}

	if t.ID == "" {
		t.ID = time.Now().Format("20060102150405.000000")
		s.templates = append(s.templates, t)
	} else {
		found := false
		for i, existing := range s.templates {
			if existing.ID == t.ID {
				s.templates[i] = t
				found = true
				break
			}
		}
		if !found {
			s.templates = append(s.templates, t)
		}
	}

	return s.saveToFile()
}

func (s *TemplateService) DeleteTemplate(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.templates == nil {
		// Just try to load so we have state to modify
		s.templates, _ = s.loadFromFile()
	}

	newTemplates := []models.Template{}
	for _, t := range s.templates {
		if t.ID != id {
			newTemplates = append(newTemplates, t)
		}
	}
	s.templates = newTemplates

	return s.saveToFile()
}

func (s *TemplateService) filePath() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "zentro", "templates.json"), nil
}

func (s *TemplateService) saveToFile() error {
	p, err := s.filePath()
	if err != nil {
		return err
	}
	_ = os.MkdirAll(filepath.Dir(p), 0o755)
	f, err := os.Create(p)
	if err != nil {
		return err
	}
	defer f.Close()
	return json.NewEncoder(f).Encode(s.templates)
}

func (s *TemplateService) loadFromFile() ([]models.Template, error) {
	p, err := s.filePath()
	if err != nil {
		return nil, err
	}
	f, err := os.Open(p)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	var templates []models.Template
	if err := json.NewDecoder(f).Decode(&templates); err != nil {
		return nil, err
	}
	return templates, nil
}
