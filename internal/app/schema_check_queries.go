package app

import (
	"context"
	"database/sql"
	"strings"
)

func getPostgresCheckConstraints(ctx context.Context, db *sql.DB, schema, tableName string) ([]CheckConstraintInfo, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT con.conname, pg_get_constraintdef(con.oid)
		FROM pg_constraint con
		JOIN pg_class t ON t.oid = con.conrelid
		JOIN pg_namespace n ON n.oid = t.relnamespace
		WHERE n.nspname = $1 AND t.relname = $2 AND con.contype = 'c'
		ORDER BY con.conname
	`, schema, tableName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []CheckConstraintInfo
	for rows.Next() {
		var name, expr string
		if err := rows.Scan(&name, &expr); err != nil {
			return nil, err
		}
		result = append(result, CheckConstraintInfo{Name: name, Expression: expr})
	}
	if result == nil {
		result = []CheckConstraintInfo{}
	}
	return result, nil
}

func getMySQLCheckConstraints(ctx context.Context, db *sql.DB, schema, tableName string) ([]CheckConstraintInfo, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT cc.CONSTRAINT_NAME, cc.CHECK_CLAUSE
		FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS cc
		JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
			ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA
			AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
		WHERE tc.TABLE_SCHEMA = ? AND tc.TABLE_NAME = ?
		ORDER BY cc.CONSTRAINT_NAME
	`, schema, tableName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []CheckConstraintInfo
	for rows.Next() {
		var name, expr string
		if err := rows.Scan(&name, &expr); err != nil {
			return nil, err
		}
		result = append(result, CheckConstraintInfo{Name: name, Expression: expr})
	}
	if result == nil {
		result = []CheckConstraintInfo{}
	}
	return result, nil
}

func getMSSQLCheckConstraints(ctx context.Context, db *sql.DB, schema, tableName string) ([]CheckConstraintInfo, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT cc.name, cc.definition
		FROM sys.check_constraints cc
		JOIN sys.tables t ON t.object_id = cc.parent_object_id
		JOIN sys.schemas s ON s.schema_id = t.schema_id
		WHERE s.name = @p1 AND t.name = @p2
		ORDER BY cc.name
	`, schema, tableName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []CheckConstraintInfo
	for rows.Next() {
		var name, expr string
		if err := rows.Scan(&name, &expr); err != nil {
			return nil, err
		}
		result = append(result, CheckConstraintInfo{Name: name, Expression: expr})
	}
	if result == nil {
		result = []CheckConstraintInfo{}
	}
	return result, nil
}

func getSQLiteCheckConstraints(ctx context.Context, db *sql.DB, tableName string) ([]CheckConstraintInfo, error) {
	// SQLite stores the full CREATE TABLE SQL in sqlite_master; parse CHECK constraints from it
	row := db.QueryRowContext(ctx, `SELECT sql FROM sqlite_master WHERE type='table' AND name=?`, tableName)
	var createSQL string
	if err := row.Scan(&createSQL); err != nil {
		return []CheckConstraintInfo{}, nil
	}
	// Basic extraction: find "CONSTRAINT name CHECK (...)" patterns
	result := parseSQLiteCheckConstraints(createSQL)
	return result, nil
}

// parseSQLiteCheckConstraints extracts named CHECK constraints from a CREATE TABLE statement.
// SQLite does not expose constraints via system tables, so we parse the DDL text.
func parseSQLiteCheckConstraints(ddl string) []CheckConstraintInfo {
	var result []CheckConstraintInfo
	upper := strings.ToUpper(ddl)
	search := upper

	for {
		idx := strings.Index(search, "CONSTRAINT")
		if idx < 0 {
			break
		}
		rest := strings.TrimSpace(ddl[len(ddl)-len(search)+idx+len("CONSTRAINT"):])
		upperRest := strings.ToUpper(rest)
		checkIdx := strings.Index(upperRest, "CHECK")
		if checkIdx < 0 {
			search = search[idx+1:]
			continue
		}
		// name is the token between CONSTRAINT and CHECK
		nameToken := strings.TrimSpace(rest[:checkIdx])
		// remove quotes if any
		nameToken = strings.Trim(nameToken, `"'` + "`")
		// expression is inside the first balanced parens after CHECK
		afterCheck := strings.TrimSpace(rest[checkIdx+len("CHECK"):])
		expr := extractBalancedParens(afterCheck)
		result = append(result, CheckConstraintInfo{Name: nameToken, Expression: "CHECK " + expr})
		search = search[idx+1:]
	}
	if result == nil {
		result = []CheckConstraintInfo{}
	}
	return result
}

func extractBalancedParens(s string) string {
	s = strings.TrimSpace(s)
	if len(s) == 0 || s[0] != '(' {
		return s
	}
	depth := 0
	for i, ch := range s {
		if ch == '(' {
			depth++
		} else if ch == ')' {
			depth--
			if depth == 0 {
				return s[:i+1]
			}
		}
	}
	return s
}
