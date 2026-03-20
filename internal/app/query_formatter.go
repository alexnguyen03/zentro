package app

import (
	"fmt"
	"strings"
)

type QueryFormatterService struct{}

func NewQueryFormatterService() *QueryFormatterService {
	return &QueryFormatterService{}
}

func (s *QueryFormatterService) FormatSQL(query string, dialect string) (string, error) {
	trimmed := strings.TrimSpace(query)
	if trimmed == "" {
		return "", fmt.Errorf("format: query is empty")
	}

	switch strings.ToLower(strings.TrimSpace(dialect)) {
	case "", "postgres", "mysql", "sqlserver", "sqlite":
	default:
		return "", fmt.Errorf("format: unsupported dialect %q", dialect)
	}

	tokens := tokenizeSQL(trimmed)
	if len(tokens) == 0 {
		return "", fmt.Errorf("format: query is empty")
	}

	var out strings.Builder
	indent := 0
	lineStart := true

	write := func(text string) {
		if lineStart {
			if indent > 0 {
				out.WriteString(strings.Repeat("  ", indent))
			}
			lineStart = false
		}
		out.WriteString(text)
	}
	newLine := func() {
		out.WriteString("\n")
		lineStart = true
	}

	for i := 0; i < len(tokens); i++ {
		tok := tokens[i]
		upper := strings.ToUpper(tok)
		nextUpper := ""
		if i+1 < len(tokens) {
			nextUpper = strings.ToUpper(tokens[i+1])
		}

		switch upper {
		case ",":
			write(",")
			newLine()
			continue
		case "(":
			if strings.EqualFold(nextUpper, "SELECT") {
				write("(")
				newLine()
				indent++
				continue
			}
			write("(")
			continue
		case ")":
			if indent > 0 {
				indent--
			}
			if !lineStart {
				newLine()
			}
			write(")")
			continue
		case ";":
			write(";")
			if i < len(tokens)-1 {
				newLine()
				newLine()
			}
			continue
		}

		if isClauseKeyword(upper) {
			if !lineStart {
				newLine()
			}
			if upper == "AND" || upper == "OR" {
				if indent == 0 {
					indent = 1
				}
			}
			write(upper)
			if upper == "SELECT" || upper == "FROM" || upper == "WHERE" || upper == "GROUP" || upper == "ORDER" || upper == "HAVING" || upper == "SET" || upper == "VALUES" {
				write(" ")
			}
			continue
		}

		if !lineStart && !needsNoLeadingSpace(tok) {
			write(" ")
		}
		write(tok)
	}

	return strings.TrimSpace(out.String()), nil
}

func tokenizeSQL(query string) []string {
	var tokens []string
	var current strings.Builder
	inSingle := false
	inDouble := false

	flush := func() {
		if current.Len() == 0 {
			return
		}
		tokens = append(tokens, current.String())
		current.Reset()
	}

	for _, r := range query {
		switch {
		case r == '\'' && !inDouble:
			current.WriteRune(r)
			inSingle = !inSingle
		case r == '"' && !inSingle:
			current.WriteRune(r)
			inDouble = !inDouble
		case inSingle || inDouble:
			current.WriteRune(r)
		case r == '(' || r == ')' || r == ',' || r == ';':
			flush()
			tokens = append(tokens, string(r))
		case r == ' ' || r == '\n' || r == '\t' || r == '\r':
			flush()
		default:
			current.WriteRune(r)
		}
	}
	flush()
	return tokens
}

func isClauseKeyword(tok string) bool {
	switch tok {
	case "SELECT", "FROM", "WHERE", "GROUP", "BY", "ORDER", "HAVING", "LIMIT", "OFFSET",
		"INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE", "JOIN", "LEFT", "RIGHT",
		"INNER", "OUTER", "ON", "UNION", "ALL", "WITH", "AS", "AND", "OR":
		return true
	default:
		return false
	}
}

func needsNoLeadingSpace(tok string) bool {
	return tok == ")" || tok == "," || tok == ";"
}
