package app

import (
	"context"
	"database/sql"
	"strings"
)

type fkRow struct {
	name      string
	sourceCol string
	refSchema string
	refTable  string
	refCol    string
	onDelete  string
	onUpdate  string
}

func getPostgresForeignKeys(ctx context.Context, db *sql.DB, schema, tableName string) ([]ForeignKeyInfo, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT
			tc.constraint_name,
			kcu.column_name,
			ukcu.table_schema,
			ukcu.table_name,
			ukcu.column_name,
			rc.delete_rule,
			rc.update_rule
		FROM information_schema.table_constraints tc
		JOIN information_schema.key_column_usage kcu
			ON tc.constraint_name = kcu.constraint_name
			AND tc.constraint_schema = kcu.constraint_schema
		JOIN information_schema.referential_constraints rc
			ON rc.constraint_name = tc.constraint_name
			AND rc.constraint_schema = tc.constraint_schema
		JOIN information_schema.key_column_usage ukcu
			ON ukcu.constraint_name = rc.unique_constraint_name
			AND ukcu.constraint_schema = rc.unique_constraint_schema
			AND ukcu.ordinal_position = kcu.position_in_unique_constraint
		WHERE tc.constraint_type = 'FOREIGN KEY'
			AND tc.table_schema = $1
			AND tc.table_name = $2
		ORDER BY tc.constraint_name, kcu.ordinal_position
	`, schema, tableName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanForeignKeyRows(rows)
}

func getMySQLForeignKeys(ctx context.Context, db *sql.DB, schema, tableName string) ([]ForeignKeyInfo, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT
			kcu.CONSTRAINT_NAME,
			kcu.COLUMN_NAME,
			kcu.REFERENCED_TABLE_SCHEMA,
			kcu.REFERENCED_TABLE_NAME,
			kcu.REFERENCED_COLUMN_NAME,
			rc.DELETE_RULE,
			rc.UPDATE_RULE
		FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
		JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
			ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
			AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
		WHERE kcu.TABLE_SCHEMA = ?
			AND kcu.TABLE_NAME = ?
			AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
		ORDER BY kcu.CONSTRAINT_NAME, kcu.ORDINAL_POSITION
	`, schema, tableName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanForeignKeyRows(rows)
}

func getMSSQLForeignKeys(ctx context.Context, db *sql.DB, schema, tableName string) ([]ForeignKeyInfo, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT
			fk.name,
			pc.name,
			rs.name,
			rt.name,
			rc.name,
			fk.delete_referential_action_desc,
			fk.update_referential_action_desc
		FROM sys.foreign_keys fk
		JOIN sys.tables pt ON pt.object_id = fk.parent_object_id
		JOIN sys.schemas ps ON ps.schema_id = pt.schema_id
		JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
		JOIN sys.columns pc ON pc.object_id = pt.object_id AND pc.column_id = fkc.parent_column_id
		JOIN sys.tables rt ON rt.object_id = fk.referenced_object_id
		JOIN sys.schemas rs ON rs.schema_id = rt.schema_id
		JOIN sys.columns rc ON rc.object_id = rt.object_id AND rc.column_id = fkc.referenced_column_id
		WHERE ps.name = @p1 AND pt.name = @p2
		ORDER BY fk.name, fkc.constraint_column_id
	`, schema, tableName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanForeignKeyRows(rows)
}

func scanForeignKeyRows(rows *sql.Rows) ([]ForeignKeyInfo, error) {
	byName := make(map[string]*ForeignKeyInfo)
	order := make([]string, 0)

	for rows.Next() {
		var r fkRow
		if err := rows.Scan(
			&r.name,
			&r.sourceCol,
			&r.refSchema,
			&r.refTable,
			&r.refCol,
			&r.onDelete,
			&r.onUpdate,
		); err != nil {
			return nil, err
		}

		entry, ok := byName[r.name]
		if !ok {
			entry = &ForeignKeyInfo{
				Name:       r.name,
				Columns:    []string{},
				RefSchema:  r.refSchema,
				RefTable:   r.refTable,
				RefColumns: []string{},
				OnDelete:   normalizeFKRule(r.onDelete),
				OnUpdate:   normalizeFKRule(r.onUpdate),
			}
			byName[r.name] = entry
			order = append(order, r.name)
		}

		entry.Columns = append(entry.Columns, r.sourceCol)
		entry.RefColumns = append(entry.RefColumns, r.refCol)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	result := make([]ForeignKeyInfo, 0, len(order))
	for _, name := range order {
		result = append(result, *byName[name])
	}
	return result, nil
}

func normalizeFKRule(rule string) string {
	normalized := strings.ToUpper(strings.TrimSpace(rule))
	switch normalized {
	case "", "NO_ACTION":
		return "NO ACTION"
	case "RESTRICT":
		return "RESTRICT"
	case "CASCADE":
		return "CASCADE"
	case "SET_NULL":
		return "SET NULL"
	case "SET_DEFAULT":
		return "SET DEFAULT"
	default:
		return strings.ReplaceAll(normalized, "_", " ")
	}
}
