// Package postgres implements the DatabaseDriver port for PostgreSQL.
// Pattern: Adapter (Hexagonal) — adapts pgx/stdlib to the driver.DatabaseDriver interface.
// Pattern: Factory Method — New() returns the interface, hiding the concrete type.
package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"net/url"
	"strings"
	"time"

	"zentro/internal/models"
)

// PostgresDriver is the Adapter for PostgreSQL.
type PostgresDriver struct{}

// New returns a new PostgresDriver as a concrete value.
// Callers receive driver.DatabaseDriver via the registry — they never import this package directly.
func New() *PostgresDriver {
	return &PostgresDriver{}
}

func (d *PostgresDriver) Name() string { return "postgres" }

// Open builds a DSN and opens a *sql.DB with sensible pool defaults.
func (d *PostgresDriver) Open(p *models.ConnectionProfile) (*sql.DB, error) {
	user := url.QueryEscape(p.Username)
	pass := url.QueryEscape(p.Password)
	dsn := fmt.Sprintf(
		"postgres://%s:%s@%s:%d/%s?sslmode=%s&connect_timeout=%d",
		user, pass, p.Host, p.Port, p.DBName, p.SSLMode, p.ConnectTimeout,
	)

	// pgx/v5/stdlib registers as "pgx"
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, fmt.Errorf("postgres: open: %w", err)
	}
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)
	db.SetConnMaxIdleTime(2 * time.Minute)
	return db, nil
}

// FriendlyError maps raw PostgreSQL errors to user-readable messages.
func (d *PostgresDriver) FriendlyError(err error) error {
	if err == nil {
		return nil
	}
	msg := strings.ToLower(err.Error())
	switch {
	case containsAny(msg, "authentication failed", "password authentication failed"):
		return fmt.Errorf("authentication failed — check username and password")
	case containsAny(msg, "connection refused"):
		return fmt.Errorf("connection refused — check host and port")
	case containsAny(msg, "no such host", "name resolution"):
		return fmt.Errorf("host not found — check hostname")
	case containsAny(msg, "context deadline exceeded", "timeout"):
		return fmt.Errorf("connection timed out — check host/port or firewall")
	case containsAny(msg, "database", "does not exist"):
		return fmt.Errorf("database not found — check database name")
	default:
		return fmt.Errorf("postgres error: %s", err.Error())
	}
}

// FetchDatabases lists all databases on the server and fetches schemas for currentDB.
func (d *PostgresDriver) FetchDatabases(ctx context.Context, db *sql.DB, currentDB string, logger *slog.Logger) ([]*models.DatabaseInfo, error) {
	// Resolve actual DB name to handle case mismatches
	actualDB := currentDB
	if err := db.QueryRowContext(ctx, "SELECT current_database()").Scan(&actualDB); err != nil {
		logger.Warn("current_database() failed, using profile DBName", "fallback", currentDB, "err", err)
		actualDB = currentDB
	}
	logger.Info("postgres schema fetch", "profile_dbname", currentDB, "actual_current_db", actualDB)

	rows, err := db.QueryContext(ctx, `
		SELECT datname FROM pg_database
		WHERE datistemplate = false
		ORDER BY datname
	`)

	var dbInfos []*models.DatabaseInfo
	if err != nil {
		logger.Warn("pg_database query failed (pooler restriction?), fallback to current DB only", "err", err, "current_db", actualDB)
		dbInfos = []*models.DatabaseInfo{{Name: actualDB}}
	} else {
		defer rows.Close()
		for rows.Next() {
			var name string
			if rows.Scan(&name) == nil {
				dbInfos = append(dbInfos, &models.DatabaseInfo{Name: name})
			}
		}
		logger.Info("pg_database list", "count", len(dbInfos))

		// Ensure actualDB is present in list
		found := false
		for _, di := range dbInfos {
			if di.Name == actualDB {
				found = true
				break
			}
		}
		if !found {
			logger.Warn("actual_db not in pg_database list, prepending", "actual_db", actualDB)
			dbInfos = append([]*models.DatabaseInfo{{Name: actualDB}}, dbInfos...)
		}
	}

	// Fetch schemas+tables for actualDB
	for _, info := range dbInfos {
		if info.Name == actualDB {
			schemas, err := d.FetchSchema(ctx, db, logger)
			if err != nil {
				logger.Warn("fetch schemas failed", "db", actualDB, "err", err)
			} else {
				info.Schemas = schemas
				logger.Info("schemas fetched", "db", actualDB, "schema_count", len(schemas))
			}
			break
		}
	}
	return dbInfos, nil
}

// FetchSchema returns all non-system schemas with their tables and views.
func (d *PostgresDriver) FetchSchema(ctx context.Context, db *sql.DB, logger *slog.Logger) ([]*models.SchemaNode, error) {
	schemaRows, err := db.QueryContext(ctx, `
		SELECT nspname FROM pg_catalog.pg_namespace
		WHERE nspname NOT IN ('information_schema','pg_catalog','pg_toast')
		AND nspname NOT LIKE 'pg_%'
		ORDER BY nspname
	`)
	if err != nil {
		return nil, fmt.Errorf("postgres: list schemas: %w", err)
	}
	defer schemaRows.Close()

	var schemas []string
	for schemaRows.Next() {
		var name string
		if schemaRows.Scan(&name) == nil {
			schemas = append(schemas, name)
		}
	}

	nodes := make([]*models.SchemaNode, 0, len(schemas))
	for _, schema := range schemas {
		node := &models.SchemaNode{
			Name:   schema,
			Tables: []string{},
			Views:  []string{},
		}
		tableRows, err := db.QueryContext(ctx, `
			SELECT table_name, table_type
			FROM information_schema.tables
			WHERE table_schema = $1
			  AND table_type IN ('BASE TABLE','VIEW')
			ORDER BY table_type DESC, table_name
		`, schema)
		if err != nil {
			logger.Warn("postgres: list tables failed", "schema", schema, "err", err)
			nodes = append(nodes, node)
			continue
		}
		for tableRows.Next() {
			var name, typ string
			if tableRows.Scan(&name, &typ) == nil {
				if typ == "VIEW" {
					node.Views = append(node.Views, name)
				} else {
					node.Tables = append(node.Tables, name)
				}
			}
		}
		tableRows.Close()
		logger.Info("schema tables fetched", "schema", schema, "tables", len(node.Tables), "views", len(node.Views))
		nodes = append(nodes, node)
	}
	return nodes, nil
}

func containsAny(s string, subs ...string) bool {
	for _, sub := range subs {
		if strings.Contains(s, sub) {
			return true
		}
	}
	return false
}
