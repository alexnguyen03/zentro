// Package core provides the plugin registry for database drivers.
// Pattern: Singleton — one global registry instance for the application lifetime.
// Pattern: Plugin/Module — open for extension (Register), closed for modification (OCP).
package core

import (
	"sync"

	"zentro/internal/driver"
)

var (
	mu       sync.RWMutex
	registry = map[string]driver.DatabaseDriver{}
)

// Register adds a driver to the global registry.
// Called once at startup in main.go — static DI, no reflection.
func Register(d driver.DatabaseDriver) {
	mu.Lock()
	defer mu.Unlock()
	registry[d.Name()] = d
}

// Get retrieves a driver by name. Returns (driver, true) if found.
// Pattern: Dependency Inversion — callers receive an abstraction, never a concrete type.
func Get(name string) (driver.DatabaseDriver, bool) {
	mu.RLock()
	defer mu.RUnlock()
	d, ok := registry[name]
	return d, ok
}

// All returns every registered driver.
func All() []driver.DatabaseDriver {
	mu.RLock()
	defer mu.RUnlock()
	out := make([]driver.DatabaseDriver, 0, len(registry))
	for _, d := range registry {
		out = append(out, d)
	}
	return out
}
