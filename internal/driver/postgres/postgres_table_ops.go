package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"zentro/internal/models"
)

// FetchTableColumns returns detailed column definitions for a given table.
func (d *PostgresDriver) FetchTableColumns(ctx context.Context, db *sql.DB, schema, table string) ([]*models.ColumnDef, error) {
	query := `
		SELECT 
			c.column_name, 
			c.data_type, 
			COALESCE(c.column_default, '') as column_default, 
			c.is_nullable,
			CASE WHEN tc.constraint_type = 'PRIMARY KEY' THEN true ELSE false END as is_primary_key
		FROM information_schema.columns c
		LEFT JOIN information_schema.key_column_usage kcu
			ON c.table_schema = kcu.table_schema AND c.table_name = kcu.table_name AND c.column_name = kcu.column_name
		LEFT JOIN information_schema.table_constraints tc
			ON kcu.constraint_name = tc.constraint_name AND tc.constraint_type = 'PRIMARY KEY'
		WHERE c.table_schema = $1 AND c.table_name = $2
		ORDER BY c.ordinal_position;
	`
	rows, err := db.QueryContext(ctx, query, schema, table)
	if err != nil {
		return nil, fmt.Errorf("postgres: fetch columns: %w", err)
	}
	defer rows.Close()

	var cols []*models.ColumnDef
	for rows.Next() {
		var colName, dataType, defVal, isNullable string
		var isPK sql.NullBool
		if err := rows.Scan(&colName, &dataType, &defVal, &isNullable, &isPK); err != nil {
			return nil, err
		}
		cols = append(cols, &models.ColumnDef{
			Name:         colName,
			DataType:     dataType,
			DefaultValue: defVal,
			IsNullable:   strings.ToUpper(isNullable) == "YES",
			IsPrimaryKey: isPK.Valid && isPK.Bool,
		})
	}
	return cols, nil
}

// AlterTableColumn applies column changes using Postgres DDL statements.
func (d *PostgresDriver) AlterTableColumn(ctx context.Context, db *sql.DB, schema, table string, old, updated *models.ColumnDef) error {
	qualified := fmt.Sprintf(`"%s"."%s"`, schema, table)

	if old.Name != updated.Name {
		sql := fmt.Sprintf(
			`ALTER TABLE %s RENAME COLUMN "%s" TO "%s"`,
			qualified, old.Name, updated.Name,
		)
		if _, err := db.ExecContext(ctx, sql); err != nil {
			return fmt.Errorf("postgres: rename column: %w", err)
		}
		old.Name = updated.Name
	}

	if old.DataType != updated.DataType {
		sql := fmt.Sprintf(
			`ALTER TABLE %s ALTER COLUMN "%s" TYPE %s USING "%s"::%s`,
			qualified, updated.Name, updated.DataType, updated.Name, updated.DataType,
		)
		if _, err := db.ExecContext(ctx, sql); err != nil {
			return fmt.Errorf("postgres: alter column type: %w", err)
		}
	}

	if old.IsNullable != updated.IsNullable {
		action := "SET NOT NULL"
		if updated.IsNullable {
			action = "DROP NOT NULL"
		}
		sql := fmt.Sprintf(`ALTER TABLE %s ALTER COLUMN "%s" %s`, qualified, updated.Name, action)
		if _, err := db.ExecContext(ctx, sql); err != nil {
			return fmt.Errorf("postgres: alter nullable: %w", err)
		}
	}

	if old.DefaultValue != updated.DefaultValue {
		var sql string
		if updated.DefaultValue == "" {
			sql = fmt.Sprintf(`ALTER TABLE %s ALTER COLUMN "%s" DROP DEFAULT`, qualified, updated.Name)
		} else {
			sql = fmt.Sprintf(`ALTER TABLE %s ALTER COLUMN "%s" SET DEFAULT %s`, qualified, updated.Name, updated.DefaultValue)
		}
		if _, err := db.ExecContext(ctx, sql); err != nil {
			return fmt.Errorf("postgres: alter default: %w", err)
		}
	}

	if old.IsPrimaryKey != updated.IsPrimaryKey {
		pkName := fmt.Sprintf("pk_%s_%s", table, updated.Name)
		if !updated.IsPrimaryKey {
			sql := fmt.Sprintf(`ALTER TABLE %s DROP CONSTRAINT IF EXISTS "%s"`, qualified, pkName)
			if _, err := db.ExecContext(ctx, sql); err != nil {
				return fmt.Errorf("postgres: drop pk: %w", err)
			}
		} else {
			sql := fmt.Sprintf(
				`ALTER TABLE %s ADD CONSTRAINT "%s" PRIMARY KEY ("%s")`,
				qualified, pkName, updated.Name,
			)
			if _, err := db.ExecContext(ctx, sql); err != nil {
				return fmt.Errorf("postgres: add pk: %w", err)
			}
		}
	}
	return nil
}

// AddTableColumn implements driver.SchemaFetcher.
func (d *PostgresDriver) AddTableColumn(ctx context.Context, db *sql.DB, schema, table string, col *models.ColumnDef) error {
	qualified := fmt.Sprintf(`"%s"."%s"`, schema, table)

	nullability := "NULL"
	if !col.IsNullable {
		nullability = "NOT NULL"
	}

	defaultValue := ""
	if col.DefaultValue != "" {
		defaultValue = "DEFAULT " + col.DefaultValue
	}

	sqlStr := fmt.Sprintf(
		`ALTER TABLE %s ADD COLUMN "%s" %s %s %s`,
		qualified, col.Name, col.DataType, nullability, defaultValue,
	)

	if _, err := db.ExecContext(ctx, sqlStr); err != nil {
		return fmt.Errorf("postgres: add column: %w", err)
	}

	if col.IsPrimaryKey {
		pkName := fmt.Sprintf("pk_%s_%s", table, col.Name)
		pkSQL := fmt.Sprintf(`ALTER TABLE %s ADD CONSTRAINT "%s" PRIMARY KEY ("%s")`, qualified, pkName, col.Name)
		if _, err := db.ExecContext(ctx, pkSQL); err != nil {
			return fmt.Errorf("postgres: add PK after add column: %w", err)
		}
	}

	return nil
}

// DropTableColumn implements driver.SchemaFetcher.
func (d *PostgresDriver) DropTableColumn(ctx context.Context, db *sql.DB, schema, table, column string) error {
	query := fmt.Sprintf(`ALTER TABLE "%s"."%s" DROP COLUMN "%s"`, schema, table, column)
	if _, err := db.ExecContext(ctx, query); err != nil {
		return fmt.Errorf("postgres: drop column: %w", err)
	}
	return nil
}

// FetchTableRelationships implements driver.SchemaFetcher.
func (d *PostgresDriver) FetchTableRelationships(ctx context.Context, db *sql.DB, schema, table string) ([]models.TableRelationship, error) {
	query := `
		SELECT
			tc.constraint_name AS ConstraintName,
			tc.table_schema AS SourceSchema,
			tc.table_name AS SourceTable,
			kcu.column_name AS SourceColumn,
			ccu.table_schema AS TargetSchema,
			ccu.table_name AS TargetTable,
			ccu.column_name AS TargetColumn
		FROM information_schema.table_constraints tc
		JOIN information_schema.key_column_usage kcu
			ON tc.constraint_name = kcu.constraint_name
			AND tc.table_schema = kcu.table_schema
		JOIN information_schema.referential_constraints rc
			ON tc.constraint_name = rc.constraint_name
			AND tc.table_schema = rc.constraint_schema
		JOIN information_schema.constraint_column_usage ccu
			ON rc.unique_constraint_name = ccu.constraint_name
			AND rc.unique_constraint_schema = ccu.table_schema
		WHERE tc.constraint_type = 'FOREIGN KEY'
			AND (
				(tc.table_schema = $1 AND tc.table_name = $2)
				OR
				(ccu.table_schema = $1 AND ccu.table_name = $2)
			)
	`
	rows, err := db.QueryContext(ctx, query, schema, table)
	if err != nil {
		return nil, fmt.Errorf("postgres: fetch relationships: %w", err)
	}
	defer rows.Close()

	var rels []models.TableRelationship
	for rows.Next() {
		var r models.TableRelationship
		if err := rows.Scan(&r.ConstraintName, &r.SourceSchema, &r.SourceTable, &r.SourceColumn, &r.TargetSchema, &r.TargetTable, &r.TargetColumn); err != nil {
			return nil, fmt.Errorf("postgres: scan relationship: %w", err)
		}
		rels = append(rels, r)
	}
	return rels, rows.Err()
}

// ReorderTableColumns reorders columns using table recreation (Postgres has no native column reorder).
func (d *PostgresDriver) ReorderTableColumns(ctx context.Context, db *sql.DB, schema, table string, newOrder []string) error {
	qualified := fmt.Sprintf(`"%s"."%s"`, schema, table)
	tmpTable := fmt.Sprintf(`"%s"."__zentro_tmp_%s"`, schema, table)

	caseExpr := "CASE column_name"
	for i, col := range newOrder {
		caseExpr += fmt.Sprintf(" WHEN '%s' THEN %d", col, i)
	}
	caseExpr += " ELSE 999 END"

	q := fmt.Sprintf(`
		SELECT column_name, data_type, character_maximum_length, numeric_precision, numeric_scale,
		       is_nullable, column_default
		FROM information_schema.columns
		WHERE table_schema = $1 AND table_name = $2
		ORDER BY %s`, caseExpr)

	rows, err := db.QueryContext(ctx, q, schema, table)
	if err != nil {
		return fmt.Errorf("postgres: reorder fetch cols: %w", err)
	}
	defer rows.Close()

	type colInfo struct {
		name, dataType, nullable string
		charLen                  *int
		numPrec, numScale        *int
		colDefault               *string
	}
	var cols []colInfo
	for rows.Next() {
		var c colInfo
		if err := rows.Scan(&c.name, &c.dataType, &c.charLen, &c.numPrec, &c.numScale, &c.nullable, &c.colDefault); err != nil {
			return fmt.Errorf("postgres: reorder scan: %w", err)
		}
		cols = append(cols, c)
	}
	rows.Close()
	if len(cols) == 0 {
		return fmt.Errorf("postgres: reorder: no columns found for %s.%s", schema, table)
	}

	selCols := make([]string, len(cols))
	for i, c := range cols {
		selCols[i] = fmt.Sprintf(`"%s"`, c.name)
	}
	createSQL := fmt.Sprintf(`CREATE TABLE %s AS SELECT %s FROM %s LIMIT 0`, tmpTable, strings.Join(selCols, ", "), qualified)
	if _, err := db.ExecContext(ctx, createSQL); err != nil {
		return fmt.Errorf("postgres: reorder create temp: %w", err)
	}

	colList := strings.Join(selCols, ", ")
	if _, err := db.ExecContext(ctx, fmt.Sprintf(`INSERT INTO %s (%s) SELECT %s FROM %s`, tmpTable, colList, colList, qualified)); err != nil {
		_, _ = db.ExecContext(ctx, fmt.Sprintf(`DROP TABLE IF EXISTS %s`, tmpTable))
		return fmt.Errorf("postgres: reorder copy data: %w", err)
	}

	if _, err := db.ExecContext(ctx, fmt.Sprintf(`DROP TABLE %s`, qualified)); err != nil {
		_, _ = db.ExecContext(ctx, fmt.Sprintf(`DROP TABLE IF EXISTS %s`, tmpTable))
		return fmt.Errorf("postgres: reorder drop original: %w", err)
	}
	renameSQL := fmt.Sprintf(`ALTER TABLE %s RENAME TO "%s"`, tmpTable, table)
	if _, err := db.ExecContext(ctx, renameSQL); err != nil {
		return fmt.Errorf("postgres: reorder rename temp: %w", err)
	}
	return nil
}
