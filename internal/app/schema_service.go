package app

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"zentro/internal/core"
	"zentro/internal/models"
	"zentro/internal/utils"
)

func ensureActiveConnection(profile *models.ConnectionProfile, db *sql.DB) error {
	if profile == nil || db == nil {
		return fmt.Errorf("no active connection")
	}
	return nil
}

func GetTableDDLWithConnection(profile *models.ConnectionProfile, db *sql.DB, schema, tableName string) (string, error) {
	if err := ensureActiveConnection(profile, db); err != nil {
		return "", err
	}

	ctx := context.Background()
	switch profile.Driver {
	case "postgres":
		return getPostgresDDL(ctx, db, schema, tableName)
	case "mysql":
		return getMySQLDDL(ctx, db, schema, tableName)
	case "sqlserver":
		return getMSSQLDDL(ctx, db, schema, tableName)
	case "sqlite":
		return getSQLiteDDL(ctx, db, schema, tableName)
	default:
		return "", fmt.Errorf("unsupported driver: %s", profile.Driver)
	}
}

func DropObjectWithConnection(profile *models.ConnectionProfile, db *sql.DB, schema, objectName, objectType string) error {
	if err := ensureActiveConnection(profile, db); err != nil {
		return err
	}

	var ddl string
	switch objectType {
	case "TABLE":
		ddl = "DROP TABLE " + schema + "." + objectName
	case "VIEW":
		ddl = "DROP VIEW " + schema + "." + objectName
	case "INDEX":
		switch profile.Driver {
		case "sqlserver":
			return fmt.Errorf("use DropIndex with table name for MSSQL indexes")
		case "mysql":
			return fmt.Errorf("use DropIndex with table name for MySQL indexes")
		default:
			ddl = "DROP INDEX " + schema + "." + objectName
		}
	default:
		return fmt.Errorf("unsupported object type: %s", objectType)
	}

	_, err := db.Exec(ddl)
	return err
}

func CreateTableWithConnection(profile *models.ConnectionProfile, db *sql.DB, schema, tableName string, columns []models.ColumnDef) error {
	if err := ensureActiveConnection(profile, db); err != nil {
		return err
	}

	var colDDLs []string
	var pkCols []string

	for _, col := range columns {
		colDDL := col.Name + " " + col.DataType
		if !col.IsNullable {
			colDDL += " NOT NULL"
		}
		if col.DefaultValue != "" {
			colDDL += " DEFAULT " + col.DefaultValue
		}
		colDDLs = append(colDDLs, colDDL)

		if col.IsPrimaryKey {
			pkCols = append(pkCols, col.Name)
		}
	}

	ddl := "CREATE TABLE " + schema + "." + tableName + " (\n"
	ddl += strings.Join(colDDLs, ",\n")
	if len(pkCols) > 0 {
		ddl += ",\n  PRIMARY KEY (" + strings.Join(pkCols, ", ") + ")"
	}
	ddl += "\n);"

	_, err := db.Exec(ddl)
	return err
}

func CreateIndexWithConnection(profile *models.ConnectionProfile, db *sql.DB, schema, tableName, indexName string, columns []string, unique bool) error {
	if err := ensureActiveConnection(profile, db); err != nil {
		return err
	}

	uniqueStr := ""
	if unique {
		uniqueStr = "UNIQUE "
	}
	cols := strings.Join(columns, ", ")
	ddl := fmt.Sprintf("CREATE %sINDEX %s ON %s.%s (%s)", uniqueStr, indexName, schema, tableName, cols)

	_, err := db.Exec(ddl)
	return err
}

func DropIndexWithConnection(profile *models.ConnectionProfile, db *sql.DB, schema, indexName string) error {
	if err := ensureActiveConnection(profile, db); err != nil {
		return err
	}

	ddl := "DROP INDEX " + schema + "." + indexName
	_, err := db.Exec(ddl)
	return err
}

func GetIndexesWithConnection(profile *models.ConnectionProfile, db *sql.DB, schema, tableName string) ([]IndexInfo, error) {
	if err := ensureActiveConnection(profile, db); err != nil {
		return nil, err
	}

	ctx := context.Background()
	switch profile.Driver {
	case "postgres":
		return getPostgresIndexes(ctx, db, schema, tableName)
	case "mysql":
		return getMySQLIndexes(ctx, db, schema, tableName)
	case "sqlserver":
		return getMSSQLIndexes(ctx, db, schema, tableName)
	default:
		return nil, fmt.Errorf("unsupported driver: %s", profile.Driver)
	}
}

func getConnectionProfile(profileName string) (*models.ConnectionProfile, error) {
	profiles, err := utils.LoadConnections()
	if err != nil {
		return nil, err
	}
	for _, p := range profiles {
		if p.Name == profileName {
			return p, nil
		}
	}
	return nil, fmt.Errorf("connection profile %q not found", profileName)
}

func GetTableDDL(profileName, schema, tableName string) (string, error) {
	conn, err := getConnectionProfile(profileName)
	if err != nil {
		return "", err
	}

	drv, ok := core.Get(conn.Driver)
	if !ok {
		return "", fmt.Errorf("driver %q not found", conn.Driver)
	}

	db, err := drv.Open(conn)
	if err != nil {
		return "", fmt.Errorf("open connection: %w", err)
	}
	defer db.Close()

	ctx := context.Background()

	switch conn.Driver {
	case "postgres":
		return getPostgresDDL(ctx, db, schema, tableName)
	case "mysql":
		return getMySQLDDL(ctx, db, schema, tableName)
	case "sqlserver":
		return getMSSQLDDL(ctx, db, schema, tableName)
	case "sqlite":
		return getSQLiteDDL(ctx, db, schema, tableName)
	default:
		return "", fmt.Errorf("unsupported driver: %s", conn.Driver)
	}
}

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
	rows, err := db.QueryContext(ctx, `
		SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE, COLUMN_KEY
		FROM INFORMATION_SCHEMA.COLUMNS 
		WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
		ORDER BY ORDINAL_POSITION
	`, schema, tableName)
	if err != nil {
		return "", err
	}
	defer rows.Close()

	var cols []string
	for rows.Next() {
		var colName, dataType, nullable, defaultVal, columnKey *string
		var charLen, numPrec, numScale *int64
		if err := rows.Scan(&colName, &dataType, &nullable, &defaultVal, &charLen, &numPrec, &numScale, &columnKey); err != nil {
			return "", err
		}
		col := *colName + " " + *dataType
		if charLen != nil && *charLen > 0 {
			col += fmt.Sprintf("(%d)", *charLen)
		} else if numPrec != nil && numScale != nil && *numScale > 0 {
			col += fmt.Sprintf("(%d,%d)", *numPrec, *numScale)
		}
		if nullable != nil && *nullable == "NO" {
			col += " NOT NULL"
		}
		if defaultVal != nil && *defaultVal != "" {
			col += " DEFAULT " + *defaultVal
		}
		cols = append(cols, col)
	}

	ddl := "CREATE TABLE " + tableName + " (\n"
	ddl += strings.Join(cols, ",\n")
	ddl += "\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"

	return ddl, nil
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
	rows, err := db.QueryContext(ctx, fmt.Sprintf("PRAGMA table_info(%s)", tableName))
	if err != nil {
		return "", err
	}
	defer rows.Close()

	var cols []string
	for rows.Next() {
		var cid, notNull, pk int64
		var name, colType, dflt *string

		if err := rows.Scan(&cid, &name, &colType, &notNull, &dflt, &pk); err != nil {
			return "", err
		}
		col := *name + " " + *colType
		if notNull == 1 {
			col += " NOT NULL"
		}
		if pk == 1 {
			col += " PRIMARY KEY"
		}
		cols = append(cols, col)
	}

	ddl := "CREATE TABLE " + tableName + " (\n"
	ddl += strings.Join(cols, ",\n")
	ddl += "\n);"

	return ddl, nil
}

func DropObject(profileName, schema, objectName, objectType string) error {
	conn, err := getConnectionProfile(profileName)
	if err != nil {
		return err
	}

	drv, ok := core.Get(conn.Driver)
	if !ok {
		return fmt.Errorf("driver %q not found", conn.Driver)
	}

	db, err := drv.Open(conn)
	if err != nil {
		return fmt.Errorf("open connection: %w", err)
	}
	defer db.Close()

	var ddl string
	switch objectType {
	case "TABLE":
		ddl = "DROP TABLE " + schema + "." + objectName
	case "VIEW":
		ddl = "DROP VIEW " + schema + "." + objectName
	case "INDEX":
		// DROP INDEX syntax differs per driver
		switch conn.Driver {
		case "sqlserver":
			// MSSQL: DROP INDEX requires table reference
			return fmt.Errorf("use DropIndex with table name for MSSQL indexes")
		case "mysql":
			// MySQL: DROP INDEX requires ON table — caller should use DropIndex
			return fmt.Errorf("use DropIndex with table name for MySQL indexes")
		default:
			ddl = "DROP INDEX " + schema + "." + objectName
		}
	default:
		return fmt.Errorf("unsupported object type: %s", objectType)
	}

	_, err = db.Exec(ddl)
	return err
}

func CreateTable(profileName, schema, tableName string, columns []models.ColumnDef) error {
	conn, err := getConnectionProfile(profileName)
	if err != nil {
		return err
	}

	drv, ok := core.Get(conn.Driver)
	if !ok {
		return fmt.Errorf("driver %q not found", conn.Driver)
	}

	db, err := drv.Open(conn)
	if err != nil {
		return fmt.Errorf("open connection: %w", err)
	}
	defer db.Close()

	var colDDLs []string
	var pkCols []string

	for _, col := range columns {
		colDDL := col.Name + " " + col.DataType
		if !col.IsNullable {
			colDDL += " NOT NULL"
		}
		if col.DefaultValue != "" {
			colDDL += " DEFAULT " + col.DefaultValue
		}
		colDDLs = append(colDDLs, colDDL)

		if col.IsPrimaryKey {
			pkCols = append(pkCols, col.Name)
		}
	}

	ddl := "CREATE TABLE " + schema + "." + tableName + " (\n"
	ddl += strings.Join(colDDLs, ",\n")
	if len(pkCols) > 0 {
		ddl += ",\n  PRIMARY KEY (" + strings.Join(pkCols, ", ") + ")"
	}
	ddl += "\n);"

	_, err = db.Exec(ddl)
	return err
}

func CreateIndex(profileName, schema, tableName, indexName string, columns []string, unique bool) error {
	conn, err := getConnectionProfile(profileName)
	if err != nil {
		return err
	}

	drv, ok := core.Get(conn.Driver)
	if !ok {
		return fmt.Errorf("driver %q not found", conn.Driver)
	}

	db, err := drv.Open(conn)
	if err != nil {
		return fmt.Errorf("open connection: %w", err)
	}
	defer db.Close()

	uniqueStr := ""
	if unique {
		uniqueStr = "UNIQUE "
	}
	cols := strings.Join(columns, ", ")
	ddl := fmt.Sprintf("CREATE %sINDEX %s ON %s.%s (%s)", uniqueStr, indexName, schema, tableName, cols)

	_, err = db.Exec(ddl)
	return err
}

func DropIndex(profileName, schema, indexName string) error {
	conn, err := getConnectionProfile(profileName)
	if err != nil {
		return err
	}

	drv, ok := core.Get(conn.Driver)
	if !ok {
		return fmt.Errorf("driver %q not found", conn.Driver)
	}

	db, err := drv.Open(conn)
	if err != nil {
		return fmt.Errorf("open connection: %w", err)
	}
	defer db.Close()

	ddl := "DROP INDEX " + schema + "." + indexName

	_, err = db.Exec(ddl)
	return err
}

type IndexInfo struct {
	Name    string
	Table   string
	Columns []string
	Unique  bool
}

func GetIndexes(profileName, schema, tableName string) ([]IndexInfo, error) {
	conn, err := getConnectionProfile(profileName)
	if err != nil {
		return nil, err
	}

	drv, ok := core.Get(conn.Driver)
	if !ok {
		return nil, fmt.Errorf("driver %q not found", conn.Driver)
	}

	db, err := drv.Open(conn)
	if err != nil {
		return nil, fmt.Errorf("open connection: %w", err)
	}
	defer db.Close()

	ctx := context.Background()

	switch conn.Driver {
	case "postgres":
		return getPostgresIndexes(ctx, db, schema, tableName)
	case "mysql":
		return getMySQLIndexes(ctx, db, schema, tableName)
	case "sqlserver":
		return getMSSQLIndexes(ctx, db, schema, tableName)
	default:
		return nil, fmt.Errorf("unsupported driver: %s", conn.Driver)
	}
}

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
