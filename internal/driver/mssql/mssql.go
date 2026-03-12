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
		var isNullable bool
		var isPK int
		if err := rows.Scan(&colName, &dataType, &isNullable, &defVal, &isPK); err != nil {
			return nil, err
		}

		// Clean up MSSQL default constraint formatting (e.g., "((0))" to "0")
		defVal = strings.Trim(defVal, "()")

		cols = append(cols, &models.ColumnDef{
			Name:         colName,
			DataType:     dataType,
			DefaultValue: defVal,
			IsNullable:   isNullable,
			IsPrimaryKey: isPK == 1,
		})
	}
	return cols, nil
}

// AlterTableColumn applies column changes using MSSQL DDL statements.
// MSSQL does not support a single ALTER COLUMN for all properties — each aspect is separate.
func (d *MSSQLDriver) AlterTableColumn(ctx context.Context, db *sql.DB, schema, table string, old, updated *models.ColumnDef) error {
	qualified := fmt.Sprintf("[%s].[%s]", schema, table)

	// 1. Rename column (sp_rename)
	if old.Name != updated.Name {
		renameSQL := fmt.Sprintf(
			"EXEC sp_rename '%s.%s.%s', '%s', 'COLUMN'",
			schema, table, old.Name, updated.Name,
		)
		if _, err := db.ExecContext(ctx, renameSQL); err != nil {
			return fmt.Errorf("mssql: rename column: %w", err)
		}
		old.Name = updated.Name // carry forward for further ops
	}

	// 2. Alter data type or nullability
	if old.DataType != updated.DataType || old.IsNullable != updated.IsNullable {
		nullStr := "NOT NULL"
		if updated.IsNullable {
			nullStr = "NULL"
		}
		alterSQL := fmt.Sprintf(
			"ALTER TABLE %s ALTER COLUMN [%s] %s %s",
			qualified, updated.Name, updated.DataType, nullStr,
		)
		if _, err := db.ExecContext(ctx, alterSQL); err != nil {
			return fmt.Errorf("mssql: alter column type/null: %w", err)
		}
	}

	// 3. Handle default value changes
	if old.DefaultValue != updated.DefaultValue {
		// Drop existing default constraint if any
		dropDefSQL := fmt.Sprintf(`
			DECLARE @cname NVARCHAR(256);
			SELECT @cname = dc.name FROM sys.default_constraints dc
			JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
			JOIN sys.tables t ON c.object_id = t.object_id
			JOIN sys.schemas s ON t.schema_id = s.schema_id
			WHERE s.name = '%s' AND t.name = '%s' AND c.name = '%s';
			IF @cname IS NOT NULL
				EXEC('ALTER TABLE %s DROP CONSTRAINT [' + @cname + ']');
		`, schema, table, updated.Name, qualified)
		if _, err := db.ExecContext(ctx, dropDefSQL); err != nil {
			return fmt.Errorf("mssql: drop default: %w", err)
		}
		// Add new default if not empty
		if updated.DefaultValue != "" {
			addDefSQL := fmt.Sprintf(
				"ALTER TABLE %s ADD DEFAULT (%s) FOR [%s]",
				qualified, updated.DefaultValue, updated.Name,
			)
			if _, err := db.ExecContext(ctx, addDefSQL); err != nil {
				return fmt.Errorf("mssql: add default: %w", err)
			}
		}
	}

	// 4. PK changes — drop old PK then recreate
	if old.IsPrimaryKey != updated.IsPrimaryKey {
		dropPKSQL := fmt.Sprintf(`
			DECLARE @pkname NVARCHAR(256);
			SELECT @pkname = kc.name FROM sys.key_constraints kc
			JOIN sys.tables t ON kc.parent_object_id = t.object_id
			JOIN sys.schemas s ON t.schema_id = s.schema_id
			WHERE kc.type = 'PK' AND s.name = '%s' AND t.name = '%s';
			IF @pkname IS NOT NULL
				EXEC('ALTER TABLE %s DROP CONSTRAINT [' + @pkname + ']');
		`, schema, table, qualified)
		if _, err := db.ExecContext(ctx, dropPKSQL); err != nil {
			return fmt.Errorf("mssql: drop pk: %w", err)
		}
		if updated.IsPrimaryKey {
			addPKSQL := fmt.Sprintf(
				"ALTER TABLE %s ADD CONSTRAINT [PK_%s_%s] PRIMARY KEY ([%s])",
				qualified, table, updated.Name, updated.Name,
			)
			if _, err := db.ExecContext(ctx, addPKSQL); err != nil {
				return fmt.Errorf("mssql: add pk: %w", err)
			}
		}
	}
	return nil
}

// AddTableColumn implements driver.SchemaFetcher.
func (d *MSSQLDriver) AddTableColumn(ctx context.Context, db *sql.DB, schema, table string, col *models.ColumnDef) error {
	qualified := fmt.Sprintf("[%s].[%s]", schema, table)

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
		"ALTER TABLE %s ADD [%s] %s %s%s%s",
		qualified, col.Name, col.DataType, nullability, defaultValue, pkStr,
	)

	if _, err := db.ExecContext(ctx, sqlStr); err != nil {
		return fmt.Errorf("mssql: add column: %w", err)
	}
	return nil
}

// DropTableColumn implements driver.SchemaFetcher.
func (d *MSSQLDriver) DropTableColumn(ctx context.Context, db *sql.DB, schema, table, column string) error {
	query := fmt.Sprintf("ALTER TABLE [%s].[%s] DROP COLUMN [%s]", schema, table, column)
	if _, err := db.ExecContext(ctx, query); err != nil {
		return fmt.Errorf("mssql: drop column: %w", err)
	}
	return nil
}

// ReorderTableColumns reorders columns by recreating the table with the new column order.
// This mirrors SSMS behaviour — it creates a temp table, copies data, drops original, renames.
// WARNING: this is a DDL operation. Ensure no active transactions hold locks on the table.
func (d *MSSQLDriver) ReorderTableColumns(ctx context.Context, db *sql.DB, schema, table string, newOrder []string) error {
	qualified := fmt.Sprintf("[%s].[%s]", schema, table)
	tempTable := fmt.Sprintf("[%s].[__zentro_tmp_%s]", schema, table)

	// 1. Fetch current column definitions in new order
	placeholders := make([]string, len(newOrder))
	args := make([]any, len(newOrder)+2)
	args[0] = schema
	args[1] = table
	for i, col := range newOrder {
		placeholders[i] = fmt.Sprintf("@p%d", i+3)
		args[i+2] = col
	}

	orderQuery := fmt.Sprintf(`
		SELECT c.name, t.name as type_name, c.max_length, c.precision, c.scale, c.is_nullable, c.is_identity,
		       COALESCE(object_definition(c.default_object_id), '') as default_def
		FROM sys.columns c
		JOIN sys.types t ON c.user_type_id = t.user_type_id
		JOIN sys.tables tbl ON c.object_id = tbl.object_id
		JOIN sys.schemas s ON tbl.schema_id = s.schema_id
		WHERE s.name = @p1 AND tbl.name = @p2
		ORDER BY CASE c.name %s END`,
		func() string {
			cases := ""
			for i, col := range newOrder {
				cases += fmt.Sprintf(" WHEN '%s' THEN %d", col, i)
			}
			return cases + " ELSE 999 END"
		}(),
	)

	type colMeta struct {
		name, typeName, defaultDef  string
		maxLength, precision, scale int
		isNullable, isIdentity      bool
	}

	rows, err := db.QueryContext(ctx, orderQuery, args[:2]...)
	if err != nil {
		return fmt.Errorf("mssql: reorder fetch cols: %w", err)
	}
	defer rows.Close()

	var metas []colMeta
	for rows.Next() {
		var m colMeta
		if err := rows.Scan(&m.name, &m.typeName, &m.maxLength, &m.precision, &m.scale, &m.isNullable, &m.isIdentity, &m.defaultDef); err != nil {
			return fmt.Errorf("mssql: reorder scan: %w", err)
		}
		metas = append(metas, m)
	}
	rows.Close()

	if len(metas) == 0 {
		return fmt.Errorf("mssql: reorder: no columns found for %s.%s", schema, table)
	}

	// 2. Build CREATE TABLE for temp
	colDefs := make([]string, 0, len(metas))
	for _, m := range metas {
		var typePart string
		switch m.typeName {
		case "varchar", "nvarchar", "char", "nchar", "varbinary", "binary":
			if m.maxLength == -1 {
				typePart = fmt.Sprintf("[%s](max)", m.typeName)
			} else {
				size := m.maxLength
				if m.typeName == "nvarchar" || m.typeName == "nchar" {
					size = m.maxLength / 2
				}
				typePart = fmt.Sprintf("[%s](%d)", m.typeName, size)
			}
		case "decimal", "numeric":
			typePart = fmt.Sprintf("[%s](%d,%d)", m.typeName, m.precision, m.scale)
		default:
			typePart = fmt.Sprintf("[%s]", m.typeName)
		}
		null := "NOT NULL"
		if m.isNullable {
			null = "NULL"
		}
		def := ""
		if m.defaultDef != "" {
			def = fmt.Sprintf(" DEFAULT %s", m.defaultDef)
		}
		colDefs = append(colDefs, fmt.Sprintf("[%s] %s %s%s", m.name, typePart, null, def))
	}

	createSQL := fmt.Sprintf("CREATE TABLE %s (%s)", tempTable, strings.Join(colDefs, ", "))
	if _, err := db.ExecContext(ctx, createSQL); err != nil {
		return fmt.Errorf("mssql: reorder create temp: %w", err)
	}

	// 3. Copy data
	colNames := make([]string, len(metas))
	for i, m := range metas {
		colNames[i] = fmt.Sprintf("[%s]", m.name)
	}
	colList := strings.Join(colNames, ", ")
	copySQL := fmt.Sprintf("INSERT INTO %s (%s) SELECT %s FROM %s", tempTable, colList, colList, qualified)
	if _, err := db.ExecContext(ctx, copySQL); err != nil {
		_, _ = db.ExecContext(ctx, fmt.Sprintf("DROP TABLE IF EXISTS %s", tempTable))
		return fmt.Errorf("mssql: reorder copy data: %w", err)
	}

	// 4. Drop original
	if _, err := db.ExecContext(ctx, fmt.Sprintf("DROP TABLE %s", qualified)); err != nil {
		_, _ = db.ExecContext(ctx, fmt.Sprintf("DROP TABLE IF EXISTS %s", tempTable))
		return fmt.Errorf("mssql: reorder drop original: %w", err)
	}

	// 5. Rename temp → original
	renameSQL := fmt.Sprintf("EXEC sp_rename '%s.__zentro_tmp_%s', '%s'", schema, table, table)
	if _, err := db.ExecContext(ctx, renameSQL); err != nil {
		return fmt.Errorf("mssql: reorder rename temp: %w", err)
	}

	return nil
}

// FetchTableRelationships implements driver.SchemaFetcher.
func (d *MSSQLDriver) FetchTableRelationships(ctx context.Context, db *sql.DB, schema, table string) ([]models.TableRelationship, error) {
	query := `
		SELECT
			fk.name AS ConstraintName,
			SCHEMA_NAME(t1.schema_id) AS SourceSchema,
			t1.name AS SourceTable,
			c1.name AS SourceColumn,
			SCHEMA_NAME(t2.schema_id) AS TargetSchema,
			t2.name AS TargetTable,
			c2.name AS TargetColumn
		FROM sys.foreign_keys fk
		INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
		INNER JOIN sys.tables t1 ON fkc.parent_object_id = t1.object_id
		INNER JOIN sys.columns c1 ON fkc.parent_object_id = c1.object_id AND fkc.parent_column_id = c1.column_id
		INNER JOIN sys.tables t2 ON fkc.referenced_object_id = t2.object_id
		INNER JOIN sys.columns c2 ON fkc.referenced_object_id = c2.object_id AND fkc.referenced_column_id = c2.column_id
		WHERE
			(SCHEMA_NAME(t1.schema_id) = @p1 AND t1.name = @p2)
			OR
			(SCHEMA_NAME(t2.schema_id) = @p1 AND t2.name = @p2)
	`
	rows, err := db.QueryContext(ctx, query, sql.Named("p1", schema), sql.Named("p2", table))
	if err != nil {
		return nil, fmt.Errorf("mssql: fetch relationships: %w", err)
	}
	defer rows.Close()

	var rels []models.TableRelationship
	for rows.Next() {
		var r models.TableRelationship
		if err := rows.Scan(&r.ConstraintName, &r.SourceSchema, &r.SourceTable, &r.SourceColumn, &r.TargetSchema, &r.TargetTable, &r.TargetColumn); err != nil {
			return nil, fmt.Errorf("mssql: scan relationship: %w", err)
		}
		rels = append(rels, r)
	}
	return rels, rows.Err()
}
