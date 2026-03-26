// Package postgres implements the DatabaseDriver port for PostgreSQL.
package postgres

import (
	"database/sql"
	"fmt"
	"log/slog"
	"net/url"
	"regexp"
	"strings"
	"time"

	"zentro/internal/models"
)

// PostgresDriver is the Adapter for PostgreSQL.
type PostgresDriver struct{}

// New returns a new PostgresDriver.
func New() *PostgresDriver {
	return &PostgresDriver{}
}

func (d *PostgresDriver) Name() string { return "postgres" }

// Open builds a DSN and opens a *sql.DB with sensible pool defaults.
func (d *PostgresDriver) Open(p *models.ConnectionProfile) (*sql.DB, error) {
	userInfo := url.UserPassword(p.Username, p.Password).String()
	dsn := fmt.Sprintf(
		"postgres://%s@%s:%d/%s?sslmode=%s&connect_timeout=%d",
		userInfo, p.Host, p.Port, p.DBName, p.SSLMode, p.ConnectTimeout,
	)

	maskedUserInfo := url.UserPassword(p.Username, "***").String()
	masked := fmt.Sprintf(
		"postgres://%s@%s:%d/%s?sslmode=%s&connect_timeout=%d",
		maskedUserInfo, p.Host, p.Port, p.DBName, p.SSLMode, p.ConnectTimeout,
	)
	slog.Info("postgres: open", "dsn", masked)

	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, fmt.Errorf("postgres: open: %w", err)
	}
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)
	db.SetConnMaxIdleTime(2 * time.Minute)
	return db, nil
}

// FriendlyError maps raw PostgreSQL errors to user-readable messages.
func (d *PostgresDriver) FriendlyError(err error) error {
	if err == nil {
		return nil
	}
	msg := strings.ToLower(err.Error())
	switch {
	case containsAny(msg, "authentication failed", "password authentication failed"):
		return fmt.Errorf("authentication failed â€” check username and password")
	case containsAny(msg, "connection refused"):
		return fmt.Errorf("connection refused â€” check host and port")
	case containsAny(msg, "no such host", "name resolution"):
		return fmt.Errorf("host not found â€” check hostname")
	case containsAny(msg, "context deadline exceeded", "timeout"):
		return fmt.Errorf("connection timed out â€” check host/port or firewall")
	case containsAny(msg, "database", "does not exist"):
		return fmt.Errorf("database not found â€” check database name")
	default:
		return fmt.Errorf("postgres error: %s", err.Error())
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

func (d *PostgresDriver) DefaultSchema() string { return "public" }

func (d *PostgresDriver) InjectPageClause(query string, limit, offset int) string {
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
