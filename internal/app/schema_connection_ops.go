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
