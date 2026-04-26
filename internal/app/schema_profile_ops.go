package app

import (
	"context"
	"fmt"
	"strings"

	"zentro/internal/core"
	"zentro/internal/models"
	"zentro/internal/utils"
)

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
		switch conn.Driver {
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
