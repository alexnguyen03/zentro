package plugin

import (
	"errors"
	"sync"
)

var (
	ErrInvalidManifest = errors.New("invalid plugin manifest")
	ErrPluginNotFound  = errors.New("plugin not found")
)

type Registry interface {
	Register(c Contribution) error
	Resolve(id string) (Contribution, bool)
	ListByCapability(capability Capability) []Contribution
	ValidateManifest(manifest Manifest) error
}

type InMemoryRegistry struct {
	mu      sync.RWMutex
	plugins map[string]Contribution
}

func NewInMemoryRegistry() *InMemoryRegistry {
	return &InMemoryRegistry{
		plugins: make(map[string]Contribution),
	}
}

func (r *InMemoryRegistry) Register(c Contribution) error {
	if err := r.ValidateManifest(c.Manifest); err != nil {
		return err
	}

	r.mu.Lock()
	defer r.mu.Unlock()
	r.plugins[c.Manifest.ID] = c
	return nil
}

func (r *InMemoryRegistry) Resolve(id string) (Contribution, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	item, ok := r.plugins[id]
	return item, ok
}

func (r *InMemoryRegistry) ListByCapability(capability Capability) []Contribution {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]Contribution, 0)
	for _, item := range r.plugins {
		for _, c := range item.Manifest.Capabilities {
			if c == capability {
				out = append(out, item)
				break
			}
		}
	}
	return out
}

func (r *InMemoryRegistry) ValidateManifest(manifest Manifest) error {
	if manifest.ID == "" || manifest.Version == "" || manifest.MinAppVersion == "" {
		return ErrInvalidManifest
	}
	return nil
}
