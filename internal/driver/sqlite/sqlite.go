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

func (d *SQLiteDriver) FetchTableColumns(ctx context.Context, db *sql.DB, schema, table string) ([]*models.ColumnDef, error) {
	query := fmt.Sprintf("PRAGMA table_info(%s)", table) // We already format without quotes in sqlite driver
	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("sqlite: fetch columns: %w", err)
	}
	defer rows.Close()

	var cols []*models.ColumnDef
	for rows.Next() {
		var cid int
		var name, typ string
		var notnull int
		var dfltValue interface{}
		var pk int
		if err := rows.Scan(&cid, &name, &typ, &notnull, &dfltValue, &pk); err != nil {
			return nil, err
		}

		defValStr := ""
		if dfltValue != nil {
			defValStr = fmt.Sprintf("%v", dfltValue)
		}

		cols = append(cols, &models.ColumnDef{
			Name:         name,
			DataType:     typ,
			DefaultValue: defValStr,
			IsNullable:   notnull == 0,
			IsPrimaryKey: pk > 0,
		})
	}
	return cols, nil
}

// AlterTableColumn is not supported by SQLite (no native ALTER COLUMN).
// SQLite requires a full table recreation to alter columns. This returns a clear error.
func (d *SQLiteDriver) AlterTableColumn(_ context.Context, _ *sql.DB, _, _ string, _, _ *models.ColumnDef) error {
	return fmt.Errorf("sqlite: ALTER COLUMN is not supported — SQLite requires table recreation to alter columns")
}

// ReorderTableColumns is not supported by SQLite directly.
func (d *SQLiteDriver) ReorderTableColumns(_ context.Context, _ *sql.DB, _, _ string, _ []string) error {
	return fmt.Errorf("sqlite: column reorder is not supported — SQLite requires full table recreation")
}

// AddTableColumn implements driver.SchemaFetcher.
func (d *SQLiteDriver) AddTableColumn(ctx context.Context, db *sql.DB, schema, table string, col *models.ColumnDef) error {
	// SQLite restriction: Can't add PK column via ALTER TABLE
	if col.IsPrimaryKey {
		return fmt.Errorf("sqlite: cannot add a PRIMARY KEY column via ALTER TABLE — SQLite requires table recreation")
	}

	qualified := fmt.Sprintf(`"%s"`, table)

	nullability := ""
	if !col.IsNullable {
		nullability = " NOT NULL"
	}

	defaultValue := ""
	if col.DefaultValue != "" {
		defaultValue = " DEFAULT " + col.DefaultValue
	}

	sqlStr := fmt.Sprintf(
		"ALTER TABLE %s ADD COLUMN \"%s\" %s%s%s",
		qualified, col.Name, col.DataType, nullability, defaultValue,
	)

	if _, err := db.ExecContext(ctx, sqlStr); err != nil {
		return fmt.Errorf("sqlite: add column: %w", err)
	}
	return nil
}
