package app

import (
	"context"
	"database/sql"
	"testing"

	"zentro/internal/utils"
)

func TestBeginTransaction_ViewModeBlocked(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	svc := NewTransactionService(
		context.Background(),
		utils.NewLogger(false),
		func() *sql.DB { return db },
		func() utils.Preferences { return utils.Preferences{ViewMode: true} },
		func() string { return "sqlite" },
		funcEventEmitter{},
	)

	if err := svc.BeginTransaction(); err == nil {
		t.Fatalf("expected begin transaction to be blocked in view mode")
	}
}
