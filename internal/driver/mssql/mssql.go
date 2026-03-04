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
	user := url.QueryEscape(p.Username)
	pass := url.QueryEscape(p.Password)
	dsn := fmt.Sprintf(
		"sqlserver://%s:%s@%s:%d?database=%s&connection+timeout=%d",
		user, pass, p.Host, p.Port, p.DBName, p.ConnectTimeout,
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

func containsAny(s string, subs ...string) bool {
	for _, sub := range subs {
		if strings.Contains(s, sub) {
			return true
		}
	}
	return false
}
