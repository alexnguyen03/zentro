// Package mssql implements the DatabaseDriver port for Microsoft SQL Server.
package mssql

import (
	"database/sql"
	"fmt"
	"net/url"
	"regexp"
	"strings"
	"time"

	"zentro/internal/models"
)

// MSSQLDriver is the Adapter for Microsoft SQL Server.
type MSSQLDriver struct{}

// New returns a new MSSQLDriver as a concrete value.
func New() *MSSQLDriver {
	return &MSSQLDriver{}
}

func (d *MSSQLDriver) Name() string { return "sqlserver" }

// Open builds a DSN and opens a *sql.DB for SQL Server.
func (d *MSSQLDriver) Open(p *models.ConnectionProfile) (*sql.DB, error) {
	userInfo := url.UserPassword(p.Username, p.Password).String()
	dsn := fmt.Sprintf(
		"sqlserver://%s@%s:%d?database=%s&connection+timeout=%d&tlsmin=1.0",
		userInfo, p.Host, p.Port, p.DBName, p.ConnectTimeout,
	)
	if p.TrustServerCert {
		dsn += "&TrustServerCertificate=true"
	}

	db, err := sql.Open("sqlserver", dsn)
	if err != nil {
		return nil, fmt.Errorf("mssql: open: %w", err)
	}
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)
	db.SetConnMaxIdleTime(2 * time.Minute)
	return db, nil
}

// FriendlyError maps raw SQL Server errors to user-readable messages.
func (d *MSSQLDriver) FriendlyError(err error) error {
	if err == nil {
		return nil
	}
	msg := strings.ToLower(err.Error())
	switch {
	case containsAny(msg, "login failed"):
		return fmt.Errorf("authentication failed â€” check username and password")
	case containsAny(msg, "connection refused"):
		return fmt.Errorf("connection refused â€” check host and port")
	case containsAny(msg, "no such host", "name resolution"):
		return fmt.Errorf("host not found â€” check hostname")
	case containsAny(msg, "context deadline exceeded", "timeout"):
		return fmt.Errorf("connection timed out â€” check host/port or firewall")
	case containsAny(msg, "cannot open database"):
		return fmt.Errorf("database not found â€” check database name")
	default:
		return fmt.Errorf("sql server error: %s", err.Error())
	}
}

func containsAny(s string, subs ...string) bool {
	for _, sub := range subs {
		if strings.Contains(s, sub) {
			return true
		}
	}
	return false
}

func (d *MSSQLDriver) DefaultSchema() string { return "dbo" }

func (d *MSSQLDriver) InjectPageClause(query string, limit, offset int) string {
	limitPattern := regexp.MustCompile(`(?i)\bLIMIT\b|\bOFFSET\b|\bTOP\b|\bFETCH\b`)
	if limitPattern.MatchString(query) {
		return query
	}

	trimmed := strings.TrimSpace(query)
	hasOrderBy := regexp.MustCompile(`(?i)\bORDER\s+BY\b`).MatchString(trimmed)
	if !hasOrderBy {
		trimmed = trimmed + " ORDER BY 1"
	}
	return trimmed + fmt.Sprintf(" OFFSET %d ROWS FETCH NEXT %d ROWS ONLY", offset, limit)
}
