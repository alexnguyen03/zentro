// Pattern: Facade — orchestrates schema fetching across drivers without driver-specific logic.
package db

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"zentro/internal/core"
	"zentro/internal/models"
)

// FetchDatabases lists all databases and schemas for currentDB.
// Delegates to the registered driver — no postgres/mssql switch here.
func FetchDatabases(db *sql.DB, driverName, currentDB string, showAllSchemas bool, logger *slog.Logger) ([]*models.DatabaseInfo, error) {
	if logger == nil {
		logger = slog.Default()
	}
	d, ok := core.Get(driverName)
	if !ok {
		return nil, fmt.Errorf("schema: unsupported driver %q", driverName)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	dbs, err := d.FetchDatabases(ctx, db, currentDB, showAllSchemas, logger)
	if err != nil {
		logger.Error("fetch databases failed", "err", err)
		return nil, err
	}
	logDatabaseTree(logger, dbs)
	return dbs, nil
}

// FetchAllDatabaseSchemas fetches schemas for all databases not yet loaded.
// openFn opens a fresh connection for each database (required by PostgreSQL).
func FetchAllDatabaseSchemas(
	databases []*models.DatabaseInfo,
	currentDB string,
	driverName string,
	showAllSchemas bool,
	openFn func(dbName string) (*sql.DB, error),
	logger *slog.Logger,
) {
	if logger == nil {
		logger = slog.Default()
	}
	d, ok := core.Get(driverName)
	if !ok {
		logger.Warn("FetchAllDatabaseSchemas: unknown driver", "driver", driverName)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	for _, dbInfo := range databases {
		if dbInfo.Name == currentDB || len(dbInfo.Schemas) > 0 {
			continue
		}
		conn, err := openFn(dbInfo.Name)
		if err != nil {
			logger.Warn("cannot open db for schema fetch", "db", dbInfo.Name, "err", err)
			continue
		}
		schemas, err := d.FetchSchema(ctx, conn, showAllSchemas, logger)
		conn.Close()
		if err != nil {
			logger.Warn("fetch schema failed", "db", dbInfo.Name, "err", err)
			continue
		}
		dbInfo.Schemas = schemas
		logger.Info("fetched schema for db", "db", dbInfo.Name, "schemas", len(schemas))
	}
}

func logDatabaseTree(logger *slog.Logger, dbs []*models.DatabaseInfo) {
	var sb strings.Builder
	sb.WriteString("\n=== DATABASE TREE ===\n")
	for _, db := range dbs {
		sb.WriteString(fmt.Sprintf("├─ [DB] %s\n", db.Name))
		for _, schema := range db.Schemas {
			sb.WriteString(fmt.Sprintf("│  ├─ [Schema] %s (tables=%d, views=%d)\n",
				schema.Name, len(schema.Tables), len(schema.Views)))
			for _, t := range schema.Tables {
				sb.WriteString(fmt.Sprintf("│  │  ├─ [Table] %s\n", t))
			}
			for _, v := range schema.Views {
				sb.WriteString(fmt.Sprintf("│  │  └─ [View]  %s\n", v))
			}
		}
	}
	sb.WriteString("=====================")
	logger.Info("schema tree loaded", "tree", sb.String())
}
