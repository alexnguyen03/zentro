package app

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// ExportAllRows returns the full result set for the latest active SELECT query of a tab,
// without applying pagination clauses used by viewport rendering.
func (s *QueryService) ExportAllRows(tabID string) ([]string, [][]string, error) {
	s.activeQueriesMu.RLock()
	query, ok := s.activeQueries[tabID]
	s.activeQueriesMu.RUnlock()

	if !ok || strings.TrimSpace(query) == "" {
		return nil, nil, fmt.Errorf("no active query found for export")
	}

	executor := s.getExecutor()
	if !isExecutorReady(executor) {
		return nil, nil, fmt.Errorf("no active connection")
	}

	timeout := time.Duration(s.getPrefs().QueryTimeout) * time.Second
	exportCtx := s.ctx
	cancel := func() {}
	if timeout > 0 {
		exportCtx, cancel = context.WithTimeout(s.ctx, timeout)
	}
	defer cancel()

	queryExecutor, releaseExecutor, prepErr := s.prepareExecutor(exportCtx, executor)
	if prepErr != nil {
		return nil, nil, fmt.Errorf("export: prepare query context failed: %w", prepErr)
	}
	defer releaseExecutor()

	rows, err := queryExecutor.QueryContext(exportCtx, query)
	if err != nil {
		return nil, nil, fmt.Errorf("export: query failed: %w", err)
	}
	defer rows.Close()

	cols, err := rows.Columns()
	if err != nil {
		return nil, nil, fmt.Errorf("export: columns error: %w", err)
	}

	colCount := len(cols)
	resultRows := make([][]string, 0, 1024)
	for rows.Next() {
		if exportCtx.Err() != nil {
			return nil, nil, exportCtx.Err()
		}
		resultRows = append(resultRows, scanRowAsStrings(rows, colCount))
	}

	if err := rows.Err(); err != nil {
		return nil, nil, fmt.Errorf("export: row iteration failed: %w", err)
	}

	return cols, resultRows, nil
}
