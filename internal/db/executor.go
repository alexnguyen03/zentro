// Package db — Query executor engine.
package db

import (
	"fmt"
	"regexp"
	"strings"
)

// limitPattern matches queries that already contain a LIMIT, TOP, or OFFSET clause.
// Covers: LIMIT, OFFSET, TOP, FETCH (MSSQL), and MySQL legacy LIMIT x,y syntax
var limitPattern = regexp.MustCompile(`(?i)\bLIMIT\b|\bOFFSET\b|\bTOP\b|\bFETCH\b`)

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
