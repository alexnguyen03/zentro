package app

import (
	"context"
	"database/sql"
)

func getPostgresIndexes(ctx context.Context, db *sql.DB, schema, tableName string) ([]IndexInfo, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT i.relname, a.attname, ix.indisunique
		FROM pg_class t
		JOIN pg_namespace n ON n.oid = t.relnamespace
		JOIN pg_index ix ON t.oid = ix.indrelid
		JOIN pg_class i ON i.oid = ix.indexrelid
		JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
		WHERE n.nspname = $1 AND t.relname = $2
		ORDER BY i.relname, a.attnum
	`, schema, tableName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	indexes := make(map[string]*IndexInfo)
	for rows.Next() {
		var idxName, colName *string
		var unique *bool
		if err := rows.Scan(&idxName, &colName, &unique); err != nil {
			return nil, err
		}
		if _, ok := indexes[*idxName]; !ok {
			indexes[*idxName] = &IndexInfo{Name: *idxName, Table: tableName, Unique: *unique}
		}
		indexes[*idxName].Columns = append(indexes[*idxName].Columns, *colName)
	}

	result := make([]IndexInfo, 0, len(indexes))
	for _, idx := range indexes {
		result = append(result, *idx)
	}
	return result, nil
}

func getMySQLIndexes(ctx context.Context, db *sql.DB, schema, tableName string) ([]IndexInfo, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE
		FROM INFORMATION_SCHEMA.STATISTICS
		WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
		ORDER BY INDEX_NAME, SEQ_IN_INDEX
	`, schema, tableName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	indexes := make(map[string]*IndexInfo)
	for rows.Next() {
		var idxName, colName *string
		var nonUnique *int64
		if err := rows.Scan(&idxName, &colName, &nonUnique); err != nil {
			return nil, err
		}
		if _, ok := indexes[*idxName]; !ok {
			indexes[*idxName] = &IndexInfo{Name: *idxName, Table: tableName, Unique: *nonUnique == 0}
		}
		indexes[*idxName].Columns = append(indexes[*idxName].Columns, *colName)
	}

	result := make([]IndexInfo, 0, len(indexes))
	for _, idx := range indexes {
		result = append(result, *idx)
	}
	return result, nil
}

func getMSSQLIndexes(ctx context.Context, db *sql.DB, schema, tableName string) ([]IndexInfo, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT i.name, c.name, i.is_unique
		FROM sys.indexes i
		JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
		JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
		JOIN sys.tables t ON i.object_id = t.object_id
		JOIN sys.schemas s ON t.schema_id = s.schema_id
		WHERE s.name = ? AND t.name = ? AND i.is_primary_key = 0
		ORDER BY i.name, ic.key_ordinal
	`, schema, tableName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	indexes := make(map[string]*IndexInfo)
	for rows.Next() {
		var idxName, colName *string
		var unique *bool
		if err := rows.Scan(&idxName, &colName, &unique); err != nil {
			return nil, err
		}
		if _, ok := indexes[*idxName]; !ok {
			indexes[*idxName] = &IndexInfo{Name: *idxName, Table: tableName, Unique: *unique}
		}
		indexes[*idxName].Columns = append(indexes[*idxName].Columns, *colName)
	}

	result := make([]IndexInfo, 0, len(indexes))
	for _, idx := range indexes {
		result = append(result, *idx)
	}
	return result, nil
}
