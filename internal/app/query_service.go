package app

import (
	"context"
	"database/sql"
	"encoding/hex"
	"fmt"
	"log/slog"
	"strconv"
	"strings"
	"sync"
	"time"

	"zentro/internal/constant"
	dbpkg "zentro/internal/db"
	"zentro/internal/utils"
)

func isExecutorReady(executor sqlExecutor) bool {
	switch exec := executor.(type) {
	case nil:
		return false
	case *sql.DB:
		return exec != nil
	case *sql.Tx:
		return exec != nil
	default:
		return true
	}
}

type sqlExecutor interface {
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}

type queryStatement struct {
	SourceTabID      string
	TabID            string
	Text             string
	Index            int
	Count            int
	SkipEditableMeta bool
}

type QueryService struct {
	ctx           context.Context
	logger        *slog.Logger
	getPrefs      func() utils.Preferences
	getDB         func() *sql.DB
	getExecutor   func() sqlExecutor
	getDriver     func() string
	appendHistory func(query string, rowCount int64, dur time.Duration, err error)
	emitter       EventEmitter

	sessions   map[string]*QuerySession
	sessionsMu sync.Mutex

	activeQueries   map[string]string
	activeQueriesMu sync.RWMutex
}

func NewQueryService(
	ctx context.Context, logger *slog.Logger, getPrefs func() utils.Preferences,
	getDB func() *sql.DB, getExecutor func() sqlExecutor, getDriver func() string,
	appendHistory func(query string, rowCount int64, dur time.Duration, err error),
	emitter EventEmitter,
) *QueryService {
	return &QueryService{
		ctx:           ctx,
		logger:        logger,
		getPrefs:      getPrefs,
		getDB:         getDB,
		getExecutor:   getExecutor,
		getDriver:     getDriver,
		appendHistory: appendHistory,
		emitter:       emitter,
		sessions:      make(map[string]*QuerySession),
		activeQueries: make(map[string]string),
	}
}

func (s *QueryService) SetContext(ctx context.Context) {
	s.ctx = ctx
}

func (s *QueryService) Shutdown() {
	s.sessionsMu.Lock()
	defer s.sessionsMu.Unlock()
	for _, session := range s.sessions {
		if session.CancelFunc != nil {
			session.CancelFunc()
		}
	}
	s.sessions = make(map[string]*QuerySession)
}

func (s *QueryService) ExecuteQuery(tabID, query string) {
	s.executeQueryWithOptions(tabID, query, false)
}

func (s *QueryService) ExplainQuery(tabID, query string, analyze bool) error {
	driver := s.getDriver()
	explainSQL, err := buildExplainQuery(driver, query, analyze)
	if err != nil {
		return err
	}

	s.executeQueryWithOptions(tabID, explainSQL, true)
	return nil
}

func (s *QueryService) executeQueryWithOptions(tabID, query string, skipEditableMeta bool) {
	statements := dbpkg.SplitStatements(query)
	if len(statements) == 0 {
		EmitVersionedEvent(s.emitter, s.ctx, constant.EventQueryStarted, constant.EventQueryStartedV2, QueryStartedEvent{
			TabID:          tabID,
			SourceTabID:    tabID,
			Query:          query,
			StatementText:  query,
			StatementIndex: 0,
			StatementCount: 1,
		})
		s.emitDoneWithMore(queryStatement{
			SourceTabID:      tabID,
			TabID:            tabID,
			Text:             query,
			Index:            0,
			Count:            1,
			SkipEditableMeta: skipEditableMeta,
		}, 0, 0, false, false, fmt.Errorf("no executable SQL statement found"))
		return
	}

	prefs := s.getPrefs()
	if prefs.ViewMode && dbpkg.BatchHasMutatingStatements(statements) {
		err := fmt.Errorf("view mode is enabled: write statements are blocked")
		EmitVersionedEvent(s.emitter, s.ctx, constant.EventQueryStarted, constant.EventQueryStartedV2, QueryStartedEvent{
			TabID:          tabID,
			SourceTabID:    tabID,
			Query:          query,
			StatementText:  query,
			StatementIndex: 0,
			StatementCount: len(statements),
		})
		s.emitDoneWithMore(queryStatement{
			SourceTabID:      tabID,
			TabID:            tabID,
			Text:             query,
			Index:            0,
			Count:            len(statements),
			SkipEditableMeta: skipEditableMeta,
		}, 0, 0, false, false, err)
		return
	}

	s.sessionsMu.Lock()
	if old, ok := s.sessions[tabID]; ok {
		old.CancelFunc()
		delete(s.sessions, tabID)
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(prefs.QueryTimeout)*time.Second)
	session := &QuerySession{
		TabID:      tabID,
		CancelFunc: cancel,
		StartedAt:  time.Now(),
	}
	s.sessions[tabID] = session
	s.sessionsMu.Unlock()

	go func() {
		defer func() {
			s.sessionsMu.Lock()
			cancel()
			if s.sessions[tabID] == session {
				delete(s.sessions, tabID)
			}
			s.sessionsMu.Unlock()
		}()

		executor := s.getExecutor()
		if !isExecutorReady(executor) {
			s.emitDoneWithMore(queryStatement{
				SourceTabID:      tabID,
				TabID:            tabID,
				Text:             query,
				Index:            0,
				Count:            len(statements),
				SkipEditableMeta: skipEditableMeta,
			}, 0, 0, true, false, fmt.Errorf("no active connection"))
			return
		}

		for index, statementText := range statements {
			statement := queryStatement{
				SourceTabID:      tabID,
				TabID:            resultTabID(tabID, index),
				Text:             statementText,
				Index:            index,
				Count:            len(statements),
				SkipEditableMeta: skipEditableMeta,
			}

			EmitVersionedEvent(s.emitter, s.ctx, constant.EventQueryStarted, constant.EventQueryStartedV2, QueryStartedEvent{
				TabID:          statement.TabID,
				SourceTabID:    statement.SourceTabID,
				Query:          statement.Text,
				StatementText:  statement.Text,
				StatementIndex: statement.Index,
				StatementCount: statement.Count,
			})

			s.logger.Info("executing query statement", "tab", statement.TabID, "sourceTab", tabID, "statementIndex", index)

			if dbpkg.IsSelectQuery(statement.Text) {
				s.activeQueriesMu.Lock()
				s.activeQueries[statement.TabID] = statement.Text
				s.activeQueriesMu.Unlock()
			} else {
				s.activeQueriesMu.Lock()
				delete(s.activeQueries, statement.TabID)
				s.activeQueriesMu.Unlock()
			}

			start := time.Now()
			var err error
			if dbpkg.IsSelectQuery(statement.Text) {
				err = s.streamSelect(ctx, executor, statement, 0, start)
			} else {
				err = s.execNonSelect(ctx, executor, statement, start)
			}
			if err != nil || ctx.Err() != nil {
				return
			}
		}
	}()
}

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
					if d, ok := getDriver(driver); ok {
						trySchemas = []string{d.DefaultSchema()}
					} else {
						trySchemas = []string{""}
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

	for rows.Next() {
		if ctx.Err() != nil {
			break
		}
		row := scanRowAsStrings(rows, colCount)
		buf = append(buf, row)
		totalRowsFetched++

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

	hasMore := totalRowsFetched > fetchLimit

	if hasMore {
		totalRowsFetched = fetchLimit
	}

	totalRows := int64(seq*chunkSize + len(buf))
	if offset == 0 {
		s.appendHistory(statement.Text, totalRows, time.Since(start), rows.Err())
	}
	if rows.Err() != nil {
		err = rows.Err()
	}
	s.emitDoneWithMore(statement, int64(totalRowsFetched), time.Since(start), true, hasMore, err)
	s.logger.Debug("query profile", "stage", "stream-select", "tab", statement.TabID, "rows", totalRowsFetched, "duration_ms", time.Since(start).Milliseconds())
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

		rows, err := executor.QueryContext(ctx, paginatedQuery)
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

		for rows.Next() {
			if ctx.Err() != nil {
				break
			}
			row := scanRowAsStrings(rows, len(cols))
			chunk = append(chunk, row)
			rowCount++

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
		hasMore := rowCount > limit

		if hasMore {
			rowCount = limit
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
		s.emitDone(statement, 0, dur, false, wrappedErr)
		return wrappedErr
	}
	affected, _ := res.RowsAffected()
	s.appendHistory(statement.Text, affected, dur, nil)
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

	err := executor.QueryRowContext(ctx, countQuery).Scan(&count)
	if err != nil {
		return 0, err
	}
	return count, nil
}

func (s *QueryService) CancelQuery(tabID string) {
	s.sessionsMu.Lock()
	defer s.sessionsMu.Unlock()
	sourceID := sourceTabID(tabID)
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

	executor := s.getExecutor()
	if !isExecutorReady(executor) {
		return 0, fmt.Errorf("no active connection")
	}

	res, err := executor.ExecContext(s.ctx, query)
	if err != nil {
		return 0, err
	}

	return res.RowsAffected()
}

func (s *QueryService) emitDone(statement queryStatement, affected int64, duration time.Duration, isSelect bool, err error) {
	s.emitDoneWithMore(statement, affected, duration, isSelect, false, err)
}

func (s *QueryService) emitDoneWithMore(statement queryStatement, affected int64, duration time.Duration, isSelect bool, hasMore bool, err error) {
	payload := QueryDoneEvent{
		TabID:          statement.TabID,
		SourceTabID:    statement.SourceTabID,
		Affected:       affected,
		Duration:       duration.Milliseconds(),
		IsSelect:       isSelect,
		HasMore:        hasMore,
		StatementIndex: statement.Index,
		StatementCount: statement.Count,
		StatementText:  statement.Text,
	}
	if err != nil {
		payload.Error = err.Error()
	}
	EmitVersionedEvent(s.emitter, s.ctx, constant.EventQueryDone, constant.EventQueryDoneV2, payload)
}

func buildChunk(statement queryStatement, cols []string, rows [][]string, seq int, tableName string, pks []string) QueryChunkEvent {
	chunk := QueryChunkEvent{
		TabID:          statement.TabID,
		SourceTabID:    statement.SourceTabID,
		Rows:           rows,
		Seq:            seq,
		StatementIndex: statement.Index,
		StatementCount: statement.Count,
		StatementText:  statement.Text,
	}
	if cols != nil {
		chunk.Columns = cols
	}
	if tableName != "" {
		chunk.TableName = tableName
	}
	if len(pks) > 0 {
		chunk.PrimaryKeys = pks
	}
	return chunk
}

func resultTabID(sourceTabID string, statementIndex int) string {
	if statementIndex <= 0 {
		return sourceTabID
	}
	return fmt.Sprintf("%s::result:%d", sourceTabID, statementIndex+1)
}

func sourceTabID(tabID string) string {
	parts := strings.Split(tabID, "::result:")
	if len(parts) == 2 {
		return parts[0]
	}
	return tabID
}

func buildExplainQuery(driver, query string, analyze bool) (string, error) {
	trimmed := strings.TrimSpace(strings.TrimRight(query, ";"))
	if trimmed == "" {
		return "", fmt.Errorf("no query to explain")
	}

	switch driver {
	case constant.DriverPostgres:
		if analyze {
			return fmt.Sprintf("EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) %s", trimmed), nil
		}
		return fmt.Sprintf("EXPLAIN (FORMAT JSON) %s", trimmed), nil
	case constant.DriverMySQL:
		if analyze {
			return fmt.Sprintf("EXPLAIN ANALYZE %s", trimmed), nil
		}
		return fmt.Sprintf("EXPLAIN FORMAT=JSON %s", trimmed), nil
	case constant.DriverSQLite:
		if analyze {
			return "", fmt.Errorf("EXPLAIN ANALYZE is not supported for sqlite in this sprint")
		}
		return fmt.Sprintf("EXPLAIN QUERY PLAN %s", trimmed), nil
	case constant.DriverSQLServer:
		return "", fmt.Errorf("EXPLAIN is not supported for sqlserver in this sprint")
	default:
		return "", fmt.Errorf("EXPLAIN is not supported for driver %q", driver)
	}
}

func scanRowAsStrings(rows *sql.Rows, colCount int) []string {
	raw, ptrs := acquireScanBuffers(colCount)
	defer releaseScanBuffers(raw, ptrs)
	_ = rows.Scan(ptrs...)

	result := make([]string, colCount)
	for i, v := range raw {
		if v == nil {
			result[i] = ""
		} else {
			result[i] = scanValueToString(v)
		}
	}
	return result
}

var scanRawPool = sync.Pool{
	New: func() any { return make([]interface{}, 0, 32) },
}

var scanPtrPool = sync.Pool{
	New: func() any { return make([]interface{}, 0, 32) },
}

func acquireScanBuffers(colCount int) ([]interface{}, []interface{}) {
	raw := scanRawPool.Get().([]interface{})
	ptrs := scanPtrPool.Get().([]interface{})

	if cap(raw) < colCount {
		raw = make([]interface{}, colCount)
	} else {
		raw = raw[:colCount]
		for i := range raw {
			raw[i] = nil
		}
	}

	if cap(ptrs) < colCount {
		ptrs = make([]interface{}, colCount)
	} else {
		ptrs = ptrs[:colCount]
	}

	for i := range raw {
		ptrs[i] = &raw[i]
	}
	return raw, ptrs
}

func releaseScanBuffers(raw []interface{}, ptrs []interface{}) {
	for i := range raw {
		raw[i] = nil
	}
	for i := range ptrs {
		ptrs[i] = nil
	}
	scanRawPool.Put(raw[:0])
	scanPtrPool.Put(ptrs[:0])
}

func scanValueToString(v interface{}) string {
	switch tv := v.(type) {
	case []byte:
		if len(tv) == 16 {
			return formatSQLServerUUID(tv)
		}
		return string(tv)
	case string:
		return tv
	case int:
		return strconv.Itoa(tv)
	case int8:
		return strconv.FormatInt(int64(tv), 10)
	case int16:
		return strconv.FormatInt(int64(tv), 10)
	case int32:
		return strconv.FormatInt(int64(tv), 10)
	case int64:
		return strconv.FormatInt(tv, 10)
	case uint:
		return strconv.FormatUint(uint64(tv), 10)
	case uint8:
		return strconv.FormatUint(uint64(tv), 10)
	case uint16:
		return strconv.FormatUint(uint64(tv), 10)
	case uint32:
		return strconv.FormatUint(uint64(tv), 10)
	case uint64:
		return strconv.FormatUint(tv, 10)
	case float32:
		return strconv.FormatFloat(float64(tv), 'g', -1, 32)
	case float64:
		return strconv.FormatFloat(tv, 'g', -1, 64)
	case bool:
		return strconv.FormatBool(tv)
	default:
		return fmt.Sprint(v)
	}
}

func formatSQLServerUUID(b []byte) string {
	if len(b) != 16 {
		return string(b)
	}

	ordered := [16]byte{
		b[3], b[2], b[1], b[0], // Data1 LE
		b[5], b[4], // Data2 LE
		b[7], b[6], // Data3 LE
		b[8], b[9], // Data4a BE
		b[10], b[11], b[12], b[13], b[14], b[15], // Data4b BE
	}

	dst := make([]byte, 36)
	hex.Encode(dst[0:8], ordered[0:4])
	dst[8] = '-'
	hex.Encode(dst[9:13], ordered[4:6])
	dst[13] = '-'
	hex.Encode(dst[14:18], ordered[6:8])
	dst[18] = '-'
	hex.Encode(dst[19:23], ordered[8:10])
	dst[23] = '-'
	hex.Encode(dst[24:36], ordered[10:16])
	return string(dst)
}
