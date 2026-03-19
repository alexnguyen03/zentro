package app

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"sync"

	"zentro/internal/constant"
)

type TransactionService struct {
	ctx       context.Context
	logger    *slog.Logger
	getDB     func() *sql.DB
	getDriver func() string

	mu        sync.RWMutex
	tx        *sql.Tx
	status    string
	lastError string
}

func NewTransactionService(
	ctx context.Context,
	logger *slog.Logger,
	getDB func() *sql.DB,
	getDriver func() string,
) *TransactionService {
	return &TransactionService{
		ctx:       ctx,
		logger:    logger,
		getDB:     getDB,
		getDriver: getDriver,
		status:    constant.TransactionStatusNone,
	}
}

func (s *TransactionService) SetContext(ctx context.Context) {
	s.ctx = ctx
}

func (s *TransactionService) BeginTransaction() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.tx != nil {
		return fmt.Errorf("transaction is already active")
	}

	db := s.getDB()
	if db == nil {
		return fmt.Errorf("no active connection")
	}

	tx, err := db.BeginTx(s.ctx, nil)
	if err != nil {
		s.status = constant.TransactionStatusError
		s.lastError = err.Error()
		s.emitStatusLocked()
		return err
	}

	s.tx = tx
	s.status = constant.TransactionStatusActive
	s.lastError = ""
	s.emitStatusLocked()
	return nil
}

func (s *TransactionService) CommitTransaction() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.tx == nil {
		return fmt.Errorf("no active transaction to commit")
	}

	if err := s.tx.Commit(); err != nil {
		s.status = constant.TransactionStatusError
		s.lastError = err.Error()
		s.tx = nil
		s.emitStatusLocked()
		return err
	}

	s.tx = nil
	s.status = constant.TransactionStatusNone
	s.lastError = ""
	s.emitStatusLocked()
	return nil
}

func (s *TransactionService) RollbackTransaction() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.rollbackLocked(false)
}

func (s *TransactionService) RollbackActive() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.rollbackLocked(true)
}

func (s *TransactionService) rollbackLocked(silentIfNone bool) error {
	if s.tx == nil {
		if silentIfNone {
			s.status = constant.TransactionStatusNone
			s.lastError = ""
			s.emitStatusLocked()
			return nil
		}
		return fmt.Errorf("no active transaction to rollback")
	}

	if err := s.tx.Rollback(); err != nil && err != sql.ErrTxDone {
		s.status = constant.TransactionStatusError
		s.lastError = err.Error()
		s.tx = nil
		s.emitStatusLocked()
		return err
	}

	s.tx = nil
	s.status = constant.TransactionStatusNone
	s.lastError = ""
	s.emitStatusLocked()
	return nil
}

func (s *TransactionService) GetTransactionStatus() (string, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.status, nil
}

func (s *TransactionService) GetExecutor() sqlExecutor {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.tx != nil && s.status == constant.TransactionStatusActive {
		return s.tx
	}
	return s.getDB()
}

func (s *TransactionService) emitStatusLocked() {
	payload := map[string]any{
		"status": s.status,
		"driver": s.getDriver(),
	}
	if s.lastError != "" {
		payload["error"] = s.lastError
	}
	emitEvent(s.ctx, constant.EventTransactionStatus, payload)
}
