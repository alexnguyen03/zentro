package app

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
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
	ctx                      context.Context
	logger                   *slog.Logger
	getPrefs                 func() utils.Preferences
	getDB                    func() *sql.DB
	getExecutor              func() sqlExecutor
	getDriver                func() string
	getCurrentSchema         func() string
	getCurrentEnvironmentKey func() string
	appendHistory            func(query string, rowCount int64, dur time.Duration, err error)
	emitter                  EventEmitter

	sessions   map[string]*QuerySession
	sessionsMu sync.Mutex

	activeQueries   map[string]string
	activeQueriesMu sync.RWMutex

	cancelledTabs   map[string]struct{}
	cancelledTabsMu sync.RWMutex
}

func NewQueryService(
	ctx context.Context, logger *slog.Logger, getPrefs func() utils.Preferences,
	getDB func() *sql.DB, getExecutor func() sqlExecutor, getDriver func() string,
	getCurrentSchema func() string, getCurrentEnvironmentKey func() string,
	appendHistory func(query string, rowCount int64, dur time.Duration, err error),
	emitter EventEmitter,
) *QueryService {
	return &QueryService{
		ctx:                      ctx,
		logger:                   logger,
		getPrefs:                 getPrefs,
		getDB:                    getDB,
		getExecutor:              getExecutor,
		getDriver:                getDriver,
		getCurrentSchema:         getCurrentSchema,
		getCurrentEnvironmentKey: getCurrentEnvironmentKey,
		appendHistory:            appendHistory,
		emitter:                  emitter,
		sessions:                 make(map[string]*QuerySession),
		activeQueries:            make(map[string]string),
		cancelledTabs:            make(map[string]struct{}),
	}
}

func quotePostgresIdentifier(identifier string) string {
	return `"` + strings.ReplaceAll(identifier, `"`, `""`) + `"`
}

func (s *QueryService) currentSchema() string {
	if s.getCurrentSchema == nil {
		return ""
	}
	return strings.TrimSpace(s.getCurrentSchema())
}

func (s *QueryService) applySessionContext(ctx context.Context, executor sqlExecutor) error {
	if strings.ToLower(s.getDriver()) != constant.DriverPostgres {
		return nil
	}
	schema := s.currentSchema()
	if schema == "" {
		return nil
	}

	searchPath := quotePostgresIdentifier(schema)
	if !strings.EqualFold(schema, "public") {
		searchPath += ", public"
	}

	if _, err := executor.ExecContext(ctx, "SET search_path TO "+searchPath); err != nil {
		return fmt.Errorf("set search_path: %w", err)
	}
	return nil
}

func (s *QueryService) prepareExecutor(ctx context.Context, executor sqlExecutor) (sqlExecutor, func(), error) {
	if strings.ToLower(s.getDriver()) != constant.DriverPostgres {
		return executor, func() {}, nil
	}
	schema := s.currentSchema()
	if schema == "" {
		return executor, func() {}, nil
	}

	if dbExecutor, ok := executor.(*sql.DB); ok {
		conn, err := dbExecutor.Conn(ctx)
		if err != nil {
			return nil, nil, err
		}
		if err := s.applySessionContext(ctx, conn); err != nil {
			_ = conn.Close()
			return nil, nil, err
		}
		return conn, func() {
			resetCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancel()
			_, _ = conn.ExecContext(resetCtx, "RESET search_path")
			_ = conn.Close()
		}, nil
	}

	if err := s.applySessionContext(ctx, executor); err != nil {
		return nil, nil, err
	}
	return executor, func() {}, nil
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
	s.cancelledTabsMu.Lock()
	s.cancelledTabs = make(map[string]struct{})
	s.cancelledTabsMu.Unlock()
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
	s.clearCancelled(tabID)

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

	if err := s.validateStrictWriteSafety(statements); err != nil {
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
			statementExecutor, releaseExecutor, prepErr := s.prepareExecutor(ctx, executor)
			if prepErr != nil {
				wrappedErr := fmt.Errorf("prepare query context: %w", prepErr)
				s.emitDoneWithMore(statement, 0, time.Since(start), dbpkg.IsSelectQuery(statement.Text), false, wrappedErr)
				return
			}

			var err error
			if dbpkg.IsSelectQuery(statement.Text) {
				err = s.streamSelect(ctx, statementExecutor, statement, 0, start)
			} else {
				err = s.execNonSelect(ctx, statementExecutor, statement, start)
			}
			releaseExecutor()
			if err != nil || ctx.Err() != nil {
				return
			}
		}
	}()
}

func (s *QueryService) markCancelled(tabID string) {
	s.cancelledTabsMu.Lock()
	defer s.cancelledTabsMu.Unlock()
	s.cancelledTabs[tabID] = struct{}{}
}

func (s *QueryService) clearCancelled(tabID string) {
	s.cancelledTabsMu.Lock()
	defer s.cancelledTabsMu.Unlock()
	delete(s.cancelledTabs, tabID)
}

func (s *QueryService) isCancelled(tabID string) bool {
	s.cancelledTabsMu.RLock()
	defer s.cancelledTabsMu.RUnlock()
	_, ok := s.cancelledTabs[tabID]
	return ok
}
