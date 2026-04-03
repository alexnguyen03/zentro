package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"

	"zentro/internal/models"
)

// FetchDatabases lists all databases on the server and fetches schemas for currentDB.
func (d *PostgresDriver) FetchDatabases(ctx context.Context, db *sql.DB, currentDB string, showAllSchemas bool, logger *slog.Logger) ([]*models.DatabaseInfo, error) {
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

	for _, info := range dbInfos {
		if info.Name == actualDB {
			schemas, err := d.FetchSchema(ctx, db, showAllSchemas, logger)
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

	found := false
	for _, di := range infos {
		if di.Name == actualDB {
			found = true
			break
		}
	}
	if !found {
		logger.Warn("actual_db NOT in pg_database list â€” prepending it",
			"actual_db", actualDB,
			"pg_database_returned", names,
		)
		infos = append([]*models.DatabaseInfo{{Name: actualDB}}, infos...)
	}
	return infos
}

// FetchSchema returns all user schemas with all 9 object categories populated.
func (d *PostgresDriver) FetchSchema(ctx context.Context, db *sql.DB, showAllSchemas bool, logger *slog.Logger) ([]*models.SchemaNode, error) {
	var query string
	if showAllSchemas {
		query = `SELECT nspname FROM pg_catalog.pg_namespace ORDER BY nspname`
	} else {
		query = `
			SELECT nspname FROM pg_catalog.pg_namespace
			WHERE nspname NOT IN ('information_schema','pg_catalog','pg_toast')
			AND nspname NOT LIKE 'pg_%'
			ORDER BY nspname
		`
	}

	schemaRows, err := db.QueryContext(ctx, query)
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
func (d *PostgresDriver) populateSchema(ctx context.Context, db *sql.DB, schema string, node *models.SchemaNode, logger *slog.Logger) {
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

	rows, err = db.QueryContext(ctx, `
		SELECT p.proname
		FROM pg_proc p
		JOIN pg_namespace n ON n.oid = p.pronamespace
		WHERE n.nspname = $1 AND p.prokind = 'p'
		ORDER BY p.proname
	`, schema)
	if err != nil {
		logger.Warn("schema: list procedures failed", "schema", schema, "err", err)
	} else {
		for rows.Next() {
			var name string
			if rows.Scan(&name) == nil {
				node.Procedures = append(node.Procedures, name)
			}
		}
		rows.Close()
	}

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
		"procedures", len(node.Procedures),
		"sequences", len(node.Sequences),
		"types", len(node.DataTypes),
		"aggregates", len(node.AggregateFunctions),
		"aggregates", len(node.AggregateFunctions),
	)
}

// FetchTablePrimaryKeys returns the primary key columns for a given table.
func (d *PostgresDriver) FetchTablePrimaryKeys(ctx context.Context, db *sql.DB, schema, table string) ([]string, error) {
	query := `
		SELECT a.attname
		FROM   pg_index i
		JOIN   pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
		JOIN   pg_class c ON c.oid = i.indrelid
		JOIN   pg_namespace n ON n.oid = c.relnamespace
		WHERE  i.indisprimary
		AND    c.relname = $1
		AND    n.nspname = $2
	`
	rows, err := db.QueryContext(ctx, query, table, schema)
	if err != nil {
		return nil, fmt.Errorf("postgres: fetch primary keys: %w", err)
	}
	defer rows.Close()

	var pks []string
	for rows.Next() {
		var pk string
		if rows.Scan(&pk) == nil {
			pks = append(pks, pk)
		}
	}
	return pks, nil
}
