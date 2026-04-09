package app

import (
	"context"
	"database/sql"
)

// ─── Primary Key ──────────────────────────────────────────────────────────────

func getPostgresPrimaryKey(ctx context.Context, db *sql.DB, schema, tableName string) (*PrimaryKeyInfo, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT con.conname, a.attname
		FROM pg_constraint con
		JOIN pg_class t ON t.oid = con.conrelid
		JOIN pg_namespace n ON n.oid = t.relnamespace
		JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(con.conkey)
		WHERE n.nspname = $1 AND t.relname = $2 AND con.contype = 'p'
		ORDER BY array_position(con.conkey, a.attnum)
	`, schema, tableName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var pk *PrimaryKeyInfo
	for rows.Next() {
		var name, col string
		if err := rows.Scan(&name, &col); err != nil {
			return nil, err
		}
		if pk == nil {
			pk = &PrimaryKeyInfo{Name: name, Columns: []string{}}
		}
		pk.Columns = append(pk.Columns, col)
	}
	return pk, nil
}

func getMySQLPrimaryKey(ctx context.Context, db *sql.DB, schema, tableName string) (*PrimaryKeyInfo, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT 'PRIMARY', COLUMN_NAME
		FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
		WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY'
		ORDER BY ORDINAL_POSITION
	`, schema, tableName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var pk *PrimaryKeyInfo
	for rows.Next() {
		var name, col string
		if err := rows.Scan(&name, &col); err != nil {
			return nil, err
		}
		if pk == nil {
			pk = &PrimaryKeyInfo{Name: "PRIMARY", Columns: []string{}}
		}
		pk.Columns = append(pk.Columns, col)
	}
	return pk, nil
}

func getMSSQLPrimaryKey(ctx context.Context, db *sql.DB, schema, tableName string) (*PrimaryKeyInfo, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT kc.name, c.name
		FROM sys.key_constraints kc
		JOIN sys.index_columns ic ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
		JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
		JOIN sys.tables t ON t.object_id = kc.parent_object_id
		JOIN sys.schemas s ON s.schema_id = t.schema_id
		WHERE kc.type = 'PK' AND s.name = ? AND t.name = ?
		ORDER BY ic.key_ordinal
	`, schema, tableName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var pk *PrimaryKeyInfo
	for rows.Next() {
		var name, col string
		if err := rows.Scan(&name, &col); err != nil {
			return nil, err
		}
		if pk == nil {
			pk = &PrimaryKeyInfo{Name: name, Columns: []string{}}
		}
		pk.Columns = append(pk.Columns, col)
	}
	return pk, nil
}

// ─── Unique Constraints ───────────────────────────────────────────────────────

func getPostgresUniqueConstraints(ctx context.Context, db *sql.DB, schema, tableName string) ([]UniqueConstraintInfo, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT con.conname, a.attname
		FROM pg_constraint con
		JOIN pg_class t ON t.oid = con.conrelid
		JOIN pg_namespace n ON n.oid = t.relnamespace
		JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(con.conkey)
		WHERE n.nspname = $1 AND t.relname = $2 AND con.contype = 'u'
		ORDER BY con.conname, array_position(con.conkey, a.attnum)
	`, schema, tableName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanUniqueConstraintRows(rows, tableName)
}

func getMySQLUniqueConstraints(ctx context.Context, db *sql.DB, schema, tableName string) ([]UniqueConstraintInfo, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT tc.CONSTRAINT_NAME, kcu.COLUMN_NAME
		FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
		JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
			ON tc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
			AND tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
			AND tc.TABLE_NAME = kcu.TABLE_NAME
		WHERE tc.CONSTRAINT_TYPE = 'UNIQUE'
			AND tc.TABLE_SCHEMA = ? AND tc.TABLE_NAME = ?
		ORDER BY tc.CONSTRAINT_NAME, kcu.ORDINAL_POSITION
	`, schema, tableName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanUniqueConstraintRows(rows, tableName)
}

func getMSSQLUniqueConstraints(ctx context.Context, db *sql.DB, schema, tableName string) ([]UniqueConstraintInfo, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT kc.name, c.name
		FROM sys.key_constraints kc
		JOIN sys.index_columns ic ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
		JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
		JOIN sys.tables t ON t.object_id = kc.parent_object_id
		JOIN sys.schemas s ON s.schema_id = t.schema_id
		WHERE kc.type = 'UQ' AND s.name = ? AND t.name = ?
		ORDER BY kc.name, ic.key_ordinal
	`, schema, tableName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanUniqueConstraintRows(rows, tableName)
}

func scanUniqueConstraintRows(rows *sql.Rows, tableName string) ([]UniqueConstraintInfo, error) {
	constraints := make(map[string]*UniqueConstraintInfo)
	var order []string

	for rows.Next() {
		var name, col string
		if err := rows.Scan(&name, &col); err != nil {
			return nil, err
		}
		if _, ok := constraints[name]; !ok {
			constraints[name] = &UniqueConstraintInfo{Name: name, Columns: []string{}}
			order = append(order, name)
		}
		constraints[name].Columns = append(constraints[name].Columns, col)
	}

	result := make([]UniqueConstraintInfo, 0, len(order))
	for _, name := range order {
		result = append(result, *constraints[name])
	}
	return result, nil
}
