// Package driver defines the extension points (Ports) for database drivers.
// Pattern: Hexagonal / Ports & Adapters — interfaces are Ports; implementations are Adapters.
// Pattern: Interface Segregation — three focused interfaces instead of one fat interface.
package driver

import (
	"context"
	"database/sql"
	"log/slog"

	"zentro/internal/models"
)

// Connector is the Port for opening database connections.
// Pattern: Dependency Inversion — callers depend on this abstraction, not concrete drivers.
type Connector interface {
	// Name returns the driver identifier ("postgres", "sqlserver", etc.).
	Name() string
	// Open creates and configures a *sql.DB from a connection profile.
	Open(p *models.ConnectionProfile) (*sql.DB, error)
	// FriendlyError translates a raw driver error to a user-facing message.
	FriendlyError(err error) error
}

// SchemaFetcher is the Port for reading database structure.
type SchemaFetcher interface {
	// FetchDatabases returns all databases on the server plus schemas for currentDB.
	FetchDatabases(ctx context.Context, db *sql.DB, currentDB string, logger *slog.Logger) ([]*models.DatabaseInfo, error)
	// FetchSchema returns schemas+tables+views for the currently connected database.
	FetchSchema(ctx context.Context, db *sql.DB, logger *slog.Logger) ([]*models.SchemaNode, error)
}

// DatabaseDriver is the full extension point: Connector + SchemaFetcher.
// Callers that only need connection should accept Connector; only schema → SchemaFetcher.
type DatabaseDriver interface {
	Connector
	SchemaFetcher
}
