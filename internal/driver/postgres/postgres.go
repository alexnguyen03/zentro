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
	// Log masked DSN for debugging (password replaced)
	masked := fmt.Sprintf(
		"postgres://%s:***@%s:%d/%s?sslmode=%s&connect_timeout=%d",
		user, p.Host, p.Port, p.DBName, p.SSLMode, p.ConnectTimeout,
	)
	slog.Info("postgres: open", "dsn", masked)

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
	// Resolve actual DB name
	actualDB := currentDB
	if err := db.QueryRowContext(ctx, "SELECT current_database()").Scan(&actualDB); err != nil {
		logger.Warn("current_database() failed, using profile DBName", "fallback", currentDB, "err", err)
		actualDB = currentDB
	}
	logger.Info("postgres FetchDatabases",
		"profile_dbname", currentDB,
		"actual_current_db", actualDB,
	)

	dbInfos := d.listDatabases(ctx, db, actualDB, logger)

	// Fetch schemas for the currently connected DB only (others are lazy)
	for _, info := range dbInfos {
		if info.Name == actualDB {
			schemas, err := d.FetchSchema(ctx, db, logger)
			if err != nil {
				logger.Warn("fetch schemas failed", "db", actualDB, "err", err)
			} else {
				info.Schemas = schemas
				logger.Info("schemas fetched for current db", "db", actualDB, "schema_count", len(schemas))
			}
			break
		}
	}
	logger.Info("FetchDatabases returning", "total_dbs", len(dbInfos))
	return dbInfos, nil
}

// listDatabases queries all visible databases using pg_database.
// Some poolers (Neon, PgBouncer in transaction mode) restrict pg_database access;
// in that case it falls back to just the current database.
func (d *PostgresDriver) listDatabases(ctx context.Context, db *sql.DB, actualDB string, logger *slog.Logger) []*models.DatabaseInfo {
	rows, err := db.QueryContext(ctx, `
		SELECT datname
		FROM   pg_database
		WHERE  datistemplate = false
		ORDER  BY datname
	`)
	if err != nil {
		logger.Warn("pg_database query failed, falling back to current DB only",
			"current_db", actualDB,
			"err", err,
		)
		return []*models.DatabaseInfo{{Name: actualDB}}
	}
	defer rows.Close()

	var infos []*models.DatabaseInfo
	for rows.Next() {
		var name string
		if rows.Scan(&name) == nil {
			infos = append(infos, &models.DatabaseInfo{Name: name})
			logger.Info("pg_database row", "db", name)
		}
	}

	names := make([]string, len(infos))
	for i, di := range infos {
		names[i] = di.Name
	}
	logger.Info("pg_database list", "count", len(infos), "databases", names)

	// Ensure actualDB is always in the list (poolers sometimes omit it)
	found := false
	for _, di := range infos {
		if di.Name == actualDB {
			found = true
			break
		}
	}
	if !found {
		logger.Warn("actual_db NOT in pg_database list — prepending it",
			"actual_db", actualDB,
			"pg_database_returned", names,
		)
		infos = append([]*models.DatabaseInfo{{Name: actualDB}}, infos...)
	}
	return infos
}

// FetchSchema returns all user schemas with all 9 object categories populated.
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

	var schemaNames []string
	for schemaRows.Next() {
		var name string
		if schemaRows.Scan(&name) == nil {
			schemaNames = append(schemaNames, name)
		}
	}

	nodes := make([]*models.SchemaNode, 0, len(schemaNames))
	for _, schema := range schemaNames {
		node := models.NewSchemaNode(schema)
		d.populateSchema(ctx, db, schema, node, logger)
		nodes = append(nodes, node)
	}
	return nodes, nil
}

// populateSchema fills all object categories for a single schema.
// Errors per-category are logged and skipped — not fatal.
func (d *PostgresDriver) populateSchema(ctx context.Context, db *sql.DB, schema string, node *models.SchemaNode, logger *slog.Logger) {
	// ── Tables & Foreign Tables ──────────────────────────────────────────
	rows, err := db.QueryContext(ctx, `
		SELECT table_name, table_type
		FROM information_schema.tables
		WHERE table_schema = $1
		  AND table_type IN ('BASE TABLE', 'FOREIGN')
		ORDER BY table_name
	`, schema)
	if err != nil {
		logger.Warn("schema: list tables failed", "schema", schema, "err", err)
	} else {
		for rows.Next() {
			var name, typ string
			if rows.Scan(&name, &typ) == nil {
				if typ == "FOREIGN" {
					node.ForeignTables = append(node.ForeignTables, name)
				} else {
					node.Tables = append(node.Tables, name)
				}
			}
		}
		rows.Close()
	}

	// ── Views ────────────────────────────────────────────────────────────
	rows, err = db.QueryContext(ctx, `
		SELECT table_name FROM information_schema.views
		WHERE table_schema = $1 ORDER BY table_name
	`, schema)
	if err != nil {
		logger.Warn("schema: list views failed", "schema", schema, "err", err)
	} else {
		for rows.Next() {
			var name string
			if rows.Scan(&name) == nil {
				node.Views = append(node.Views, name)
			}
		}
		rows.Close()
	}

	// ── Materialized Views ───────────────────────────────────────────────
	rows, err = db.QueryContext(ctx, `
		SELECT matviewname FROM pg_matviews
		WHERE schemaname = $1 ORDER BY matviewname
	`, schema)
	if err != nil {
		logger.Warn("schema: list matviews failed", "schema", schema, "err", err)
	} else {
		for rows.Next() {
			var name string
			if rows.Scan(&name) == nil {
				node.MaterializedViews = append(node.MaterializedViews, name)
			}
		}
		rows.Close()
	}

	// ── Indexes ──────────────────────────────────────────────────────────
	rows, err = db.QueryContext(ctx, `
		SELECT indexname FROM pg_indexes
		WHERE schemaname = $1 ORDER BY indexname
	`, schema)
	if err != nil {
		logger.Warn("schema: list indexes failed", "schema", schema, "err", err)
	} else {
		for rows.Next() {
			var name string
			if rows.Scan(&name) == nil {
				node.Indexes = append(node.Indexes, name)
			}
		}
		rows.Close()
	}

	// ── Functions (non-aggregate, non-procedure) ─────────────────────────
	rows, err = db.QueryContext(ctx, `
		SELECT p.proname
		FROM pg_proc p
		JOIN pg_namespace n ON n.oid = p.pronamespace
		WHERE n.nspname = $1 AND p.prokind = 'f'
		ORDER BY p.proname
	`, schema)
	if err != nil {
		logger.Warn("schema: list functions failed", "schema", schema, "err", err)
	} else {
		for rows.Next() {
			var name string
			if rows.Scan(&name) == nil {
				node.Functions = append(node.Functions, name)
			}
		}
		rows.Close()
	}

	// ── Sequences ────────────────────────────────────────────────────────
	rows, err = db.QueryContext(ctx, `
		SELECT sequence_name FROM information_schema.sequences
		WHERE sequence_schema = $1 ORDER BY sequence_name
	`, schema)
	if err != nil {
		logger.Warn("schema: list sequences failed", "schema", schema, "err", err)
	} else {
		for rows.Next() {
			var name string
			if rows.Scan(&name) == nil {
				node.Sequences = append(node.Sequences, name)
			}
		}
		rows.Close()
	}

	// ── Data Types (composite + enum) ────────────────────────────────────
	rows, err = db.QueryContext(ctx, `
		SELECT t.typname
		FROM pg_type t
		JOIN pg_namespace n ON n.oid = t.typnamespace
		WHERE n.nspname = $1
		  AND t.typtype IN ('c', 'e')
		  AND (t.typrelid = 0 OR EXISTS (
		      SELECT 1 FROM pg_class c
		      WHERE c.oid = t.typrelid AND c.relkind = 'c'
		  ))
		ORDER BY t.typname
	`, schema)
	if err != nil {
		logger.Warn("schema: list types failed", "schema", schema, "err", err)
	} else {
		for rows.Next() {
			var name string
			if rows.Scan(&name) == nil {
				node.DataTypes = append(node.DataTypes, name)
			}
		}
		rows.Close()
	}

	// ── Aggregate Functions ──────────────────────────────────────────────
	rows, err = db.QueryContext(ctx, `
		SELECT p.proname
		FROM pg_proc p
		JOIN pg_namespace n ON n.oid = p.pronamespace
		WHERE n.nspname = $1 AND p.prokind = 'a'
		ORDER BY p.proname
	`, schema)
	if err != nil {
		logger.Warn("schema: list aggregates failed", "schema", schema, "err", err)
	} else {
		for rows.Next() {
			var name string
			if rows.Scan(&name) == nil {
				node.AggregateFunctions = append(node.AggregateFunctions, name)
			}
		}
		rows.Close()
	}

	logger.Info("schema populated",
		"schema", schema,
		"tables", len(node.Tables),
		"foreign_tables", len(node.ForeignTables),
		"views", len(node.Views),
		"matviews", len(node.MaterializedViews),
		"indexes", len(node.Indexes),
		"functions", len(node.Functions),
		"sequences", len(node.Sequences),
		"types", len(node.DataTypes),
		"aggregates", len(node.AggregateFunctions),
	)
}

func containsAny(s string, subs ...string) bool {
	for _, sub := range subs {
		if strings.Contains(s, sub) {
			return true
		}
	}
	return false
}
