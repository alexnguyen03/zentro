package app

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"zentro/internal/utils"

	_ "modernc.org/sqlite"
)

func setupTestDB(t *testing.T) *sql.DB {
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("failed to open test sqlite: %v", err)
	}
	return db
}

func setupApp(t *testing.T) *App {
	a := NewApp()
	a.ctx = context.Background()
	a.logger = utils.NewLogger(false)
	a.db = setupTestDB(t)
	a.prefs = utils.Preferences{DefaultLimit: 100000} // Set limit high enough for 50k
	return a
}

func TestExecuteQuery_50kRows_Integration(t *testing.T) {
	a := setupApp(t)
	defer a.db.Close()

	// Track emitted events
	events := make([]map[string]any, 0)
	doneChan := make(chan bool)

	// Mock Wails EventsEmit
	emitEvent = func(ctx context.Context, eventName string, optionalData ...interface{}) {
		if len(optionalData) > 0 {
			if data, ok := optionalData[0].(map[string]any); ok {
				data["_eventName"] = eventName
				events = append(events, data)
				if eventName == "query:done" {
					doneChan <- true
				}
			}
		}
	}

	tabID := "test-tab-1"

	// SQLite recursive CTE to generate 50000 rows
	query := `WITH RECURSIVE cnt(x) AS (
		SELECT 1
		UNION ALL
		SELECT x+1 FROM cnt
		LIMIT 50000
	)
	SELECT x, 'row ' || x, x * 2 FROM cnt;`

	a.ExecuteQuery(tabID, query)

	select {
	case <-doneChan:
	case <-time.After(5 * time.Second):
		t.Fatal("Timeout waiting for query:done")
	}

	// Verify the result
	started := false
	chunks := 0
	totalRows := 0
	seqHashes := make(map[int]bool)
	var doneEvent map[string]any

	for _, ev := range events {
		name := ev["_eventName"].(string)
		switch name {
		case "query:started":
			started = true
			if ev["tabID"] != tabID {
				t.Errorf("expected tabID %s, got %v", tabID, ev["tabID"])
			}
		case "query:chunk":
			chunks++
			seq := ev["seq"].(int)
			if seqHashes[seq] {
				t.Fatalf("duplicate sequence number %d", seq)
			}
			seqHashes[seq] = true
			if ev["tabID"] != tabID {
				t.Errorf("expected tabID %s, got %v", tabID, ev["tabID"])
			}
			if rows, ok := ev["rows"].([][]string); ok {
				totalRows += len(rows)
			}
			if seq == 0 {
				if _, ok := ev["columns"]; !ok {
					t.Errorf("expected columns in chunk seq 0")
				}
			}
		case "query:done":
			doneEvent = ev
		}
	}

	if !started {
		t.Error("query:started event not emitted")
	}
	if totalRows != 50000 {
		t.Errorf("expected 50000 rows, got %d", totalRows)
	}
	if chunks != 100 { // 50000 / 500 = 100 chunks
		t.Errorf("expected 100 chunks, got %d", chunks)
	}
	if doneEvent == nil {
		t.Fatal("query:done event not emitted")
	}
	if err, ok := doneEvent["error"]; ok && err != "" {
		t.Errorf("unexpected error in done event: %v", err)
	}
}

func TestExecuteQuery_CancelMidStream(t *testing.T) {
	a := setupApp(t)
	defer a.db.Close()

	events := make([]map[string]any, 0)
	doneChan := make(chan bool)

	emitEvent = func(ctx context.Context, eventName string, optionalData ...interface{}) {
		if len(optionalData) > 0 {
			if data, ok := optionalData[0].(map[string]any); ok {
				data["_eventName"] = eventName
				events = append(events, data)
				if eventName == "query:done" {
					doneChan <- true
				}

				// Cancel query on the second chunk
				if eventName == "query:chunk" {
					seq := data["seq"].(int)
					if seq == 1 {
						a.CancelQuery("test-tab-2")
					}
				}
			}
		}
	}

	// Wait randomly or read from a slow sequence to ensure cancellation happens before finish
	// randomblob generates fake data to slow down? Or just relying on the chunk interrupt.
	// Actually, context cancellation will abort the database read.
	// modernc.org/sqlite supports context cancellation properly.
	query := `WITH RECURSIVE cnt(x) AS (
		SELECT 1
		UNION ALL
		SELECT x+1 FROM cnt
		LIMIT 100000
	)
	SELECT x FROM cnt;`

	a.ExecuteQuery("test-tab-2", query)

	select {
	case <-doneChan:
	case <-time.After(5 * time.Second):
		t.Fatal("Timeout waiting for query:done")
	}

	// Verify cancellation
	var doneEvent map[string]any
	totalRows := 0

	for _, ev := range events {
		name := ev["_eventName"].(string)
		if name == "query:chunk" {
			if rows, ok := ev["rows"].([][]string); ok {
				totalRows += len(rows)
			}
		}
		if name == "query:done" {
			doneEvent = ev
		}
	}

	if doneEvent == nil {
		t.Fatal("query:done event not emitted")
	}

	// query:done should have an error because it was cancelled
	errMsg, hasErr := doneEvent["error"]
	if !hasErr || errMsg == "" {
		t.Errorf("expected an error indicating cancellation, got none")
	}

	if totalRows >= 100000 {
		t.Errorf("expected partial rows due to cancellation, but got all %d rows", totalRows)
	}
}

func TestExecuteQuery_NonSelect(t *testing.T) {
	a := setupApp(t)
	defer a.db.Close()

	doneChan := make(chan map[string]any)

	emitEvent = func(ctx context.Context, eventName string, optionalData ...interface{}) {
		if eventName == "query:done" {
			if len(optionalData) > 0 {
				if data, ok := optionalData[0].(map[string]any); ok {
					doneChan <- data
				}
			}
		}
	}

	a.db.Exec("CREATE TABLE users (id INTEGER, name TEXT);")

	a.ExecuteQuery("test-tab-3", "INSERT INTO users (id, name) VALUES (1, 'alice'), (2, 'bob');")

	select {
	case done := <-doneChan:
		if affected, ok := done["affected"].(int64); !ok || affected != 2 {
			t.Errorf("expected 2 affected rows, got %v", done["affected"])
		}
		if isSel, ok := done["isSelect"].(bool); !ok || isSel {
			t.Errorf("expected isSelect=false")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("Timeout waiting for non-select query:done")
	}
}
