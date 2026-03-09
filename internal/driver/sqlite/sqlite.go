package sqlite

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"regexp"
	"strings"

	"zentro/internal/models"

	_ "modernc.org/sqlite"
)

type SQLiteDriver struct{}

func New() *SQLiteDriver {
	return &SQLiteDriver{}
}

func (d *SQLiteDriver) Name() string { return "sqlite" }

func (d *SQLiteDriver) Open(p *models.ConnectionProfile) (*sql.DB, error) {
	return sql.Open("sqlite", p.DBName)
}

func (d *SQLiteDriver) FriendlyError(err error) error {
	return err
}

func (d *SQLiteDriver) FetchDatabases(ctx context.Context, db *sql.DB, currentDB string, showAllSchemas bool, logger *slog.Logger) ([]*models.DatabaseInfo, error) {
	info := &models.DatabaseInfo{Name: currentDB}
	schemas, err := d.FetchSchema(ctx, db, showAllSchemas, logger)
	if err == nil {
		info.Schemas = schemas
	}
	return []*models.DatabaseInfo{info}, nil
}

func (d *SQLiteDriver) FetchSchema(ctx context.Context, db *sql.DB, showAllSchemas bool, logger *slog.Logger) ([]*models.SchemaNode, error) {
	node := models.NewSchemaNode("main")
	rows, err := db.QueryContext(ctx, "SELECT name, type FROM sqlite_master WHERE type IN ('table','view') ORDER BY name")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var name, tableType string
		if rows.Scan(&name, &tableType) == nil {
			if tableType == "view" {
				node.Views = append(node.Views, name)
			} else {
				node.Tables = append(node.Tables, name)
			}
		}
	}
	return []*models.SchemaNode{node}, nil
}

func (d *SQLiteDriver) FetchTablePrimaryKeys(ctx context.Context, db *sql.DB, schema, table string) ([]string, error) {
	query := fmt.Sprintf("PRAGMA table_info(%s)", table) // Table name should usually be escaped
	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var pks []string
	for rows.Next() {
		var cid int
		var name, typ string
		var notnull int
		var dfltValue interface{}
		var pk int
		if rows.Scan(&cid, &name, &typ, &notnull, &dfltValue, &pk) == nil {
			if pk > 0 {
				pks = append(pks, name)
			}
		}
	}
	return pks, nil
}

func (d *SQLiteDriver) DefaultSchema() string { return "main" }

func (d *SQLiteDriver) InjectPageClause(query string, limit, offset int) string {
	limitPattern := regexp.MustCompile(`(?i)\bLIMIT\b|\bOFFSET\b|\bTOP\b|\bFETCH\b`)
	if limitPattern.MatchString(query) {
		return query
	}
	trimmed := strings.TrimSpace(query)
	if offset > 0 {
		return trimmed + fmt.Sprintf(" LIMIT %d OFFSET %d", limit, offset)
	}
	return trimmed + fmt.Sprintf(" LIMIT %d", limit)
}
