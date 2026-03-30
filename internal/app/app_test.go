package app

import (
	"context"
	"database/sql"
	"strings"
	"sync"
	"testing"
	"time"

	"zentro/internal/constant"
	"zentro/internal/models"
	"zentro/internal/utils"

	_ "modernc.org/sqlite"
)

type funcEventEmitter struct {
	fn func(context.Context, string, any)
}

func (f funcEventEmitter) Emit(ctx context.Context, eventName string, payload any) {
	if f.fn != nil {
		f.fn(ctx, eventName, payload)
	}
}

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
	a.conn.logger = a.logger
	a.query.logger = a.logger
	a.scripts.logger = a.logger
	a.db = setupTestDB(t)
	a.prefs = utils.Preferences{DefaultLimit: 100000, QueryTimeout: 30} // Set limit high enough for 50k
	return a
}

func TestExecuteQuery_50kRows_Integration(t *testing.T) {
	a := setupApp(t)
	defer a.db.Close()

	// Track emitted events
	events := make([]map[string]any, 0)
	var mu sync.Mutex
	doneChan := make(chan bool)

	em := funcEventEmitter{fn: func(ctx context.Context, eventName string, payload any) {
		data, ok := payload.(map[string]any)
		if !ok {
			return
		}
		mu.Lock()
		data["_eventName"] = eventName
		events = append(events, data)
		mu.Unlock()
		if eventName == "query:done" {
			doneChan <- true
		}
	}}
	a.emitter = em
	a.conn.emitter = em
	a.query.emitter = em
	a.tx.emitter = em

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
	var mu sync.Mutex
	doneChan := make(chan bool)

	em := funcEventEmitter{fn: func(ctx context.Context, eventName string, payload any) {
		data, ok := payload.(map[string]any)
		if !ok {
			return
		}
		mu.Lock()
		data["_eventName"] = eventName
		events = append(events, data)
		mu.Unlock()
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
	}}
	a.emitter = em
	a.conn.emitter = em
	a.query.emitter = em
	a.tx.emitter = em

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
	doneCount := 0

	for _, ev := range events {
		name := ev["_eventName"].(string)
		if name == "query:chunk" {
			if rows, ok := ev["rows"].([][]string); ok {
				totalRows += len(rows)
			}
		}
		if name == "query:done" {
			doneCount++
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
	if doneCount != 1 {
		t.Errorf("expected exactly one query:done event, got %d", doneCount)
	}
}

func TestExecuteQuery_NonSelect(t *testing.T) {
	a := setupApp(t)
	defer a.db.Close()

	doneChan := make(chan map[string]any)

	em := funcEventEmitter{fn: func(ctx context.Context, eventName string, payload any) {
		if eventName == "query:done" {
			if data, ok := payload.(map[string]any); ok {
				doneChan <- data
			}
		}
	}}
	a.emitter = em
	a.conn.emitter = em
	a.query.emitter = em
	a.tx.emitter = em

	a.db.Exec("CREATE TABLE users (id INTEGER, name TEXT);")

	a.ExecuteQuery("test-tab-3", "INSERT INTO users (id, name) VALUES (1, 'alice'), (2, 'bob');")

	select {
	case done := <-doneChan:
		if affected, ok := done["affected"].(int64); !ok || affected != 2 {
			t.Errorf("expected 2 affected rows, got %v, error: %v", done["affected"], done["error"])
		}
		if isSel, ok := done["isSelect"].(bool); !ok || isSel {
			t.Errorf("expected isSelect=false")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("Timeout waiting for non-select query:done")
	}
}

func TestCancelQuery_Idempotent(t *testing.T) {
	a := setupApp(t)
	defer a.db.Close()

	doneChan := make(chan map[string]any, 1)

	em := funcEventEmitter{fn: func(_ context.Context, eventName string, payload any) {
		if eventName != "query:done" {
			return
		}
		if data, ok := payload.(map[string]any); ok {
			doneChan <- data
		}
	}}
	a.emitter = em
	a.conn.emitter = em
	a.query.emitter = em
	a.tx.emitter = em

	query := `WITH RECURSIVE cnt(x) AS (
		SELECT 1
		UNION ALL
		SELECT x+1 FROM cnt
		LIMIT 100000
	)
	SELECT x FROM cnt;`
	a.ExecuteQuery("test-tab-cancel-idempotent", query)

	a.CancelQuery("test-tab-cancel-idempotent")
	a.CancelQuery("test-tab-cancel-idempotent")
	a.CancelQuery("test-tab-cancel-idempotent")

	select {
	case done := <-doneChan:
		errMsg, _ := done["error"].(string)
		if errMsg == "" {
			t.Fatalf("expected cancellation error in done payload")
		}
	case <-time.After(5 * time.Second):
		t.Fatal("timeout waiting for query:done after cancellation")
	}
}

func TestExplainQuery_Lifecycle(t *testing.T) {
	a := setupApp(t)
	defer a.db.Close()
	a.prefs.DefaultLimit = 100
	a.prefs.ChunkSize = 20
	a.profile = &models.ConnectionProfile{
		Name:   "sqlite-test",
		Driver: constant.DriverSQLite,
		DBName: ":memory:",
	}

	doneChan := make(chan map[string]any, 1)
	em := funcEventEmitter{fn: func(_ context.Context, eventName string, payload any) {
		if eventName != constant.EventQueryDone {
			return
		}
		if data, ok := payload.(map[string]any); ok {
			doneChan <- data
		}
	}}
	a.emitter = em
	a.conn.emitter = em
	a.query.emitter = em
	a.tx.emitter = em

	if err := a.ExplainQuery("tab-explain-1", "SELECT 42;", false); err != nil {
		t.Fatalf("ExplainQuery returned error: %v", err)
	}

	select {
	case done := <-doneChan:
		if errMsg, ok := done["error"].(string); ok && errMsg != "" {
			t.Fatalf("expected no explain error, got %q", errMsg)
		}
		statementText, _ := done["statementText"].(string)
		if !strings.HasPrefix(strings.ToUpper(statementText), "EXPLAIN QUERY PLAN") {
			t.Fatalf("expected sqlite explain statement, got %q", statementText)
		}
		if isSelect, _ := done["isSelect"].(bool); !isSelect {
			t.Fatalf("expected explain to be handled as select")
		}
	case <-time.After(3 * time.Second):
		t.Fatal("timeout waiting for explain query done event")
	}
}

func TestFetchMoreRows_Lifecycle(t *testing.T) {
	a := setupApp(t)
	defer a.db.Close()
	a.prefs.DefaultLimit = 10
	a.prefs.ChunkSize = 5

	doneChan := make(chan map[string]any, 4)
	chunkChan := make(chan map[string]any, 16)
	em := funcEventEmitter{fn: func(_ context.Context, eventName string, payload any) {
		data, ok := payload.(map[string]any)
		if !ok {
			return
		}
		if eventName == constant.EventQueryDone {
			doneChan <- data
			return
		}
		if eventName == constant.EventQueryChunk {
			chunkChan <- data
		}
	}}
	a.emitter = em
	a.conn.emitter = em
	a.query.emitter = em
	a.tx.emitter = em

	query := `WITH RECURSIVE cnt(x) AS (
		SELECT 1
		UNION ALL
		SELECT x+1 FROM cnt
		LIMIT 30
	)
	SELECT x FROM cnt;`
	a.ExecuteQuery("tab-fetchmore-1", query)

	var firstDone map[string]any
	select {
	case firstDone = <-doneChan:
	case <-time.After(4 * time.Second):
		t.Fatal("timeout waiting first query done")
	}
	if hasMore, _ := firstDone["hasMore"].(bool); !hasMore {
		t.Fatalf("expected hasMore=true for initial query")
	}

	a.FetchMoreRows("tab-fetchmore-1", 10)

	var secondDone map[string]any
	select {
	case secondDone = <-doneChan:
	case <-time.After(4 * time.Second):
		t.Fatal("timeout waiting fetch more done")
	}
	if errMsg, ok := secondDone["error"].(string); ok && errMsg != "" {
		t.Fatalf("expected no fetch-more error, got %q", errMsg)
	}

	chunkCount := 0
drainChunks:
	for {
		select {
		case <-chunkChan:
			chunkCount++
		default:
			break drainChunks
		}
	}
	if chunkCount == 0 {
		t.Fatalf("expected query chunk events for run/fetch-more lifecycle")
	}
}

func TestConnectionService_ReconnectAndSwitch_NoActiveConnection(t *testing.T) {
	svc := NewConnectionService(
		context.Background(),
		utils.NewLogger(false),
		func() utils.Preferences { return utils.Preferences{} },
		func() *sql.DB { return nil },
		func() *models.ConnectionProfile { return nil },
		func() error { return nil },
		func(_ *sql.DB, _ *models.ConnectionProfile) {},
		funcEventEmitter{},
	)

	if err := svc.Reconnect(); err == nil {
		t.Fatalf("expected reconnect to fail when there is no active profile")
	}
	if err := svc.SwitchDatabase("otherdb"); err == nil {
		t.Fatalf("expected switch database to fail when there is no active profile")
	}
}

func TestConnectionService_FetchDatabaseSchema_EmitsSchemaError(t *testing.T) {
	profile := &models.ConnectionProfile{
		Name:   "integration-profile",
		Driver: "unsupported-driver",
		DBName: "db1",
	}

	schemaErrV1 := make(chan map[string]any, 1)
	schemaErrV2 := make(chan SchemaErrorEvent, 1)
	em := funcEventEmitter{fn: func(_ context.Context, eventName string, payload any) {
		if eventName == constant.EventSchemaError {
			if data, ok := payload.(map[string]any); ok {
				schemaErrV1 <- data
			}
			return
		}
		if eventName == constant.EventSchemaErrorV2 {
			if data, ok := payload.(SchemaErrorEvent); ok {
				schemaErrV2 <- data
			}
		}
	}}

	svc := NewConnectionService(
		context.Background(),
		utils.NewLogger(false),
		func() utils.Preferences { return utils.Preferences{SchemaTimeout: 1} },
		func() *sql.DB { return nil },
		func() *models.ConnectionProfile { return profile },
		func() error { return nil },
		func(_ *sql.DB, _ *models.ConnectionProfile) {},
		em,
	)

	if err := svc.FetchDatabaseSchema(profile.Name, profile.DBName); err != nil {
		t.Fatalf("FetchDatabaseSchema should start async flow, got error: %v", err)
	}

	select {
	case payload := <-schemaErrV1:
		if payload["profileName"] != profile.Name {
			t.Fatalf("unexpected profileName in v1 payload: %#v", payload["profileName"])
		}
		errMsg, _ := payload["error"].(string)
		if errMsg == "" {
			t.Fatalf("expected error message in v1 schema error payload")
		}
	case <-time.After(3 * time.Second):
		t.Fatal("timeout waiting schema:error v1 event")
	}

	select {
	case payload := <-schemaErrV2:
		if payload.ProfileName != profile.Name {
			t.Fatalf("unexpected profileName in v2 payload: %s", payload.ProfileName)
		}
		if payload.Error == "" {
			t.Fatalf("expected error message in v2 schema error payload")
		}
	case <-time.After(3 * time.Second):
		t.Fatal("timeout waiting schema:error.v2 event")
	}
}
