package mysql

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"net/url"
	"regexp"
	"strings"

	"zentro/internal/models"

	_ "github.com/go-sql-driver/mysql"
)

type MySQLDriver struct{}

func New() *MySQLDriver {
	return &MySQLDriver{}
}

func (d *MySQLDriver) Name() string { return "mysql" }

func (d *MySQLDriver) Open(p *models.ConnectionProfile) (*sql.DB, error) {
	// DSN format: user:password@tcp(host:port)/dbname
	userInfo := url.UserPassword(p.Username, p.Password).String()
	dsn := fmt.Sprintf("%s@tcp(%s:%d)/%s?parseTime=true", userInfo, p.Host, p.Port, p.DBName)
	return sql.Open("mysql", dsn)
}

func (d *MySQLDriver) FriendlyError(err error) error {
	if err == nil {
		return nil
	}
	msg := strings.ToLower(err.Error())
	switch {
	case strings.Contains(msg, "access denied"):
		return fmt.Errorf("authentication failed — check username and password")
	case strings.Contains(msg, "connection refused"):
		return fmt.Errorf("connection refused — check host and port")
	case strings.Contains(msg, "unknown database"):
		return fmt.Errorf("database not found — check database name")
	default:
		return fmt.Errorf("mysql error: %s", err.Error())
	}
}

func (d *MySQLDriver) FetchDatabases(ctx context.Context, db *sql.DB, currentDB string, showAllSchemas bool, logger *slog.Logger) ([]*models.DatabaseInfo, error) {
	rows, err := db.QueryContext(ctx, "SHOW DATABASES")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var infos []*models.DatabaseInfo
	for rows.Next() {
		var name string
		if rows.Scan(&name) == nil {
			info := &models.DatabaseInfo{Name: name}
			if name == currentDB {
				schemas, err := d.FetchSchema(ctx, db, showAllSchemas, logger)
				if err == nil {
					info.Schemas = schemas
				}
			}
			infos = append(infos, info)
		}
	}
	return infos, nil
}

func (d *MySQLDriver) FetchSchema(ctx context.Context, db *sql.DB, showAllSchemas bool, logger *slog.Logger) ([]*models.SchemaNode, error) {
	node := models.NewSchemaNode("") // In MySQL, schema = database
	rows, err := db.QueryContext(ctx, "SHOW FULL TABLES")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var name, tableType string
		if rows.Scan(&name, &tableType) == nil {
			if tableType == "VIEW" {
				node.Views = append(node.Views, name)
			} else {
				node.Tables = append(node.Tables, name)
			}
		}
	}
	return []*models.SchemaNode{node}, nil
}

func (d *MySQLDriver) FetchTablePrimaryKeys(ctx context.Context, db *sql.DB, schema, table string) ([]string, error) {
	query := `
		SELECT COLUMN_NAME
		FROM information_schema.KEY_COLUMN_USAGE
		WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY'
	`
	rows, err := db.QueryContext(ctx, query, table)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var pks []string
	for rows.Next() {
		var col string
		if rows.Scan(&col) == nil {
			pks = append(pks, col)
		}
	}
	return pks, nil
}

func (d *MySQLDriver) DefaultSchema() string { return "" }

func (d *MySQLDriver) InjectPageClause(query string, limit, offset int) string {
	limitPattern := regexp.MustCompile(`(?i)\bLIMIT\b|\bOFFSET\b|\bTOP\b|\bFETCH\b`)
	if limitPattern.MatchString(query) {
		return query
	}
	trimmed := strings.TrimSpace(query)
	if offset > 0 {
		return trimmed + fmt.Sprintf(" LIMIT %d OFFSET %d", limit, offset)
	}
	return trimmed + fmt.Sprintf(" LIMIT %d", limit)
}
