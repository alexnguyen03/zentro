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
	FetchDatabases(ctx context.Context, db *sql.DB, currentDB string, showAllSchemas bool, logger *slog.Logger) ([]*models.DatabaseInfo, error)
	// FetchSchema returns schemas+tables+views for the currently connected database.
	FetchSchema(ctx context.Context, db *sql.DB, showAllSchemas bool, logger *slog.Logger) ([]*models.SchemaNode, error)
	// FetchTablePrimaryKeys returns the primary key columns for a given table.
	FetchTablePrimaryKeys(ctx context.Context, db *sql.DB, schema, table string) ([]string, error)
	// FetchTableColumns returns detailed column definitions for a given table.
	FetchTableColumns(ctx context.Context, db *sql.DB, schema, table string) ([]*models.ColumnDef, error)
	// AlterTableColumn applies changes to a column definition via driver-specific DDL.
	AlterTableColumn(ctx context.Context, db *sql.DB, schema, table string, old, updated *models.ColumnDef) error
	// AddTableColumn appends a new column to a table via driver-specific DDL.
	AddTableColumn(ctx context.Context, db *sql.DB, schema, table string, col *models.ColumnDef) error
	// DropTableColumn removes a column from a table via driver-specific DDL.
	DropTableColumn(ctx context.Context, db *sql.DB, schema, table, column string) error
	// ReorderTableColumns reorders columns in the given table to match the provided name order.
	ReorderTableColumns(ctx context.Context, db *sql.DB, schema, table string, newOrder []string) error
}

// QueryDialect is the Port for SQL dialect differences (pagination, schema defaults).
type QueryDialect interface {
	InjectPageClause(query string, limit, offset int) string
	DefaultSchema() string
}

// DatabaseDriver is the full extension point: Connector + SchemaFetcher + QueryDialect.
// Callers that only need connection should accept Connector; only schema → SchemaFetcher.
type DatabaseDriver interface {
	Connector
	SchemaFetcher
	QueryDialect
}
