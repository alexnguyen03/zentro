// Package db — Query executor engine.
// Pattern: Strategy — ExecuteQuery dispatches to SELECT vs non-SELECT path.
// Pattern: Observer — result delivered via buffered channel (async-safe).
package db

import (
	"context"
	"database/sql"
	"fmt"
	"regexp"
	"strings"
	"time"

	"zentro/internal/models"
)

// limitPattern matches queries that already contain a LIMIT or TOP clause.
var limitPattern = regexp.MustCompile(`(?i)\bLIMIT\b|\bTOP\b|\bOFFSET\b`)

// selectTopPattern matches "SELECT" at the start of a trimmed query (case-insensitive),
// used to inject TOP N for MSSQL.
var selectTopPattern = regexp.MustCompile(`(?i)^(SELECT)(\s+)`)

// fromPattern matches "FROM [schema.]table" to extract for in-line editing.
var fromPattern = regexp.MustCompile(`(?i)\bFROM\s+([a-zA-Z0-9_"\[\]]+)(?:\.([a-zA-Z0-9_"\[\]]+))?`)

// IsSelectQuery returns true for read-only query types (SELECT, WITH, SHOW, EXPLAIN).
func IsSelectQuery(query string) bool {
	upper := strings.ToUpper(strings.TrimSpace(query))
	for _, prefix := range []string{"SELECT", "WITH", "SHOW", "EXPLAIN"} {
		if strings.HasPrefix(upper, prefix) {
			return true
		}
	}
	return false
}

// ExtractTableFromQuery tries to parse a simple SELECT query to find the target schema and table.
func ExtractTableFromQuery(query string) (schema, table string) {
	matches := fromPattern.FindStringSubmatch(query)
	if len(matches) < 2 {
		return "", ""
	}

	// If only one match, it's the table name.
	// If two matches (like schema.table), matches[1] is schema, matches[2] is table.
	if len(matches) == 3 && matches[2] != "" {
		schema = strings.Trim(matches[1], `"[]`)
		table = strings.Trim(matches[2], `"[]`)
	} else {
		table = strings.Trim(matches[1], `"[]`)
	}
	return schema, table
}

// InjectLimitIfMissing appends a row-limit clause to a SELECT query if none exists.
// Exported so internal/app can use it without duplicating the regex.
func InjectLimitIfMissing(query, driver string, limit int) string {
	return InjectLimitOffsetIfMissing(query, driver, limit, 0)
}

// InjectLimitOffsetIfMissing appends a row-limit and offset clause to a SELECT query if none exists.
func InjectLimitOffsetIfMissing(query, driver string, limit int, offset int) string {
	if limitPattern.MatchString(query) {
		return query
	}

	trimmed := strings.TrimSpace(query)

	if driver == "sqlserver" {
		if offset == 0 {
			return selectTopPattern.ReplaceAllString(trimmed, fmt.Sprintf("$1 TOP %d$2", limit))
		}
		// MSSQL >= 2012 requires ORDER BY for OFFSET/FETCH.
		// If the query doesn't have an ORDER BY, we must inject a dummy one.
		hasOrderBy := regexp.MustCompile(`(?i)\bORDER\s+BY\b`).MatchString(trimmed)
		if !hasOrderBy {
			trimmed = trimmed + " ORDER BY 1"
		}
		return trimmed + fmt.Sprintf(" OFFSET %d ROWS FETCH NEXT %d ROWS ONLY", offset, limit)
	}

	// Postgres / SQLite / MySQL
	if offset > 0 {
		return trimmed + fmt.Sprintf(" LIMIT %d OFFSET %d", limit, offset)
	}
	return trimmed + fmt.Sprintf(" LIMIT %d", limit)
}

// injectLimitIfMissing is kept for internal use and unit tests.
func injectLimitIfMissing(query, driver string, limit int) string {
	return InjectLimitIfMissing(query, driver, limit)
}

// streamRows scans all rows into memory. Caller is responsible for rows.Close().
func streamRows(rows *sql.Rows, colCount int) [][]interface{} {
	var result [][]interface{}
	for rows.Next() {
		row := make([]interface{}, colCount)
		ptrs := make([]interface{}, colCount)
		for i := range row {
			ptrs[i] = &row[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			continue
		}
		result = append(result, row)
	}
	return result
}

// ExecuteQuery runs a query asynchronously and delivers the result on the returned channel.
// The channel is buffered(1) and closed after the result is sent — safe to range over.
// Pattern: Observer — channel as event stream; caller consumes without blocking executor.
func ExecuteQuery(ctx context.Context, db *sql.DB, query string, defaultLimit int) <-chan *models.QueryResult {
	ch := make(chan *models.QueryResult, 1)

	go func() {
		defer close(ch)

		result := &models.QueryResult{}

		// Guard: no connection
		if db == nil {
			result.Err = fmt.Errorf("no active connection")
			ch <- result
			return
		}

		// Guard: empty query
		trimmed := strings.TrimSpace(query)
		if trimmed == "" {
			result.Err = fmt.Errorf("query is empty")
			ch <- result
			return
		}

		start := time.Now()

		if IsSelectQuery(trimmed) {
			result.IsSelect = true
			normalized := injectLimitIfMissing(trimmed, "", defaultLimit)

			rows, err := db.QueryContext(ctx, normalized)
			if err != nil {
				result.Err = fmt.Errorf("executor: query: %w", err)
				result.Duration = time.Since(start)
				ch <- result
				return
			}
			defer rows.Close()

			cols, _ := rows.Columns()
			result.Columns = cols
			result.Rows = streamRows(rows, len(cols))
		} else {
			res, err := db.ExecContext(ctx, trimmed)
			if err != nil {
				result.Err = fmt.Errorf("executor: exec: %w", err)
			} else {
				result.Affected, _ = res.RowsAffected()
			}
		}

		result.Duration = time.Since(start)
		ch <- result
	}()

	return ch
}
