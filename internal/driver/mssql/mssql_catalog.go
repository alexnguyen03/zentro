package mssql

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"

	"zentro/internal/models"
)

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
