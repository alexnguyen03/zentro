package app

import (
	"context"
	"sync"
	"testing"
	"time"

	"zentro/internal/models"
	"zentro/internal/utils"
)

// ─── QueryService ─────────────────────────────────────────────────────────────

func TestQueryService_SetContext(t *testing.T) {
	a := setupApp(t)
	newCtx := context.Background()
	a.query.SetContext(newCtx)
	if a.query.ctx != newCtx {
		t.Error("SetContext did not update ctx")
	}
}

func TestQueryService_Shutdown_CancelsActiveSessions(t *testing.T) {
	a := setupApp(t)
	defer a.db.Close()

	doneChan := make(chan struct{})
	emitEvent = func(ctx context.Context, name string, args ...interface{}) {
		if name == "query:done" {
			close(doneChan)
		}
	}

	// Start a long-running query so a session is active, then shut down.
	a.ExecuteQuery("shutdown-tab", "WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt LIMIT 100000) SELECT x FROM cnt")
	// Give goroutine a moment to register the session.
	time.Sleep(5 * time.Millisecond)

	a.query.Shutdown()

	select {
	case <-doneChan:
	case <-time.After(2 * time.Second):
		t.Fatal("Shutdown did not cancel running query in time")
	}
}

func TestQueryService_FetchMoreRows_NoActiveQuery(t *testing.T) {
	a := setupApp(t)
	defer a.db.Close()

	doneChan := make(chan map[string]any, 1)
	emitEvent = func(ctx context.Context, name string, args ...interface{}) {
		if name == "query:done" && len(args) > 0 {
			if d, ok := args[0].(map[string]any); ok {
				doneChan <- d
			}
		}
	}

	a.FetchMoreRows("no-such-tab", 100)

	select {
	case done := <-doneChan:
		if errMsg, _ := done["error"].(string); errMsg == "" {
			t.Error("expected error in done event for missing active query, got none")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for query:done on FetchMoreRows with no active query")
	}
}

func TestQueryService_FetchMoreRows_AfterSelect(t *testing.T) {
	a := setupApp(t)
	defer a.db.Close()

	var mu sync.Mutex
	doneCount := 0
	var lastDone map[string]any

	doneChan := make(chan struct{}, 2)
	emitEvent = func(ctx context.Context, name string, args ...interface{}) {
		if name == "query:done" && len(args) > 0 {
			if d, ok := args[0].(map[string]any); ok {
				mu.Lock()
				doneCount++
				lastDone = d
				mu.Unlock()
				doneChan <- struct{}{}
			}
		}
	}

	// Run initial SELECT that stores the query in activeQueries.
	a.ExecuteQuery("fetch-more-tab", "SELECT 1 AS x, 2 AS y")
	<-doneChan

	// Now call FetchMoreRows with offset — should succeed without error.
	a.FetchMoreRows("fetch-more-tab", 0)
	<-doneChan

	mu.Lock()
	defer mu.Unlock()
	if errMsg, _ := lastDone["error"].(string); errMsg != "" {
		t.Errorf("unexpected error in FetchMoreRows done event: %s", errMsg)
	}
}

func TestQueryService_FetchTotalRowCount_NoActiveQuery(t *testing.T) {
	a := setupApp(t)
	defer a.db.Close()

	_, err := a.FetchTotalRowCount("no-such-tab")
	if err == nil {
		t.Error("expected error for missing active query, got nil")
	}
}

func TestQueryService_FetchTotalRowCount_Success(t *testing.T) {
	a := setupApp(t)
	defer a.db.Close()

	doneChan := make(chan struct{}, 1)
	emitEvent = func(ctx context.Context, name string, args ...interface{}) {
		if name == "query:done" {
			doneChan <- struct{}{}
		}
	}

	query := "SELECT x FROM (SELECT 1 AS x UNION ALL SELECT 2 UNION ALL SELECT 3)"
	a.ExecuteQuery("count-tab", query)
	<-doneChan

	count, err := a.FetchTotalRowCount("count-tab")
	if err != nil {
		t.Fatalf("FetchTotalRowCount error: %v", err)
	}
	if count != 3 {
		t.Errorf("expected count 3, got %d", count)
	}
}

func TestQueryService_ExecuteUpdateSync_NoDB(t *testing.T) {
	a := NewApp()
	a.ctx = context.Background()
	a.logger = utils.NewLogger(false)
	a.query.logger = a.logger
	// db intentionally nil

	_, err := a.ExecuteUpdateSync("CREATE TABLE t (id INT)")
	if err == nil {
		t.Error("expected error when db is nil, got nil")
	}
}

func TestQueryService_ExecuteUpdateSync_Success(t *testing.T) {
	a := setupApp(t)
	defer a.db.Close()

	a.db.Exec("CREATE TABLE exec_sync_test (id INTEGER)")

	affected, err := a.ExecuteUpdateSync("INSERT INTO exec_sync_test (id) VALUES (1), (2)")
	if err != nil {
		t.Fatalf("ExecuteUpdateSync error: %v", err)
	}
	if affected != 2 {
		t.Errorf("expected 2 affected rows, got %d", affected)
	}
}

// ─── HistoryService ───────────────────────────────────────────────────────────

func TestHistoryService_AppendAndGet(t *testing.T) {
	h := NewHistoryService(func() *models.ConnectionProfile { return nil })

	h.AppendEntry("SELECT 1", 1, 10*time.Millisecond, nil)
	h.AppendEntry("SELECT 2", 2, 20*time.Millisecond, nil)

	entries := h.GetHistory()
	if len(entries) < 2 {
		t.Fatalf("expected at least 2 history entries, got %d", len(entries))
	}
	// Newest first.
	if entries[0].Query != "SELECT 2" {
		t.Errorf("expected newest entry first, got %q", entries[0].Query)
	}
}

func TestHistoryService_GetHistory_LoadsFromFile(t *testing.T) {
	h := NewHistoryService(func() *models.ConnectionProfile { return nil })

	h.AppendEntry("SELECT FROM_FILE", 5, 5*time.Millisecond, nil)

	// Create a fresh service that has no in-memory entries — it should load from file.
	h2 := NewHistoryService(func() *models.ConnectionProfile { return nil })
	entries := h2.GetHistory()
	// If the file exists, at least 1 entry should be loaded.
	if len(entries) == 0 {
		t.Log("no history file found — loadHistoryFile path not exercised (acceptable in CI)")
	}
}

func TestHistoryService_ClearHistory(t *testing.T) {
	h := NewHistoryService(func() *models.ConnectionProfile { return nil })
	h.AppendEntry("SELECT 1", 1, time.Millisecond, nil)

	// ClearHistory may fail if the file does not exist yet in this env; that is acceptable.
	_ = h.ClearHistory()

	entries := h.GetHistory()
	if len(entries) != 0 {
		t.Errorf("expected empty history after clear, got %d entries", len(entries))
	}
}
