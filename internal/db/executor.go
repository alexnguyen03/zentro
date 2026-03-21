// Package db — Query executor engine.
package db

import (
	"regexp"
	"strconv"
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
	var b strings.Builder
	b.Grow(len(trimmed) + 32)
	b.WriteString(trimmed)
	b.WriteString(" LIMIT ")
	b.WriteString(strconv.Itoa(limit))
	if offset > 0 {
		b.WriteString(" OFFSET ")
		b.WriteString(strconv.Itoa(offset))
	}
	return b.String()
}

// SplitStatements separates SQL statements on semicolons outside of strings/comments.
func SplitStatements(query string) []string {
	var statements []string
	var current strings.Builder

	inSingle := false
	inDouble := false
	inBacktick := false
	inLineComment := false
	inBlockComment := false

	runes := []rune(query)
	for i := 0; i < len(runes); i++ {
		ch := runes[i]
		next := rune(0)
		if i+1 < len(runes) {
			next = runes[i+1]
		}

		if inLineComment {
			current.WriteRune(ch)
			if ch == '\n' {
				inLineComment = false
			}
			continue
		}

		if inBlockComment {
			current.WriteRune(ch)
			if ch == '*' && next == '/' {
				current.WriteRune(next)
				i++
				inBlockComment = false
			}
			continue
		}

		if !inSingle && !inDouble && !inBacktick {
			if ch == '-' && next == '-' {
				current.WriteRune(ch)
				current.WriteRune(next)
				i++
				inLineComment = true
				continue
			}
			if ch == '/' && next == '*' {
				current.WriteRune(ch)
				current.WriteRune(next)
				i++
				inBlockComment = true
				continue
			}
		}

		switch ch {
		case '\'':
			current.WriteRune(ch)
			if !inDouble && !inBacktick {
				if inSingle && next == '\'' {
					current.WriteRune(next)
					i++
				} else {
					inSingle = !inSingle
				}
			}
		case '"':
			current.WriteRune(ch)
			if !inSingle && !inBacktick {
				if inDouble && next == '"' {
					current.WriteRune(next)
					i++
				} else {
					inDouble = !inDouble
				}
			}
		case '`':
			current.WriteRune(ch)
			if !inSingle && !inDouble {
				inBacktick = !inBacktick
			}
		case ';':
			if inSingle || inDouble || inBacktick {
				current.WriteRune(ch)
				continue
			}
			statement := strings.TrimSpace(current.String())
			if statement != "" {
				statements = append(statements, statement)
			}
			current.Reset()
		default:
			current.WriteRune(ch)
		}
	}

	statement := strings.TrimSpace(current.String())
	if statement != "" {
		statements = append(statements, statement)
	}

	return statements
}
