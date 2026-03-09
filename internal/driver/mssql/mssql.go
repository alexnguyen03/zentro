// Package mssql implements the DatabaseDriver port for Microsoft SQL Server.
// Pattern: Adapter (Hexagonal) — adapts go-mssqldb to the driver.DatabaseDriver interface.
// Pattern: Factory Method — New() returns the interface, hiding the concrete type.
package mssql

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
)

// MSSQLDriver is the Adapter for Microsoft SQL Server.
type MSSQLDriver struct{}

// New returns a new MSSQLDriver as a concrete value.
func New() *MSSQLDriver {
	return &MSSQLDriver{}
}

func (d *MSSQLDriver) Name() string { return "sqlserver" }

// Open builds a DSN and opens a *sql.DB for SQL Server.
func (d *MSSQLDriver) Open(p *models.ConnectionProfile) (*sql.DB, error) {
	userInfo := url.UserPassword(p.Username, p.Password).String()
	dsn := fmt.Sprintf(
		"sqlserver://%s@%s:%d?database=%s&connection+timeout=%d&tlsmin=1.0",
		userInfo, p.Host, p.Port, p.DBName, p.ConnectTimeout,
	)
	if p.TrustServerCert {
		dsn += "&TrustServerCertificate=true"
	}

	db, err := sql.Open("sqlserver", dsn)
	if err != nil {
		return nil, fmt.Errorf("mssql: open: %w", err)
	}
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)
	db.SetConnMaxIdleTime(2 * time.Minute)
	return db, nil
}

// FriendlyError maps raw SQL Server errors to user-readable messages.
func (d *MSSQLDriver) FriendlyError(err error) error {
	if err == nil {
		return nil
	}
	msg := strings.ToLower(err.Error())
	switch {
	case containsAny(msg, "login failed"):
		return fmt.Errorf("authentication failed — check username and password")
	case containsAny(msg, "connection refused"):
		return fmt.Errorf("connection refused — check host and port")
	case containsAny(msg, "no such host", "name resolution"):
		return fmt.Errorf("host not found — check hostname")
	case containsAny(msg, "context deadline exceeded", "timeout"):
		return fmt.Errorf("connection timed out — check host/port or firewall")
	case containsAny(msg, "cannot open database"):
		return fmt.Errorf("database not found — check database name")
	default:
		return fmt.Errorf("sql server error: %s", err.Error())
	}
}

// FetchDatabases lists user databases and fetches schemas for currentDB.
func (d *MSSQLDriver) FetchDatabases(ctx context.Context, db *sql.DB, currentDB string, showAllSchemas bool, logger *slog.Logger) ([]*models.DatabaseInfo, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT name FROM sys.databases
		WHERE database_id > 4
		ORDER BY name
	`)
	if err != nil {
		return nil, fmt.Errorf("mssql: list databases: %w", err)
	}
	defer rows.Close()

	var dbInfos []*models.DatabaseInfo
	for rows.Next() {
		var name string
		if rows.Scan(&name) == nil {
			dbInfos = append(dbInfos, &models.DatabaseInfo{Name: name})
		}
	}
	logger.Info("mssql database list", "count", len(dbInfos))

	for _, info := range dbInfos {
		if info.Name == currentDB {
			schemas, err := d.FetchSchema(ctx, db, showAllSchemas, logger)
			if err == nil {
				info.Schemas = schemas
			}
			break
		}
	}
	return dbInfos, nil
}

// FetchSchema returns all non-system schemas with their tables and views.
func (d *MSSQLDriver) FetchSchema(ctx context.Context, db *sql.DB, showAllSchemas bool, logger *slog.Logger) ([]*models.SchemaNode, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT s.name, t.name, 'TABLE'
		FROM sys.schemas s
		LEFT JOIN sys.tables t ON t.schema_id = s.schema_id
		WHERE s.name NOT IN (
			'sys','INFORMATION_SCHEMA','guest',
			'db_owner','db_accessadmin','db_securityadmin',
			'db_ddladmin','db_backupoperator',
			'db_datareader','db_datawriter',
			'db_denydatareader','db_denydatawriter'
		)
		UNION ALL
		SELECT s.name, v.name, 'VIEW'
		FROM sys.schemas s
		LEFT JOIN sys.views v ON v.schema_id = s.schema_id
		WHERE s.name NOT IN (
			'sys','INFORMATION_SCHEMA','guest',
			'db_owner','db_accessadmin','db_securityadmin',
			'db_ddladmin','db_backupoperator',
			'db_datareader','db_datawriter',
			'db_denydatareader','db_denydatawriter'
		)
		ORDER BY 1, 3 DESC, 2
	`)
	if err != nil {
		return nil, fmt.Errorf("mssql: list schema: %w", err)
	}
	defer rows.Close()

	nodeMap := make(map[string]*models.SchemaNode)
	var order []string
	for rows.Next() {
		var schemaName string
		var objName sql.NullString
		var typeName string
		if rows.Scan(&schemaName, &objName, &typeName) != nil {
			continue
		}
		if _, ok := nodeMap[schemaName]; !ok {
			nodeMap[schemaName] = &models.SchemaNode{Name: schemaName}
			order = append(order, schemaName)
		}
		if objName.Valid && objName.String != "" {
			if typeName == "VIEW" {
				nodeMap[schemaName].Views = append(nodeMap[schemaName].Views, objName.String)
			} else {
				nodeMap[schemaName].Tables = append(nodeMap[schemaName].Tables, objName.String)
			}
		}
	}

	nodes := make([]*models.SchemaNode, 0, len(order))
	for _, name := range order {
		nodes = append(nodes, nodeMap[name])
	}
	return nodes, nil
}

// FetchTablePrimaryKeys returns the primary key columns for a given table.
func (d *MSSQLDriver) FetchTablePrimaryKeys(ctx context.Context, db *sql.DB, schema, table string) ([]string, error) {
	query := `
		SELECT c.name
		FROM sys.indexes i
		JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
		JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
		JOIN sys.tables t ON i.object_id = t.object_id
		JOIN sys.schemas s ON t.schema_id = s.schema_id
		WHERE i.is_primary_key = 1
		  AND t.name = @p1
		  AND s.name = @p2
	`
	rows, err := db.QueryContext(ctx, query, table, schema)
	if err != nil {
		return nil, fmt.Errorf("mssql: fetch primary keys: %w", err)
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

func containsAny(s string, subs ...string) bool {
	for _, sub := range subs {
		if strings.Contains(s, sub) {
			return true
		}
	}
	return false
}

func (d *MSSQLDriver) DefaultSchema() string { return "dbo" }

func (d *MSSQLDriver) InjectPageClause(query string, limit, offset int) string {
	limitPattern := regexp.MustCompile(`(?i)\bLIMIT\b|\bOFFSET\b|\bTOP\b|\bFETCH\b`)
	if limitPattern.MatchString(query) {
		return query
	}

	trimmed := strings.TrimSpace(query)
	// MSSQL >= 2012 requires ORDER BY for OFFSET/FETCH.
	// If the query doesn't have an ORDER BY, we must inject a dummy one.
	hasOrderBy := regexp.MustCompile(`(?i)\bORDER\s+BY\b`).MatchString(trimmed)
	if !hasOrderBy {
		trimmed = trimmed + " ORDER BY 1"
	}
	return trimmed + fmt.Sprintf(" OFFSET %d ROWS FETCH NEXT %d ROWS ONLY", offset, limit)
}

// FetchTableColumns returns detailed column definitions for a given table.
func (d *MSSQLDriver) FetchTableColumns(ctx context.Context, db *sql.DB, schema, table string) ([]*models.ColumnDef, error) {
	query := `
		SELECT 
			c.name as column_name,
			t.name as data_type,
			c.is_nullable,
			COALESCE(object_definition(c.default_object_id), '') as column_default,
			CASE WHEN ic.object_id IS NOT NULL THEN 1 ELSE 0 END as is_primary_key
		FROM sys.columns c
		JOIN sys.types t ON c.user_type_id = t.user_type_id
		JOIN sys.tables tbl ON c.object_id = tbl.object_id
		JOIN sys.schemas s ON tbl.schema_id = s.schema_id
		LEFT JOIN sys.indexes i ON tbl.object_id = i.object_id AND i.is_primary_key = 1
		LEFT JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id AND c.column_id = ic.column_id
		WHERE s.name = @p1 AND tbl.name = @p2
		ORDER BY c.column_id;
	`
	rows, err := db.QueryContext(ctx, query, schema, table)
	if err != nil {
		return nil, fmt.Errorf("mssql: fetch columns: %w", err)
	}
	defer rows.Close()

	var cols []*models.ColumnDef
	for rows.Next() {
		var colName, dataType, defVal string
		var isNullable, isPK int
		if err := rows.Scan(&colName, &dataType, &isNullable, &defVal, &isPK); err != nil {
			return nil, err
		}

		// Clean up MSSQL default constraint formatting (e.g., "((0))" to "0")
		defVal = strings.Trim(defVal, "()")

		cols = append(cols, &models.ColumnDef{
			Name:         colName,
			DataType:     dataType,
			DefaultValue: defVal,
			IsNullable:   isNullable == 1,
			IsPrimaryKey: isPK == 1,
		})
	}
	return cols, nil
}
