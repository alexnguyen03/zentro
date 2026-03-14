package app

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	dbpkg "zentro/internal/db"
	"zentro/internal/constant"
	"zentro/internal/utils"
)

type QueryService struct {
	ctx           context.Context
	logger        *slog.Logger
	getPrefs      func() utils.Preferences
	getDB         func() *sql.DB
	getDriver     func() string
	appendHistory func(query string, rowCount int64, dur time.Duration, err error)

	sessions   map[string]*QuerySession
	sessionsMu sync.Mutex

	activeQueries   map[string]string
	activeQueriesMu sync.RWMutex
}

func NewQueryService(
	ctx context.Context, logger *slog.Logger, getPrefs func() utils.Preferences,
	getDB func() *sql.DB, getDriver func() string,
	appendHistory func(query string, rowCount int64, dur time.Duration, err error),
) *QueryService {
	return &QueryService{
		ctx:           ctx,
		logger:        logger,
		getPrefs:      getPrefs,
		getDB:         getDB,
		getDriver:     getDriver,
		appendHistory: appendHistory,
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
	s.sessionsMu.Lock()
	if old, ok := s.sessions[tabID]; ok {
		old.CancelFunc()
		delete(s.sessions, tabID)
	}
	prefs := s.getPrefs()
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(prefs.QueryTimeout)*time.Second)
	session := &QuerySession{
		TabID:      tabID,
		CancelFunc: cancel,
		StartedAt:  time.Now(),
	}
	s.sessions[tabID] = session
	s.sessionsMu.Unlock()

	emitEvent(s.ctx, constant.EventQueryStarted, map[string]any{"tabID": tabID, "query": query})
	s.logger.Info("executing query", "tab", tabID)

	if dbpkg.IsSelectQuery(query) {
		s.activeQueriesMu.Lock()
		s.activeQueries[tabID] = query
		s.activeQueriesMu.Unlock()
	} else {
		s.activeQueriesMu.Lock()
		delete(s.activeQueries, tabID)
		s.activeQueriesMu.Unlock()
	}

	go func() {
		defer func() {
			s.sessionsMu.Lock()
			cancel()
			if s.sessions[tabID] == session {
				delete(s.sessions, tabID)
			}
			s.sessionsMu.Unlock()
		}()

		db := s.getDB()
		if db == nil {
			s.emitDone(tabID, 0, 0, true, fmt.Errorf("no active connection"))
			return
		}

		start := time.Now()
		if dbpkg.IsSelectQuery(query) {
			s.streamSelect(ctx, tabID, query, 0, start)
		} else {
			s.execNonSelect(ctx, tabID, query, start)
		}
	}()
}

func (s *QueryService) streamSelect(ctx context.Context, tabID, query string, offset int, start time.Time) {
	driver := s.getDriver()
	db := s.getDB()
	prefs := s.getPrefs()
	fetchLimit := prefs.DefaultLimit

	checkLimit := fetchLimit + 1
	normalized := dbpkg.InjectPageClause(driver, query, checkLimit, offset)

	if normalized == query && offset > 0 {
		s.emitDoneWithMore(tabID, 0, time.Since(start), true, false, nil)
		return
	}

	rows, err := db.QueryContext(ctx, normalized)
	if err != nil {
		s.emitDoneWithMore(tabID, 0, time.Since(start), true, false, fmt.Errorf("query: %w", err))
		return
	}
	defer rows.Close()

	cols, _ := rows.Columns()
	colCount := len(cols)

	var tableName string
	var pks []string
	if offset == 0 {
		parsedSchema, table := dbpkg.ExtractTableFromQuery(query)
		if table != "" {
			tableName = table
			trySchemas := []string{parsedSchema}
			if parsedSchema == "" {
				if d, ok := getDriver(driver); ok {
					trySchemas = []string{d.DefaultSchema()}
				} else {
					trySchemas = []string{""}
				}
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
				emitEvent(s.ctx, constant.EventQueryChunk, buildChunk(tabID, chunkCols, buf, seq, tableName, pks))
			} else {
				emitEvent(s.ctx, constant.EventQueryChunk, buildChunk(tabID, chunkCols, buf, seq, "", nil))
			}
			buf = nil
			seq++
		}
	}

	if len(buf) > 0 || !sentCols {
		var chunkCols []string
		if !sentCols {
			chunkCols = cols
			emitEvent(s.ctx, constant.EventQueryChunk, buildChunk(tabID, chunkCols, buf, seq, tableName, pks))
		} else {
			emitEvent(s.ctx, constant.EventQueryChunk, buildChunk(tabID, chunkCols, buf, seq, "", nil))
		}
	}

	hasMore := totalRowsFetched > fetchLimit

	if hasMore {
		totalRowsFetched = fetchLimit
	}

	totalRows := int64(seq*chunkSize + len(buf))
	if offset == 0 {
		s.appendHistory(query, totalRows, time.Since(start), rows.Err())
	}
	s.emitDoneWithMore(tabID, int64(totalRowsFetched), time.Since(start), true, hasMore, rows.Err())
}

func (s *QueryService) FetchMoreRows(tabID string, offset int) {
	s.activeQueriesMu.Lock()
	query, ok := s.activeQueries[tabID]
	s.activeQueriesMu.Unlock()

	if !ok || query == "" {
		s.emitDone(tabID, 0, 0, true, fmt.Errorf("no active query found for pagination"))
		return
	}

	driver := s.getDriver()
	db := s.getDB()
	prefs := s.getPrefs()
	limit := prefs.DefaultLimit

	checkLimit := limit + 1
	paginatedQuery := dbpkg.InjectPageClause(driver, query, checkLimit, offset)

	if paginatedQuery == query && offset > 0 {
		s.emitDoneWithMore(tabID, 0, 0, true, false, nil)
		return
	}

	s.sessionsMu.Lock()
	if old, ok := s.sessions[tabID]; ok {
		old.CancelFunc()
		delete(s.sessions, tabID)
	}

	ctx, cancel := context.WithCancel(s.ctx)
	session := &QuerySession{
		TabID:      tabID,
		StartedAt:  time.Now(),
		CancelFunc: cancel,
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

		if db == nil {
			s.emitDone(tabID, 0, 0, true, fmt.Errorf("no active connection"))
			return
		}

		start := time.Now()

		rows, err := db.QueryContext(ctx, paginatedQuery)
		if err != nil {
			s.emitDone(tabID, 0, 0, true, fmt.Errorf("fetch more: query failed: %w", err))
			return
		}
		defer rows.Close()

		cols, err := rows.Columns()
		if err != nil {
			s.emitDone(tabID, 0, 0, true, fmt.Errorf("fetch more: columns error: %w", err))
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
				emitEvent(s.ctx, constant.EventQueryChunk, buildChunk(tabID, cols, chunk, seq, "", nil))
				chunk = nil
				seq++
			}
		}

		if len(chunk) > 0 {
			emitEvent(s.ctx, constant.EventQueryChunk, buildChunk(tabID, cols, chunk, seq, "", nil))
		}

		duration := time.Since(start)
		hasMore := rowCount > limit

		if hasMore {
			rowCount = limit
		}

		s.emitDoneWithMore(tabID, int64(rowCount), duration, true, hasMore, nil)
	}()
}

func (s *QueryService) execNonSelect(ctx context.Context, tabID, query string, start time.Time) {
	db := s.getDB()
	res, err := db.ExecContext(ctx, query)
	dur := time.Since(start)
	if err != nil {
		wrappedErr := fmt.Errorf("exec: %w", err)
		s.appendHistory(query, 0, dur, wrappedErr)
		s.emitDone(tabID, 0, dur, false, wrappedErr)
		return
	}
	affected, _ := res.RowsAffected()
	s.appendHistory(query, affected, dur, nil)
	s.emitDone(tabID, affected, dur, false, nil)
}

func (s *QueryService) FetchTotalRowCount(tabID string) (int64, error) {
	s.activeQueriesMu.Lock()
	query, ok := s.activeQueries[tabID]
	s.activeQueriesMu.Unlock()

	if !ok || query == "" {
		return 0, fmt.Errorf("no active query found for count")
	}

	db := s.getDB()
	if db == nil {
		return 0, fmt.Errorf("no active connection")
	}

	cleanQuery := strings.TrimRight(strings.TrimSpace(query), ";")
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM (%s\n) AS zentro_count", cleanQuery)

	var count int64
	ctx, cancel := context.WithTimeout(s.ctx, 30*time.Second)
	defer cancel()

	err := db.QueryRowContext(ctx, countQuery).Scan(&count)
	if err != nil {
		return 0, err
	}
	return count, nil
}

func (s *QueryService) CancelQuery(tabID string) {
	s.sessionsMu.Lock()
	defer s.sessionsMu.Unlock()
	if session, ok := s.sessions[tabID]; ok {
		s.logger.Info("cancelling query", "tab", tabID)
		session.CancelFunc()
		delete(s.sessions, tabID)
	}
}

func (s *QueryService) ExecuteUpdateSync(query string) (int64, error) {
	db := s.getDB()
	if db == nil {
		return 0, fmt.Errorf("no active connection")
	}

	res, err := db.ExecContext(s.ctx, query)
	if err != nil {
		return 0, err
	}

	return res.RowsAffected()
}

func (s *QueryService) emitDone(tabID string, affected int64, duration time.Duration, isSelect bool, err error) {
	s.emitDoneWithMore(tabID, affected, duration, isSelect, false, err)
}

func (s *QueryService) emitDoneWithMore(tabID string, affected int64, duration time.Duration, isSelect bool, hasMore bool, err error) {
	payload := map[string]any{
		"tabID":    tabID,
		"affected": affected,
		"duration": duration.Milliseconds(),
		"isSelect": isSelect,
		"hasMore":  hasMore,
	}
	if err != nil {
		payload["error"] = err.Error()
	}
	emitEvent(s.ctx, constant.EventQueryDone, payload)
}

func buildChunk(tabID string, cols []string, rows [][]string, seq int, tableName string, pks []string) map[string]any {
	chunk := map[string]any{
		"tabID": tabID,
		"rows":  rows,
		"seq":   seq,
	}
	if cols != nil {
		chunk["columns"] = cols
	}
	if tableName != "" {
		chunk["tableName"] = tableName
	}
	if len(pks) > 0 {
		chunk["primaryKeys"] = pks
	}
	return chunk
}

func scanRowAsStrings(rows *sql.Rows, colCount int) []string {
	raw := make([]interface{}, colCount)
	ptrs := make([]interface{}, colCount)
	for i := range raw {
		ptrs[i] = &raw[i]
	}
	_ = rows.Scan(ptrs...)

	result := make([]string, colCount)
	for i, v := range raw {
		if v == nil {
			result[i] = ""
		} else if b, ok := v.([]byte); ok {
			// MSSQL uniqueidentifier is returned as 16 raw bytes in mixed-endian order.
			// Format: Data1(4LE) Data2(2LE) Data3(2LE) Data4(8BE)
			if len(b) == 16 {
				result[i] = fmt.Sprintf(
					"%08x-%04x-%04x-%04x-%012x",
					// Data1: bytes 0-3 little-endian
					uint32(b[3])<<24|uint32(b[2])<<16|uint32(b[1])<<8|uint32(b[0]),
					// Data2: bytes 4-5 little-endian
					uint16(b[5])<<8|uint16(b[4]),
					// Data3: bytes 6-7 little-endian
					uint16(b[7])<<8|uint16(b[6]),
					// Data4a: bytes 8-9 big-endian
					[]byte{b[8], b[9]},
					// Data4b: bytes 10-15 big-endian
					[]byte{b[10], b[11], b[12], b[13], b[14], b[15]},
				)
			} else {
				result[i] = string(b)
			}
		} else {
			result[i] = fmt.Sprintf("%v", v)
		}
	}
	return result
}
