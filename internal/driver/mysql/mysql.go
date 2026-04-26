package mysql

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"net/url"
	"regexp"
	"strings"
	"time"

	"zentro/internal/models"

	_ "github.com/go-sql-driver/mysql"
)

type MySQLDriver struct{}

func New() *MySQLDriver {
	return &MySQLDriver{}
}

func (d *MySQLDriver) Name() string { return "mysql" }

func (d *MySQLDriver) Open(p *models.ConnectionProfile) (*sql.DB, error) {
	// DSN format: user:password@tcp(host:port)/dbname
	userInfo := url.UserPassword(p.Username, p.Password).String()
	dsn := fmt.Sprintf("%s@tcp(%s:%d)/%s?parseTime=true", userInfo, p.Host, p.Port, p.DBName)
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(2)
	db.SetMaxIdleConns(1)
	db.SetConnMaxLifetime(5 * time.Minute)
	db.SetConnMaxIdleTime(2 * time.Minute)
	return db, nil
}

func (d *MySQLDriver) FriendlyError(err error) error {
	if err == nil {
		return nil
	}
	msg := strings.ToLower(err.Error())
	switch {
	case strings.Contains(msg, "access denied"):
		return fmt.Errorf("authentication failed — check username and password")
	case strings.Contains(msg, "connection refused"):
		return fmt.Errorf("connection refused — check host and port")
	case strings.Contains(msg, "unknown database"):
		return fmt.Errorf("database not found — check database name")
	default:
		return fmt.Errorf("mysql error: %s", err.Error())
	}
}

func (d *MySQLDriver) FetchDatabases(ctx context.Context, db *sql.DB, currentDB string, showAllSchemas bool, logger *slog.Logger) ([]*models.DatabaseInfo, error) {
	rows, err := db.QueryContext(ctx, "SHOW DATABASES")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var infos []*models.DatabaseInfo
	for rows.Next() {
		var name string
		if rows.Scan(&name) == nil {
			info := &models.DatabaseInfo{Name: name}
			if name == currentDB {
				schemas, err := d.FetchSchema(ctx, db, showAllSchemas, logger)
				if err == nil {
					info.Schemas = schemas
				}
			}
			infos = append(infos, info)
		}
	}
	return infos, nil
}

func (d *MySQLDriver) FetchSchema(ctx context.Context, db *sql.DB, showAllSchemas bool, logger *slog.Logger) ([]*models.SchemaNode, error) {
	node := models.NewSchemaNode("") // In MySQL, schema = database
	rows, err := db.QueryContext(ctx, "SHOW FULL TABLES")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var name, tableType string
		if rows.Scan(&name, &tableType) == nil {
			if tableType == "VIEW" {
				node.Views = append(node.Views, name)
			} else {
				node.Tables = append(node.Tables, name)
			}
		}
	}
	return []*models.SchemaNode{node}, nil
}

func (d *MySQLDriver) FetchTablePrimaryKeys(ctx context.Context, db *sql.DB, schema, table string) ([]string, error) {
	query := `
		SELECT COLUMN_NAME
		FROM information_schema.KEY_COLUMN_USAGE
		WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY'
	`
	rows, err := db.QueryContext(ctx, query, table)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var pks []string
	for rows.Next() {
		var col string
		if rows.Scan(&col) == nil {
			pks = append(pks, col)
		}
	}
	return pks, nil
}

func (d *MySQLDriver) DefaultSchema() string { return "" }

func (d *MySQLDriver) InjectPageClause(query string, limit, offset int) string {
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

func (d *MySQLDriver) FetchTableColumns(ctx context.Context, db *sql.DB, schema, table string) ([]*models.ColumnDef, error) {
	query := `
		SELECT 
			COLUMN_NAME, 
			COLUMN_TYPE, 
			IS_NULLABLE, 
			COLUMN_KEY, 
			COALESCE(COLUMN_DEFAULT, '')
		FROM information_schema.COLUMNS
		WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
		ORDER BY ORDINAL_POSITION;
	`
	rows, err := db.QueryContext(ctx, query, table)
	if err != nil {
		return nil, fmt.Errorf("mysql: fetch columns: %w", err)
	}
	defer rows.Close()

	var cols []*models.ColumnDef
	for rows.Next() {
		var colName, dataType, isNullable, columnKey, defVal string
		if err := rows.Scan(&colName, &dataType, &isNullable, &columnKey, &defVal); err != nil {
			return nil, err
		}
		cols = append(cols, &models.ColumnDef{
			Name:         colName,
			DataType:     dataType,
			DefaultValue: defVal,
			IsNullable:   strings.ToUpper(isNullable) == "YES",
			IsPrimaryKey: strings.ToUpper(columnKey) == "PRI",
		})
	}
	return cols, nil
}

// AlterTableColumn applies column changes using MySQL DDL.
// MySQL supports ALTER TABLE MODIFY COLUMN for type+nullability and CHANGE for rename.
func (d *MySQLDriver) AlterTableColumn(ctx context.Context, db *sql.DB, schema, table string, old, updated *models.ColumnDef) error {
	// 1. Rename + retype in one statement (CHANGE COLUMN)
	if old.Name != updated.Name || old.DataType != updated.DataType || old.IsNullable != updated.IsNullable {
		nullStr := "NOT NULL"
		if updated.IsNullable {
			nullStr = "NULL"
		}
		defStr := ""
		if updated.DefaultValue != "" {
			defStr = fmt.Sprintf(" DEFAULT %s", updated.DefaultValue)
		}
		sql := fmt.Sprintf(
			"ALTER TABLE `%s` CHANGE COLUMN `%s` `%s` %s %s%s",
			table, old.Name, updated.Name, updated.DataType, nullStr, defStr,
		)
		if _, err := db.ExecContext(ctx, sql); err != nil {
			return fmt.Errorf("mysql: alter column: %w", err)
		}
	}
	return nil
}

// AddTableColumn implements driver.SchemaFetcher.
func (d *MySQLDriver) AddTableColumn(ctx context.Context, db *sql.DB, schema, table string, col *models.ColumnDef) error {
	nullability := "NULL"
	if !col.IsNullable {
		nullability = "NOT NULL"
	}

	defaultValue := ""
	if col.DefaultValue != "" {
		defaultValue = " DEFAULT " + col.DefaultValue
	}

	pkStr := ""
	if col.IsPrimaryKey {
		pkStr = " PRIMARY KEY"
	}

	sqlStr := fmt.Sprintf(
		"ALTER TABLE `%s` ADD COLUMN `%s` %s %s%s%s",
		table, col.Name, col.DataType, nullability, defaultValue, pkStr,
	)

	if _, err := db.ExecContext(ctx, sqlStr); err != nil {
		return fmt.Errorf("mysql: add column: %w", err)
	}
	return nil
}

// FetchTableRelationships implements driver.SchemaFetcher.
func (d *MySQLDriver) FetchTableRelationships(ctx context.Context, db *sql.DB, schema, table string) ([]models.TableRelationship, error) {
	query := `
		SELECT
			kcu.CONSTRAINT_NAME AS ConstraintName,
			kcu.TABLE_SCHEMA AS SourceSchema,
			kcu.TABLE_NAME AS SourceTable,
			kcu.COLUMN_NAME AS SourceColumn,
			kcu.REFERENCED_TABLE_SCHEMA AS TargetSchema,
			kcu.REFERENCED_TABLE_NAME AS TargetTable,
			kcu.REFERENCED_COLUMN_NAME AS TargetColumn
		FROM information_schema.KEY_COLUMN_USAGE kcu
		WHERE kcu.REFERENCED_TABLE_NAME IS NOT NULL
			AND (
				(kcu.TABLE_SCHEMA = ? AND kcu.TABLE_NAME = ?)
				OR
				(kcu.REFERENCED_TABLE_SCHEMA = ? AND kcu.REFERENCED_TABLE_NAME = ?)
			)
	`
	rows, err := db.QueryContext(ctx, query, schema, table, schema, table)
	if err != nil {
		return nil, fmt.Errorf("mysql: fetch relationships: %w", err)
	}
	defer rows.Close()

	var rels []models.TableRelationship
	for rows.Next() {
		var r models.TableRelationship
		if err := rows.Scan(&r.ConstraintName, &r.SourceSchema, &r.SourceTable, &r.SourceColumn, &r.TargetSchema, &r.TargetTable, &r.TargetColumn); err != nil {
			return nil, fmt.Errorf("mysql: scan relationship: %w", err)
		}
		rels = append(rels, r)
	}
	return rels, rows.Err()
}

// DropTableColumn implements driver.SchemaFetcher.
func (d *MySQLDriver) DropTableColumn(ctx context.Context, db *sql.DB, schema, table, column string) error {
	query := fmt.Sprintf("ALTER TABLE `%s` DROP COLUMN `%s`", table, column)
	if _, err := db.ExecContext(ctx, query); err != nil {
		return fmt.Errorf("mysql: drop column: %w", err)
	}
	return nil
}

// ReorderTableColumns uses MySQL's MODIFY COLUMN ... AFTER to reorder columns natively.
// MySQL is the only major RDBMS that supports this without full table recreation.
func (d *MySQLDriver) ReorderTableColumns(ctx context.Context, db *sql.DB, schema, table string, newOrder []string) error {
	if len(newOrder) == 0 {
		return nil
	}
	// Fetch column definitions for all columns (type, nullable, default)
	q := `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COALESCE(COLUMN_DEFAULT,''), COLUMN_KEY
	      FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
	      ORDER BY ORDINAL_POSITION`
	rows, err := db.QueryContext(ctx, q, table)
	if err != nil {
		return fmt.Errorf("mysql: reorder fetch cols: %w", err)
	}
	defer rows.Close()

	type colMeta struct{ name, colType, nullable, defVal, key string }
	colsByName := map[string]colMeta{}
	for rows.Next() {
		var m colMeta
		if err := rows.Scan(&m.name, &m.colType, &m.nullable, &m.defVal, &m.key); err != nil {
			return fmt.Errorf("mysql: reorder scan: %w", err)
		}
		colsByName[m.name] = m
	}
	rows.Close()

	// Issue MODIFY COLUMN ... FIRST / AFTER for each column in the new order
	for i, colName := range newOrder {
		m, ok := colsByName[colName]
		if !ok {
			continue
		}
		nullStr := "NOT NULL"
		if strings.ToUpper(m.nullable) == "YES" {
			nullStr = "NULL"
		}
		defStr := ""
		if m.defVal != "" {
			defStr = fmt.Sprintf(" DEFAULT %s", m.defVal)
		}
		var pos string
		if i == 0 {
			pos = "FIRST"
		} else {
			pos = fmt.Sprintf("AFTER `%s`", newOrder[i-1])
		}
		sql := fmt.Sprintf("ALTER TABLE `%s` MODIFY COLUMN `%s` %s %s%s %s", table, m.name, m.colType, nullStr, defStr, pos)
		if _, err := db.ExecContext(ctx, sql); err != nil {
			return fmt.Errorf("mysql: reorder column %s: %w", colName, err)
		}
	}
	return nil
}
