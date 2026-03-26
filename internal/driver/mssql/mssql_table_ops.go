package mssql

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"zentro/internal/models"
)

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
func (d *MSSQLDriver) AlterTableColumn(ctx context.Context, db *sql.DB, schema, table string, old, updated *models.ColumnDef) error {
	qualified := fmt.Sprintf("[%s].[%s]", schema, table)

	if old.Name != updated.Name {
		renameSQL := fmt.Sprintf(
			"EXEC sp_rename '%s.%s.%s', '%s', 'COLUMN'",
			schema, table, old.Name, updated.Name,
		)
		if _, err := db.ExecContext(ctx, renameSQL); err != nil {
			return fmt.Errorf("mssql: rename column: %w", err)
		}
		old.Name = updated.Name
	}

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

	if old.DefaultValue != updated.DefaultValue {
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
func (d *MSSQLDriver) ReorderTableColumns(ctx context.Context, db *sql.DB, schema, table string, newOrder []string) error {
	qualified := fmt.Sprintf("[%s].[%s]", schema, table)
	tempTable := fmt.Sprintf("[%s].[__zentro_tmp_%s]", schema, table)

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

	rows, err := db.QueryContext(ctx, orderQuery, schema, table)
	if err != nil {
		return fmt.Errorf("mssql: reorder fetch cols: %w", err)
	}
	defer rows.Close()

	type colMeta struct {
		name, typeName, defaultDef  string
		maxLength, precision, scale int
		isNullable, isIdentity      bool
	}

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

	if _, err := db.ExecContext(ctx, fmt.Sprintf("DROP TABLE %s", qualified)); err != nil {
		_, _ = db.ExecContext(ctx, fmt.Sprintf("DROP TABLE IF EXISTS %s", tempTable))
		return fmt.Errorf("mssql: reorder drop original: %w", err)
	}

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
