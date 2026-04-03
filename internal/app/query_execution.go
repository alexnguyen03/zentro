package app

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"time"

	"zentro/internal/constant"
	dbpkg "zentro/internal/db"
)

var routineDDLPattern = regexp.MustCompile(`(?is)\b(create|alter|drop)\s+(or\s+replace\s+)?(function|procedure)\b`)

func (s *QueryService) streamSelect(ctx context.Context, executor sqlExecutor, statement queryStatement, offset int, start time.Time) error {
	driver := s.getDriver()
	db := s.getDB()
	prefs := s.getPrefs()
	fetchLimit := prefs.DefaultLimit

	checkLimit := fetchLimit + 1
	normalized := dbpkg.InjectPageClause(driver, statement.Text, checkLimit, offset)

	if normalized == statement.Text && offset > 0 {
		s.emitDoneWithMore(statement, 0, time.Since(start), true, false, nil)
		return nil
	}

	rows, err := executor.QueryContext(ctx, normalized)
	if err != nil {
		wrappedErr := fmt.Errorf("query: %w", err)
		s.emitDoneWithMore(statement, 0, time.Since(start), true, false, wrappedErr)
		return wrappedErr
	}
	defer rows.Close()

	cols, _ := rows.Columns()
	colCount := len(cols)

	var tableName string
	var pks []string
	if offset == 0 && !statement.SkipEditableMeta {
		parsedSchema, table := dbpkg.ExtractTableFromQuery(statement.Text)
		if table != "" {
			tableName = table
			if db == nil {
				s.logger.Warn("skipping primary key lookup because active db is nil", "tab", statement.TabID, "table", table)
			} else {
				trySchemas := []string{parsedSchema}
				if parsedSchema == "" {
					trySchemas = []string{}
					if currentSchema := s.currentSchema(); currentSchema != "" {
						trySchemas = append(trySchemas, currentSchema)
					}
					if d, ok := getDriver(driver); ok {
						defaultSchema := d.DefaultSchema()
						hasDefault := false
						for _, schema := range trySchemas {
							if strings.EqualFold(schema, defaultSchema) {
								hasDefault = true
								break
							}
						}
						if !hasDefault {
							trySchemas = append(trySchemas, defaultSchema)
						}
					} else {
						trySchemas = append(trySchemas, "")
					}
				} else {
					trySchemas = []string{parsedSchema}
				}
				for _, sch := range trySchemas {
					keys, err := dbpkg.FetchTablePrimaryKeys(db, driver, sch, table)
					if err == nil && len(keys) > 0 {
						pks = keys
						s.logger.Info("pk fetch ok", "table", table, "schema", sch, "pks", keys)
						break
					}
					s.logger.Warn("pk fetch failed", "table", table, "schema", sch, "err", err)
				}
			}
		}
	}

	chunkSize := prefs.ChunkSize
	if chunkSize == 0 {
		chunkSize = 500
	}

	seq := 0
	buf := make([][]string, 0, chunkSize)
	sentCols := false
	totalRowsFetched := 0
	hasMore := false

	for rows.Next() {
		if ctx.Err() != nil || s.isCancelled(statement.SourceTabID) {
			break
		}
		row := scanRowAsStrings(rows, colCount)
		totalRowsFetched++
		if totalRowsFetched > fetchLimit {
			hasMore = true
			break
		}
		buf = append(buf, row)

		if len(buf) == chunkSize {
			var chunkCols []string
			if !sentCols {
				chunkCols = cols
				sentCols = true
				EmitVersionedEvent(s.emitter, s.ctx, constant.EventQueryChunk, constant.EventQueryChunkV2, buildChunk(statement, chunkCols, buf, seq, tableName, pks))
			} else {
				EmitVersionedEvent(s.emitter, s.ctx, constant.EventQueryChunk, constant.EventQueryChunkV2, buildChunk(statement, chunkCols, buf, seq, "", nil))
			}
			buf = nil
			seq++
		}
	}

	if len(buf) > 0 || !sentCols {
		var chunkCols []string
		if !sentCols {
			chunkCols = cols
			EmitVersionedEvent(s.emitter, s.ctx, constant.EventQueryChunk, constant.EventQueryChunkV2, buildChunk(statement, chunkCols, buf, seq, tableName, pks))
		} else {
			EmitVersionedEvent(s.emitter, s.ctx, constant.EventQueryChunk, constant.EventQueryChunkV2, buildChunk(statement, chunkCols, buf, seq, "", nil))
		}
	}

	if hasMore {
		totalRowsFetched = fetchLimit
	}

	totalRows := int64(seq*chunkSize + len(buf))
	duration := time.Since(start)
	if s.isCancelled(statement.SourceTabID) || ctx.Err() == context.Canceled {
		err = context.Canceled
	}
	if rows.Err() != nil && err == nil {
		err = rows.Err()
	}
	if offset == 0 {
		s.appendHistory(statement.Text, totalRows, duration, err)
		s.trackQueryExecution(statement, totalRows, duration, true, err)
	}
	if err == context.Canceled {
		s.emitDoneWithMore(statement, int64(totalRowsFetched), duration, true, hasMore, fmt.Errorf("query cancelled"))
		return err
	}
	s.emitDoneWithMore(statement, int64(totalRowsFetched), duration, true, hasMore, err)
	s.logger.Debug("query profile", "stage", "stream-select", "tab", statement.TabID, "rows", totalRowsFetched, "duration_ms", duration.Milliseconds())
	return err
}

func (s *QueryService) FetchMoreRows(tabID string, offset int) {
	s.activeQueriesMu.Lock()
	query, ok := s.activeQueries[tabID]
	s.activeQueriesMu.Unlock()

	if !ok || query == "" {
		s.emitDone(queryStatement{SourceTabID: sourceTabID(tabID), TabID: tabID, Text: query, Index: 0, Count: 1}, 0, 0, true, fmt.Errorf("no active query found for pagination"))
		return
	}

	driver := s.getDriver()
	executor := s.getExecutor()
	prefs := s.getPrefs()
	limit := prefs.DefaultLimit

	checkLimit := limit + 1
	paginatedQuery := dbpkg.InjectPageClause(driver, query, checkLimit, offset)

	if paginatedQuery == query && offset > 0 {
		s.emitDoneWithMore(queryStatement{SourceTabID: sourceTabID(tabID), TabID: tabID, Text: query, Index: 0, Count: 1}, 0, 0, true, false, nil)
		return
	}

	s.sessionsMu.Lock()
	sourceID := sourceTabID(tabID)
	s.clearCancelled(sourceID)
	if old, ok := s.sessions[sourceID]; ok {
		old.CancelFunc()
		delete(s.sessions, sourceID)
	}

	ctx, cancel := context.WithCancel(s.ctx)
	session := &QuerySession{
		TabID:      sourceID,
		StartedAt:  time.Now(),
		CancelFunc: cancel,
	}
	s.sessions[sourceID] = session
	s.sessionsMu.Unlock()

	go func() {
		defer func() {
			s.sessionsMu.Lock()
			cancel()
			if s.sessions[sourceID] == session {
				delete(s.sessions, sourceID)
			}
			s.sessionsMu.Unlock()
		}()

		if !isExecutorReady(executor) {
			s.emitDone(queryStatement{SourceTabID: sourceID, TabID: tabID, Text: query, Index: 0, Count: 1}, 0, 0, true, fmt.Errorf("no active connection"))
			return
		}

		start := time.Now()
		queryExecutor, releaseExecutor, prepErr := s.prepareExecutor(ctx, executor)
		if prepErr != nil {
			s.emitDone(queryStatement{SourceTabID: sourceID, TabID: tabID, Text: query, Index: 0, Count: 1}, 0, 0, true, fmt.Errorf("fetch more: prepare query context failed: %w", prepErr))
			return
		}
		defer releaseExecutor()

		rows, err := queryExecutor.QueryContext(ctx, paginatedQuery)
		if err != nil {
			s.emitDone(queryStatement{SourceTabID: sourceID, TabID: tabID, Text: query, Index: 0, Count: 1}, 0, 0, true, fmt.Errorf("fetch more: query failed: %w", err))
			return
		}
		defer rows.Close()

		cols, err := rows.Columns()
		if err != nil {
			s.emitDone(queryStatement{SourceTabID: sourceID, TabID: tabID, Text: query, Index: 0, Count: 1}, 0, 0, true, fmt.Errorf("fetch more: columns error: %w", err))
			return
		}

		var chunk [][]string
		seq := 0
		rowCount := 0
		hasMore := false

		for rows.Next() {
			if ctx.Err() != nil || s.isCancelled(sourceID) {
				break
			}
			row := scanRowAsStrings(rows, len(cols))
			rowCount++
			if rowCount > limit {
				hasMore = true
				break
			}
			chunk = append(chunk, row)

			if len(chunk) >= 500 {
				EmitVersionedEvent(s.emitter, s.ctx, constant.EventQueryChunk, constant.EventQueryChunkV2, buildChunk(queryStatement{SourceTabID: sourceID, TabID: tabID, Text: query, Index: 0, Count: 1}, cols, chunk, seq, "", nil))
				chunk = nil
				seq++
			}
		}

		if len(chunk) > 0 {
			EmitVersionedEvent(s.emitter, s.ctx, constant.EventQueryChunk, constant.EventQueryChunkV2, buildChunk(queryStatement{SourceTabID: sourceID, TabID: tabID, Text: query, Index: 0, Count: 1}, cols, chunk, seq, "", nil))
		}

		duration := time.Since(start)

		if hasMore {
			rowCount = limit
		}

		if s.isCancelled(sourceID) || ctx.Err() == context.Canceled {
			s.emitDoneWithMore(queryStatement{SourceTabID: sourceID, TabID: tabID, Text: query, Index: 0, Count: 1}, int64(rowCount), duration, true, hasMore, fmt.Errorf("query cancelled"))
			return
		}
		s.emitDoneWithMore(queryStatement{SourceTabID: sourceID, TabID: tabID, Text: query, Index: 0, Count: 1}, int64(rowCount), duration, true, hasMore, nil)
	}()
}

func (s *QueryService) execNonSelect(ctx context.Context, executor sqlExecutor, statement queryStatement, start time.Time) error {
	res, err := executor.ExecContext(ctx, statement.Text)
	dur := time.Since(start)
	if err != nil {
		wrappedErr := fmt.Errorf("exec: %w", err)
		s.appendHistory(statement.Text, 0, dur, wrappedErr)
		s.trackQueryExecution(statement, 0, dur, false, wrappedErr)
		s.emitDone(statement, 0, dur, false, wrappedErr)
		return wrappedErr
	}
	affected, _ := res.RowsAffected()
	s.appendHistory(statement.Text, affected, dur, nil)
	s.trackQueryExecution(statement, affected, dur, false, nil)
	if s.onRoutineDDL != nil && routineDDLPattern.MatchString(statement.Text) {
		s.onRoutineDDL(statement.Text)
	}
	s.emitDone(statement, affected, dur, false, nil)
	return nil
}

func (s *QueryService) FetchTotalRowCount(tabID string) (int64, error) {
	s.activeQueriesMu.Lock()
	query, ok := s.activeQueries[tabID]
	s.activeQueriesMu.Unlock()

	if !ok || query == "" {
		return 0, fmt.Errorf("no active query found for count")
	}

	executor := s.getExecutor()
	if !isExecutorReady(executor) {
		return 0, fmt.Errorf("no active connection")
	}

	cleanQuery := strings.TrimRight(strings.TrimSpace(query), ";")
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM (%s\n) AS zentro_count", cleanQuery)

	var count int64
	ctx, cancel := context.WithTimeout(s.ctx, 30*time.Second)
	defer cancel()
	queryExecutor, releaseExecutor, prepErr := s.prepareExecutor(ctx, executor)
	if prepErr != nil {
		return 0, fmt.Errorf("prepare query context failed: %w", prepErr)
	}
	defer releaseExecutor()

	err := queryExecutor.QueryRowContext(ctx, countQuery).Scan(&count)
	if err != nil {
		return 0, err
	}
	return count, nil
}

func (s *QueryService) CancelQuery(tabID string) {
	s.sessionsMu.Lock()
	defer s.sessionsMu.Unlock()
	sourceID := sourceTabID(tabID)
	s.markCancelled(sourceID)
	if session, ok := s.sessions[sourceID]; ok {
		s.logger.Info("cancelling query", "tab", tabID)
		session.CancelFunc()
		delete(s.sessions, sourceID)
	}
}

func (s *QueryService) ExecuteUpdateSync(query string) (int64, error) {
	if s.getPrefs().ViewMode {
		return 0, fmt.Errorf("view mode is enabled: write statements are blocked")
	}
	if err := s.validateStrictWriteSafety([]string{query}); err != nil {
		return 0, err
	}

	executor := s.getExecutor()
	if !isExecutorReady(executor) {
		return 0, fmt.Errorf("no active connection")
	}
	queryExecutor, releaseExecutor, prepErr := s.prepareExecutor(s.ctx, executor)
	if prepErr != nil {
		return 0, fmt.Errorf("prepare query context failed: %w", prepErr)
	}
	defer releaseExecutor()

	res, err := queryExecutor.ExecContext(s.ctx, query)
	if err != nil {
		return 0, err
	}

	return res.RowsAffected()
}

func (s *QueryService) validateStrictWriteSafety(statements []string) error {
	if !s.isStrictWriteSafetyEnvironment() {
		return nil
	}
	for _, statement := range statements {
		risk := dbpkg.AnalyzeStatementRisk(statement)
		if risk.UpdateNoWhere {
			return fmt.Errorf("write safety policy: UPDATE without WHERE is blocked in strict environment")
		}
		if risk.DeleteNoWhere {
			return fmt.Errorf("write safety policy: DELETE without WHERE is blocked in strict environment")
		}
	}
	return nil
}

func (s *QueryService) isStrictWriteSafetyEnvironment() bool {
	if s.getCurrentEnvironmentKey == nil {
		return false
	}
	environmentKey := strings.TrimSpace(s.getCurrentEnvironmentKey())
	return strings.EqualFold(environmentKey, "pro") || strings.EqualFold(environmentKey, "sta")
}
