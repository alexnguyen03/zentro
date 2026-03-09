// Package db — Query executor engine.
package db

import (
	"fmt"
	"regexp"
	"strings"

	"zentro/internal/core"
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

// InjectPageClause delegates pagination generation to the registered driver.
func InjectPageClause(driverName, query string, limit, offset int) string {
	d, ok := core.Get(driverName)
	if !ok {
		return fallbackInjectPage(query, limit, offset)
	}
	if dialect, ok := d.(interface {
		InjectPageClause(query string, limit, offset int) string
	}); ok {
		return dialect.InjectPageClause(query, limit, offset)
	}
	return fallbackInjectPage(query, limit, offset)
}

func fallbackInjectPage(query string, limit, offset int) string {
	if limitPattern.MatchString(query) {
		return query
	}
	trimmed := strings.TrimSpace(query)
	if offset > 0 {
		return trimmed + fmt.Sprintf(" LIMIT %d OFFSET %d", limit, offset)
	}
	return trimmed + fmt.Sprintf(" LIMIT %d", limit)
}
