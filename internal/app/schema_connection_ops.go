package app

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"zentro/internal/models"
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

func quoteIdentifier(driver, name string) string {
	switch driver {
	case "mysql":
		return "`" + strings.ReplaceAll(name, "`", "``") + "`"
	default: // postgres, sqlserver
		return `"` + strings.ReplaceAll(name, `"`, `""`) + `"`
	}
}

func CreateIndexWithConnection(profile *models.ConnectionProfile, db *sql.DB, schema, tableName, indexName string, columns []string, unique bool) error {
	if err := ensureActiveConnection(profile, db); err != nil {
		return err
	}

	uniqueStr := ""
	if unique {
		uniqueStr = "UNIQUE "
	}
	quotedCols := make([]string, len(columns))
	for i, c := range columns {
		quotedCols[i] = quoteIdentifier(profile.Driver, c)
	}
	cols := strings.Join(quotedCols, ", ")

	ddl := fmt.Sprintf("CREATE %sINDEX %s ON %s.%s (%s)",
		uniqueStr,
		quoteIdentifier(profile.Driver, indexName),
		quoteIdentifier(profile.Driver, schema),
		quoteIdentifier(profile.Driver, tableName),
		cols)

	_, err := db.Exec(ddl)
	return err
}

func DropIndexWithConnection(profile *models.ConnectionProfile, db *sql.DB, schema, tableName, indexName string) error {
	if err := ensureActiveConnection(profile, db); err != nil {
		return err
	}

	var ddl string
	switch profile.Driver {
	case "mysql":
		ddl = fmt.Sprintf("DROP INDEX %s ON %s.%s",
			quoteIdentifier(profile.Driver, indexName),
			quoteIdentifier(profile.Driver, schema),
			quoteIdentifier(profile.Driver, tableName))
	case "sqlserver":
		ddl = fmt.Sprintf("DROP INDEX %s ON %s.%s",
			quoteIdentifier(profile.Driver, indexName),
			quoteIdentifier(profile.Driver, schema),
			quoteIdentifier(profile.Driver, tableName))
	default: // postgres
		ddl = fmt.Sprintf("DROP INDEX %s.%s",
			quoteIdentifier(profile.Driver, schema),
			quoteIdentifier(profile.Driver, indexName))
	}

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

// ─── Check Constraints ────────────────────────────────────────────────────────

func GetCheckConstraintsWithConnection(profile *models.ConnectionProfile, db *sql.DB, schema, tableName string) ([]CheckConstraintInfo, error) {
	if err := ensureActiveConnection(profile, db); err != nil {
		return nil, err
	}
	ctx := context.Background()
	switch profile.Driver {
	case "postgres":
		return getPostgresCheckConstraints(ctx, db, schema, tableName)
	case "mysql":
		return getMySQLCheckConstraints(ctx, db, schema, tableName)
	case "sqlserver":
		return getMSSQLCheckConstraints(ctx, db, schema, tableName)
	case "sqlite":
		return getSQLiteCheckConstraints(ctx, db, tableName)
	default:
		return nil, fmt.Errorf("unsupported driver: %s", profile.Driver)
	}
}

func CreateCheckConstraintWithConnection(profile *models.ConnectionProfile, db *sql.DB, schema, tableName, name, expression string) error {
	if err := ensureActiveConnection(profile, db); err != nil {
		return err
	}
	ddl := fmt.Sprintf("ALTER TABLE %s.%s ADD CONSTRAINT %s CHECK (%s)",
		quoteIdentifier(profile.Driver, schema),
		quoteIdentifier(profile.Driver, tableName),
		quoteIdentifier(profile.Driver, name),
		expression)
	_, err := db.Exec(ddl)
	return err
}

func DropCheckConstraintWithConnection(profile *models.ConnectionProfile, db *sql.DB, schema, tableName, name string) error {
	if err := ensureActiveConnection(profile, db); err != nil {
		return err
	}
	var ddl string
	switch profile.Driver {
	case "mysql":
		ddl = fmt.Sprintf("ALTER TABLE %s.%s DROP CHECK %s",
			quoteIdentifier(profile.Driver, schema),
			quoteIdentifier(profile.Driver, tableName),
			quoteIdentifier(profile.Driver, name))
	default:
		ddl = fmt.Sprintf("ALTER TABLE %s.%s DROP CONSTRAINT %s",
			quoteIdentifier(profile.Driver, schema),
			quoteIdentifier(profile.Driver, tableName),
			quoteIdentifier(profile.Driver, name))
	}
	_, err := db.Exec(ddl)
	return err
}

// ─── Unique Constraints ───────────────────────────────────────────────────────

func GetUniqueConstraintsWithConnection(profile *models.ConnectionProfile, db *sql.DB, schema, tableName string) ([]UniqueConstraintInfo, error) {
	if err := ensureActiveConnection(profile, db); err != nil {
		return nil, err
	}
	ctx := context.Background()
	switch profile.Driver {
	case "postgres":
		return getPostgresUniqueConstraints(ctx, db, schema, tableName)
	case "mysql":
		return getMySQLUniqueConstraints(ctx, db, schema, tableName)
	case "sqlserver":
		return getMSSQLUniqueConstraints(ctx, db, schema, tableName)
	default:
		return nil, fmt.Errorf("unsupported driver: %s", profile.Driver)
	}
}

func CreateUniqueConstraintWithConnection(profile *models.ConnectionProfile, db *sql.DB, schema, tableName, name string, columns []string) error {
	if err := ensureActiveConnection(profile, db); err != nil {
		return err
	}
	quotedCols := make([]string, len(columns))
	for i, c := range columns {
		quotedCols[i] = quoteIdentifier(profile.Driver, c)
	}
	ddl := fmt.Sprintf("ALTER TABLE %s.%s ADD CONSTRAINT %s UNIQUE (%s)",
		quoteIdentifier(profile.Driver, schema),
		quoteIdentifier(profile.Driver, tableName),
		quoteIdentifier(profile.Driver, name),
		strings.Join(quotedCols, ", "))
	_, err := db.Exec(ddl)
	return err
}

func DropUniqueConstraintWithConnection(profile *models.ConnectionProfile, db *sql.DB, schema, tableName, name string) error {
	if err := ensureActiveConnection(profile, db); err != nil {
		return err
	}
	var ddl string
	switch profile.Driver {
	case "mysql":
		ddl = fmt.Sprintf("ALTER TABLE %s.%s DROP INDEX %s",
			quoteIdentifier(profile.Driver, schema),
			quoteIdentifier(profile.Driver, tableName),
			quoteIdentifier(profile.Driver, name))
	default:
		ddl = fmt.Sprintf("ALTER TABLE %s.%s DROP CONSTRAINT %s",
			quoteIdentifier(profile.Driver, schema),
			quoteIdentifier(profile.Driver, tableName),
			quoteIdentifier(profile.Driver, name))
	}
	_, err := db.Exec(ddl)
	return err
}

// ─── Primary Key ──────────────────────────────────────────────────────────────

func GetPrimaryKeyWithConnection(profile *models.ConnectionProfile, db *sql.DB, schema, tableName string) (*PrimaryKeyInfo, error) {
	if err := ensureActiveConnection(profile, db); err != nil {
		return nil, err
	}
	ctx := context.Background()
	switch profile.Driver {
	case "postgres":
		return getPostgresPrimaryKey(ctx, db, schema, tableName)
	case "mysql":
		return getMySQLPrimaryKey(ctx, db, schema, tableName)
	case "sqlserver":
		return getMSSQLPrimaryKey(ctx, db, schema, tableName)
	default:
		return nil, fmt.Errorf("unsupported driver: %s", profile.Driver)
	}
}

func AddPrimaryKeyWithConnection(profile *models.ConnectionProfile, db *sql.DB, schema, tableName, name string, columns []string) error {
	if err := ensureActiveConnection(profile, db); err != nil {
		return err
	}
	quotedCols := make([]string, len(columns))
	for i, c := range columns {
		quotedCols[i] = quoteIdentifier(profile.Driver, c)
	}
	ddl := fmt.Sprintf("ALTER TABLE %s.%s ADD CONSTRAINT %s PRIMARY KEY (%s)",
		quoteIdentifier(profile.Driver, schema),
		quoteIdentifier(profile.Driver, tableName),
		quoteIdentifier(profile.Driver, name),
		strings.Join(quotedCols, ", "))
	_, err := db.Exec(ddl)
	return err
}

func DropPrimaryKeyWithConnection(profile *models.ConnectionProfile, db *sql.DB, schema, tableName, name string) error {
	if err := ensureActiveConnection(profile, db); err != nil {
		return err
	}
	var ddl string
	switch profile.Driver {
	case "mysql":
		ddl = fmt.Sprintf("ALTER TABLE %s.%s DROP PRIMARY KEY",
			quoteIdentifier(profile.Driver, schema),
			quoteIdentifier(profile.Driver, tableName))
	default:
		ddl = fmt.Sprintf("ALTER TABLE %s.%s DROP CONSTRAINT %s",
			quoteIdentifier(profile.Driver, schema),
			quoteIdentifier(profile.Driver, tableName),
			quoteIdentifier(profile.Driver, name))
	}
	_, err := db.Exec(ddl)
	return err
}
