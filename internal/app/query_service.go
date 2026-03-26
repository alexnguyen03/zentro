package app

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
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
