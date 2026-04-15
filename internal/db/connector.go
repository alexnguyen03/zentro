// Package db provides a Facade over the registered database drivers.
// Pattern: Facade — hides driver dispatch complexity from the UI layer.
// Pattern: Dependency Inversion — depends on core.Get (abstraction), not concrete drivers.
package db

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"zentro/internal/core"
	"zentro/internal/models"
)

// OpenConnection opens a *sql.DB by delegating to the registered driver.
// Pattern: Facade + DI — no driver-specific imports here.
func OpenConnection(p *models.ConnectionProfile) (*sql.DB, error) {
	d, ok := core.Get(p.Driver)
	if !ok {
		return nil, fmt.Errorf("connector: unsupported driver %q", p.Driver)
	}
	db, err := d.Open(p)
	if err != nil {
		return nil, err
	}

	// Connection policy (hard-cap): keep server sessions low per app instance.
	db.SetMaxOpenConns(2)
	db.SetMaxIdleConns(1)
	db.SetConnMaxIdleTime(2 * time.Minute)
	db.SetConnMaxLifetime(5 * time.Minute)

	return db, nil
}

// TestConnection verifies a connection is reachable via Ping (10s timeout).
func TestConnection(p *models.ConnectionProfile) error {
	db, err := OpenConnection(p)
	if err != nil {
		return FriendlyError(p.Driver, err)
	}
	defer db.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		return FriendlyError(p.Driver, err)
	}
	return nil
}

// FriendlyError translates a raw driver error to a user-facing message.
// Delegates to the driver's own error mapper; falls back to a generic message.
func FriendlyError(driverName string, err error) error {
	if err == nil {
		return nil
	}
	d, ok := core.Get(driverName)
	if !ok {
		return fmt.Errorf("connection error: %s", err.Error())
	}
	return d.FriendlyError(err)
}
