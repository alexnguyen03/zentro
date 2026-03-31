package db

import "strings"

type WriteOperation string

const (
	WriteOperationUnknown    WriteOperation = "unknown"
	WriteOperationRead       WriteOperation = "read"
	WriteOperationUpdate     WriteOperation = "update"
	WriteOperationDelete     WriteOperation = "delete"
	WriteOperationAlter      WriteOperation = "alter"
	WriteOperationDrop       WriteOperation = "drop"
	WriteOperationTruncate   WriteOperation = "truncate"
	WriteOperationMerge      WriteOperation = "merge"
	WriteOperationReplace    WriteOperation = "replace"
	WriteOperationInsert     WriteOperation = "insert"
	WriteOperationCreate     WriteOperation = "create"
	WriteOperationOtherWrite WriteOperation = "other_write"
)

type StatementRisk struct {
	Statement     string
	Operation     WriteOperation
	HasWhere      bool
	Destructive   bool
	UpdateNoWhere bool
	DeleteNoWhere bool
}

type SQLRisk struct {
	Statements       []StatementRisk
	Operations       []WriteOperation
	HasWrite         bool
	HasDestructive   bool
	HasUpdateNoWhere bool
	HasDeleteNoWhere bool
}

func AnalyzeSQLRisk(query string) SQLRisk {
	statements := SplitStatements(query)
	if len(statements) == 0 {
		statements = []string{query}
	}

	analyses := make([]StatementRisk, 0, len(statements))
	opsSeen := make(map[WriteOperation]struct{})
	ops := make([]WriteOperation, 0, 4)
	hasWrite := false
	hasDestructive := false
	hasUpdateNoWhere := false
	hasDeleteNoWhere := false

	for _, statement := range statements {
		analysis := AnalyzeStatementRisk(statement)
		if strings.TrimSpace(analysis.Statement) == "" {
			continue
		}
		analyses = append(analyses, analysis)
		if analysis.Operation != WriteOperationUnknown {
			if _, exists := opsSeen[analysis.Operation]; !exists {
				opsSeen[analysis.Operation] = struct{}{}
				ops = append(ops, analysis.Operation)
			}
		}
		if isWriteOperation(analysis.Operation) {
			hasWrite = true
		}
		if analysis.Destructive {
			hasDestructive = true
		}
		if analysis.UpdateNoWhere {
			hasUpdateNoWhere = true
		}
		if analysis.DeleteNoWhere {
			hasDeleteNoWhere = true
		}
	}

	return SQLRisk{
		Statements:       analyses,
		Operations:       ops,
		HasWrite:         hasWrite,
		HasDestructive:   hasDestructive,
		HasUpdateNoWhere: hasUpdateNoWhere,
		HasDeleteNoWhere: hasDeleteNoWhere,
	}
}

func AnalyzeStatementRisk(statement string) StatementRisk {
	trimmed := strings.TrimSpace(statement)
	tokens := tokenizeSQL(trimmed)
	operation := resolveStatementOperation(tokens)
	hasWhere := hasToken(tokens, "where")
	destructive := isDestructiveOperation(operation)
	updateNoWhere := operation == WriteOperationUpdate && !hasWhere
	deleteNoWhere := operation == WriteOperationDelete && !hasWhere

	return StatementRisk{
		Statement:     trimmed,
		Operation:     operation,
		HasWhere:      hasWhere,
		Destructive:   destructive,
		UpdateNoWhere: updateNoWhere,
		DeleteNoWhere: deleteNoWhere,
	}
}

func hasToken(tokens []string, target string) bool {
	for _, token := range tokens {
		if token == target {
			return true
		}
	}
	return false
}

func resolveStatementOperation(tokens []string) WriteOperation {
	if len(tokens) == 0 {
		return WriteOperationUnknown
	}

	candidate := tokens[0]
	if candidate == "with" {
		candidate = "unknown"
		for _, keyword := range []string{
			"update", "delete", "alter", "drop", "truncate", "merge", "replace",
			"insert", "create", "select", "show", "explain", "describe", "desc",
		} {
			if hasToken(tokens, keyword) {
				candidate = keyword
				break
			}
		}
	}

	switch candidate {
	case "update":
		return WriteOperationUpdate
	case "delete":
		return WriteOperationDelete
	case "alter":
		return WriteOperationAlter
	case "drop":
		return WriteOperationDrop
	case "truncate":
		return WriteOperationTruncate
	case "merge":
		return WriteOperationMerge
	case "replace":
		return WriteOperationReplace
	case "insert":
		return WriteOperationInsert
	case "create":
		return WriteOperationCreate
	case "select", "show", "explain", "describe", "desc":
		return WriteOperationRead
	default:
		return WriteOperationUnknown
	}
}

func isWriteOperation(operation WriteOperation) bool {
	switch operation {
	case WriteOperationUpdate, WriteOperationDelete, WriteOperationAlter, WriteOperationDrop,
		WriteOperationTruncate, WriteOperationMerge, WriteOperationReplace,
		WriteOperationInsert, WriteOperationCreate, WriteOperationOtherWrite:
		return true
	default:
		return false
	}
}

func isDestructiveOperation(operation WriteOperation) bool {
	switch operation {
	case WriteOperationUpdate, WriteOperationDelete, WriteOperationAlter,
		WriteOperationDrop, WriteOperationTruncate, WriteOperationMerge, WriteOperationReplace:
		return true
	default:
		return false
	}
}

func tokenizeSQL(query string) []string {
	tokens := make([]string, 0, 16)
	var word strings.Builder
	flush := func() {
		if word.Len() == 0 {
			return
		}
		tokens = append(tokens, strings.ToLower(word.String()))
		word.Reset()
	}

	inSingle := false
	inDouble := false
	inBacktick := false
	inBracket := false
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
			if ch == '\n' {
				inLineComment = false
			}
			continue
		}

		if inBlockComment {
			if ch == '*' && next == '/' {
				i++
				inBlockComment = false
			}
			continue
		}

		if !inSingle && !inDouble && !inBacktick && !inBracket {
			if ch == '-' && next == '-' {
				flush()
				i++
				inLineComment = true
				continue
			}
			if ch == '/' && next == '*' {
				flush()
				i++
				inBlockComment = true
				continue
			}
		}

		if ch == '\'' && !inDouble && !inBacktick && !inBracket {
			flush()
			if inSingle && next == '\'' {
				i++
			} else {
				inSingle = !inSingle
			}
			continue
		}

		if ch == '"' && !inSingle && !inBacktick && !inBracket {
			flush()
			if inDouble && next == '"' {
				i++
			} else {
				inDouble = !inDouble
			}
			continue
		}

		if ch == '`' && !inSingle && !inDouble && !inBracket {
			flush()
			inBacktick = !inBacktick
			continue
		}

		if ch == '[' && !inSingle && !inDouble && !inBacktick {
			flush()
			inBracket = true
			continue
		}

		if ch == ']' && inBracket {
			flush()
			inBracket = false
			continue
		}

		if inSingle || inDouble || inBacktick || inBracket {
			continue
		}

		if (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch == '_' {
			word.WriteRune(ch)
			continue
		}
		if ((ch >= '0' && ch <= '9') || ch == '$') && word.Len() > 0 {
			word.WriteRune(ch)
			continue
		}

		flush()
	}

	flush()
	return tokens
}
