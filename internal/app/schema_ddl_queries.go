package app

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
)

func getPostgresDDL(ctx context.Context, db *sql.DB, schema, tableName string) (string, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT column_name, data_type, is_nullable, column_default, character_maximum_length, numeric_precision, numeric_scale
		FROM information_schema.columns 
		WHERE table_schema = $1 AND table_name = $2
		ORDER BY ordinal_position
	`, schema, tableName)
	if err != nil {
		return "", err
	}
	defer rows.Close()

	var cols []string
	for rows.Next() {
		var colName, dataType, nullable, defaultVal *string
		var charLen, numPrec, numScale *int64
		if err := rows.Scan(&colName, &dataType, &nullable, &defaultVal, &charLen, &numPrec, &numScale); err != nil {
			return "", err
		}
		col := *colName + " " + *dataType
		if charLen != nil && *charLen > 0 {
			col += fmt.Sprintf("(%d)", *charLen)
		}
		if nullable != nil && *nullable == "NO" {
			col += " NOT NULL"
		}
		if defaultVal != nil && *defaultVal != "" {
			col += " DEFAULT " + *defaultVal
		}
		cols = append(cols, col)
	}

	pkRows, err := db.QueryContext(ctx, `
		SELECT a.attname
		FROM pg_index i
		JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
		JOIN pg_class c ON c.oid = i.indrelid
		JOIN pg_namespace n ON n.oid = c.relnamespace
		WHERE n.nspname = $1 AND c.relname = $2 AND i.indisprimary
	`, schema, tableName)
	if err != nil {
		return "", err
	}
	defer pkRows.Close()

	var pkCols []string
	for pkRows.Next() {
		var pkCol string
		pkRows.Scan(&pkCol)
		pkCols = append(pkCols, pkCol)
	}

	ddl := "CREATE TABLE " + schema + "." + tableName + " (\n"
	ddl += strings.Join(cols, ",\n")
	if len(pkCols) > 0 {
		ddl += ",\n  PRIMARY KEY (" + strings.Join(pkCols, ", ") + ")"
	}
	ddl += "\n);"

	return ddl, nil
}

func getMySQLDDL(ctx context.Context, db *sql.DB, schema, tableName string) (string, error) {
	// Use SHOW CREATE TABLE for authoritative DDL including indexes, engine, charset, auto_increment, etc.
	row := db.QueryRowContext(ctx, fmt.Sprintf("SHOW CREATE TABLE `%s`.`%s`", schema, tableName))
	var tblName, createStmt string
	if err := row.Scan(&tblName, &createStmt); err != nil {
		return "", err
	}
	return createStmt, nil
}

func getMSSQLDDL(ctx context.Context, db *sql.DB, schema, tableName string) (string, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT c.name, t.name, c.is_nullable, dc.definition, c.max_length, c.precision, c.scale, ic.key_ordinal
		FROM sys.columns c
		JOIN sys.types t ON c.user_type_id = t.user_type_id
		JOIN sys.tables tb ON c.object_id = tb.object_id
		JOIN sys.schemas s ON tb.schema_id = s.schema_id
		LEFT JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
		LEFT JOIN sys.index_columns ic ON c.object_id = ic.object_id AND c.column_id = ic.column_id
		WHERE s.name = ? AND tb.name = ?
		ORDER BY c.column_id
	`, schema, tableName)
	if err != nil {
		return "", err
	}
	defer rows.Close()

	var cols []string
	for rows.Next() {
		var colName, dataType, defaultVal *string
		var isNullable *bool
		var maxLen, precision, scale, keyOrd *int64

		if err := rows.Scan(&colName, &dataType, &isNullable, &defaultVal, &maxLen, &precision, &scale, &keyOrd); err != nil {
			return "", err
		}
		col := *colName + " " + *dataType
		if maxLen != nil && *maxLen > 0 && *dataType != "nvarchar" && *dataType != "nchar" {
			col += fmt.Sprintf("(%d)", *maxLen)
		} else if maxLen != nil && *maxLen == -1 && (*dataType == "nvarchar" || *dataType == "varchar") {
			col += "(MAX)"
		}
		if isNullable != nil && !*isNullable {
			col += " NOT NULL"
		}
		cols = append(cols, col)
	}

	ddl := "CREATE TABLE " + schema + ".[" + tableName + "] (\n"
	ddl += strings.Join(cols, ",\n")
	ddl += "\n);"

	return ddl, nil
}

func getSQLiteDDL(ctx context.Context, db *sql.DB, schema, tableName string) (string, error) {
	// Use sqlite_master for authoritative DDL (preserves original CREATE TABLE statement)
	row := db.QueryRowContext(ctx, `SELECT sql FROM sqlite_master WHERE type='table' AND name=?`, tableName)
	var createStmt string
	if err := row.Scan(&createStmt); err != nil {
		return "", err
	}
	// Also append any indexes
	idxRows, err := db.QueryContext(ctx, `SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name=? AND sql IS NOT NULL`, tableName)
	if err != nil {
		return createStmt + ";", nil
	}
	defer idxRows.Close()
	var parts []string
	parts = append(parts, createStmt+";")
	for idxRows.Next() {
		var idxSQL string
		if idxRows.Scan(&idxSQL) == nil && idxSQL != "" {
			parts = append(parts, idxSQL+";")
		}
	}
	return strings.Join(parts, "\n\n"), nil
}
