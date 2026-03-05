// Package app is the Wails backend — all exported methods are bound to the frontend JS.
// Pattern: Facade — single surface hiding db, driver, and prefs complexity.
// Pattern: Singleton — one App instance created in main.go via NewApp().
// Pattern: Observer — results pushed to frontend via runtime.EventsEmit.
package app

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	dbpkg "zentro/internal/db"
	"zentro/internal/models"
	"zentro/internal/utils"
)

var emitEvent = runtime.EventsEmit

// QuerySession tracks one active query execution per tab.
// Pattern: Singleton-per-tab — created per ExecuteQuery call, destroyed on done/cancel.
type QuerySession struct {
	TabID      string
	CancelFunc context.CancelFunc
	StartedAt  time.Time
}

// HistoryEntry records one query execution.
type HistoryEntry struct {
	ID         string    `json:"id"`
	Query      string    `json:"query"`
	Profile    string    `json:"profile"`
	Database   string    `json:"database"`
	DurationMs int64     `json:"duration_ms"`
	RowCount   int64     `json:"row_count"`
	Error      string    `json:"error,omitempty"`
	ExecutedAt time.Time `json:"executed_at"`
}

// App is the Wails application struct.
// All exported methods become callable from the frontend via generated bindings.
type App struct {
	ctx      context.Context
	logger   *slog.Logger
	db       *sql.DB
	profile  *models.ConnectionProfile
	sessions map[string]*QuerySession // tabID → active session
	prefs    utils.Preferences
	history  []HistoryEntry
	histMu   sync.Mutex

	// activeQueries stores the last executed SELECT query per tab for pagination
	// Pattern: Singleton application state for query tracking
	activeQueries   map[string]string
	activeQueriesMu sync.Mutex
}

// NewApp creates the App. Called once in main.go.
func NewApp() *App {
	return &App{
		sessions:      make(map[string]*QuerySession),
		activeQueries: make(map[string]string),
	}
}

// Startup is called by Wails when the application starts.
func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
	a.logger = utils.NewLogger(false)
	prefs, err := utils.LoadPreferences()
	if err != nil {
		a.logger.Warn("load preferences failed", "err", err)
	}
	a.prefs = prefs
	a.logger.Info("zentro starting", "version", "0.2.0")
}

// OnBeforeClose is called by Wails when the user requests to close the window.
// Returning true blocks the native close — the frontend will call runtime.Quit()
// after confirming with the user (e.g. if queries are still running).
func (a *App) OnBeforeClose(ctx context.Context) bool {
	emitEvent(ctx, "app:before-close", nil)
	return true // always block; frontend decides when to actually quit
}

// ── Connection Management ──────────────────────────────────────────────────

// LoadConnections returns all saved connection profiles.
func (a *App) LoadConnections() ([]*models.ConnectionProfile, error) {
	return utils.LoadConnections()
}

// SaveConnection creates or updates a connection profile.
// If a profile with the same Name exists it is replaced; otherwise appended.
func (a *App) SaveConnection(p models.ConnectionProfile) error {
	profiles, err := utils.LoadConnections()
	if err != nil {
		return err
	}
	found := false
	for i, existing := range profiles {
		if existing.Name == p.Name {
			profiles[i] = &p
			found = true
			break
		}
	}
	if !found {
		profiles = append(profiles, &p)
	}
	a.logger.Info("saving connection", "profile", p.Name)
	return utils.SaveConnections(profiles)
}

// DeleteConnection removes the profile by name.
func (a *App) DeleteConnection(name string) error {
	a.logger.Info("deleting connection", "profile", name)
	return utils.DeleteConnection(name)
}

// TestConnection opens a temporary connection and pings — no state saved.
func (a *App) TestConnection(p models.ConnectionProfile) error {
	a.logger.Info("testing connection", "profile", p.Name)
	return dbpkg.TestConnection(&p)
}

// Connect opens and pins a connection for the named profile.
// Emits "connection:changed" and "schema:databases" events.
func (a *App) Connect(name string) error {
	profiles, err := utils.LoadConnections()
	if err != nil {
		return err
	}
	var prof *models.ConnectionProfile
	for _, p := range profiles {
		if p.Name == name {
			prof = p
			break
		}
	}
	if prof == nil {
		return fmt.Errorf("connection %q not found", name)
	}

	a.logger.Info("connecting",
		"profile", name,
		"driver", prof.Driver,
		"host", prof.Host,
		"port", prof.Port,
		"db_name", prof.DBName,
		"ssl_mode", prof.SSLMode,
	)
	db, err := dbpkg.OpenConnection(prof)
	if err != nil {
		a.logger.Error("open connection failed", "profile", name, "err", err)
		return dbpkg.FriendlyError(prof.Driver, err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		a.logger.Error("ping failed", "profile", name, "err", err)
		return dbpkg.FriendlyError(prof.Driver, err)
	}

	// Close previous connection if any
	if a.db != nil {
		_ = a.db.Close()
	}
	a.db = db
	a.profile = prof

	emitEvent(a.ctx, "connection:changed", map[string]any{
		"profile": prof,
		"status":  "connected",
	})
	a.logger.Info("connected — emitted connection:changed",
		"profile", name,
		"driver", prof.Driver,
		"db_name", prof.DBName,
	)
	runtime.WindowSetTitle(a.ctx, fmt.Sprintf("Zentro — %s (%s)", prof.Name, prof.Driver))

	// Fetch DB list async — lazy schema per-DB loaded on demand
	go a.fetchDatabaseList()
	return nil
}

// SwitchDatabase changes the active database on the current connection.
func (a *App) SwitchDatabase(dbName string) error {
	if a.profile == nil {
		return fmt.Errorf("no active connection")
	}
	if a.profile.DBName == dbName {
		return nil
	}

	a.logger.Info("switching database", "from", a.profile.DBName, "to", dbName)

	clone := *a.profile
	clone.DBName = dbName

	db, err := dbpkg.OpenConnection(&clone)
	if err != nil {
		a.logger.Error("switch database failed", "db", dbName, "err", err)
		return dbpkg.FriendlyError(clone.Driver, err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		a.logger.Error("ping failed on new db", "db", dbName, "err", err)
		return dbpkg.FriendlyError(clone.Driver, err)
	}

	if a.db != nil {
		_ = a.db.Close()
	}
	a.db = db
	a.profile = &clone

	a.logger.Info("switched database ok")
	emitEvent(a.ctx, "connection:changed", map[string]any{
		"profile": &clone,
		"status":  "connected",
	})

	go a.fetchDatabaseList()
	return nil
}

// Disconnect closes the active connection.
func (a *App) Disconnect() {
	if a.db != nil {
		_ = a.db.Close()
		a.db = nil
	}
	a.profile = nil
	emitEvent(a.ctx, "connection:changed", map[string]any{"status": "disconnected"})
	runtime.WindowSetTitle(a.ctx, "Zentro")
	a.logger.Info("disconnected")
}

// fetchDatabaseList fetches just the database names and emits "schema:databases".
// Full per-DB schema is fetched lazily via FetchDatabaseSchema.
func (a *App) fetchDatabaseList() {
	if a.db == nil || a.profile == nil {
		return
	}

	a.logger.Info("fetchDatabaseList start",
		"profile", a.profile.Name,
		"profile_db_name", a.profile.DBName,
		"driver", a.profile.Driver,
		"host", a.profile.Host,
		"port", a.profile.Port,
	)

	dbs, err := dbpkg.FetchDatabases(a.db, a.profile.Driver, a.profile.DBName, a.profile.ShowAllSchemas, a.logger)
	if err != nil {
		a.logger.Warn("fetch databases failed", "err", err)
		return
	}

	names := make([]string, 0, len(dbs)+4)
	seen := make(map[string]bool)

	// 1) Always put the profile's configured DBName first — even if the pooler
	//    doesn't expose it in pg_database (e.g., Neon serverless pooler).
	if a.profile.DBName != "" {
		names = append(names, a.profile.DBName)
		seen[a.profile.DBName] = true
		a.logger.Info("db list: added profile db_name first", "db_name", a.profile.DBName)
	}

	// 2) Add everything pg_database returned.
	for _, d := range dbs {
		if !seen[d.Name] {
			names = append(names, d.Name)
			seen[d.Name] = true
		}
	}
	a.logger.Info("db list: after pg_database merge", "count", len(names), "databases", names)

	// 3) Cross-reference sibling profiles: any saved profile with the same
	//    driver+host+port but a different db_name — add it so Neon users who
	//    have separate profiles per database see ALL their databases in one tree.
	allProfiles, loadErr := utils.LoadConnections()
	if loadErr != nil {
		a.logger.Warn("cross-profile load failed", "err", loadErr)
	} else {
		for _, p := range allProfiles {
			if p.Driver == a.profile.Driver &&
				p.Host == a.profile.Host &&
				p.Port == a.profile.Port &&
				p.DBName != "" &&
				!seen[p.DBName] {
				names = append(names, p.DBName)
				seen[p.DBName] = true
				a.logger.Info("db list: added sibling db from profile",
					"db_name", p.DBName,
					"from_profile", p.Name,
				)
			}
		}
	}

	a.logger.Info("emitting schema:databases",
		"profile", a.profile.Name,
		"final_db_count", len(names),
		"final_databases", names,
	)
	emitEvent(a.ctx, "schema:databases", map[string]any{
		"profileName": a.profile.Name,
		"databases":   names,
	})
}

// FetchDatabaseSchema fetches schemas/tables/views for one specific database.
// Called by frontend when user expands a DB node (lazy loading).
// Emits "schema:loaded" event.
func (a *App) FetchDatabaseSchema(profileName, dbName string) error {
	if a.profile == nil || a.profile.Name != profileName {
		return fmt.Errorf("no active connection for profile %q", profileName)
	}
	a.logger.Info("fetching schema", "profile", profileName, "db", dbName)

	go func() {
		// Open a fresh connection to the target DB (required for PostgreSQL)
		clone := *a.profile
		clone.DBName = dbName
		conn, err := dbpkg.OpenConnection(&clone)
		if err != nil {
			a.logger.Warn("cannot open db for schema fetch", "db", dbName, "err", err)
			return
		}
		defer conn.Close()

		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		d, ok := getDriver(a.profile.Driver)
		if !ok {
			return
		}
		schemas, err := d.FetchSchema(ctx, conn, a.profile.ShowAllSchemas, a.logger)
		if err != nil {
			a.logger.Warn("fetch schema failed", "db", dbName, "err", err)
			return
		}
		emitEvent(a.ctx, "schema:loaded", map[string]any{
			"profileName": profileName,
			"dbName":      dbName,
			"schemas":     schemas,
		})
	}()
	return nil
}

// ── Query Execution ────────────────────────────────────────────────────────

// ExecuteQuery runs a SQL query asynchronously.
// Results are streamed to the frontend via events (not return value).
//
// Events emitted:
//   - "query:started"         { tabID }
//   - "query:chunk"           { tabID, columns?, rows, seq }   — every 500 rows
//   - "query:done"            { tabID, affected, duration, isSelect, error? }
func (a *App) ExecuteQuery(tabID, query string) {
	// Cancel any existing session for this tab
	if old, ok := a.sessions[tabID]; ok {
		old.CancelFunc()
		delete(a.sessions, tabID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	a.sessions[tabID] = &QuerySession{
		TabID:      tabID,
		CancelFunc: cancel,
		StartedAt:  time.Now(),
	}

	emitEvent(a.ctx, "query:started", map[string]any{"tabID": tabID})
	a.logger.Info("executing query", "tab", tabID)

	go func() {
		defer func() {
			cancel()
			delete(a.sessions, tabID)
		}()

		if a.db == nil {
			a.emitDone(tabID, 0, 0, true, fmt.Errorf("no active connection"))
			return
		}

		start := time.Now()

		if dbpkg.IsSelectQuery(query) {
			a.activeQueriesMu.Lock()
			a.activeQueries[tabID] = query
			a.activeQueriesMu.Unlock()
			a.streamSelect(ctx, tabID, query, 0, start)
		} else {
			a.execNonSelect(ctx, tabID, query, start)
		}
	}()
}

// streamSelect runs a SELECT and emits chunks of 500 rows progressively.
// Pattern: Facade for database interaction and Observer for async chunk delivery.
func (a *App) streamSelect(ctx context.Context, tabID, query string, offset int, start time.Time) {
	driver := ""
	if a.profile != nil {
		driver = a.profile.Driver
	}

	fetchLimit := a.prefs.DefaultLimit
	normalized := dbpkg.InjectLimitOffsetIfMissing(query, driver, fetchLimit, offset)

	// If the query already had a manual LIMIT, we cannot inject offset safely.
	// We prevent endless loops of fetching the same N manual rows.
	if normalized == query && offset > 0 {
		a.emitDoneWithMore(tabID, 0, time.Since(start), true, false, nil)
		return
	}

	rows, err := a.db.QueryContext(ctx, normalized)
	if err != nil {
		a.emitDoneWithMore(tabID, 0, time.Since(start), true, false, fmt.Errorf("query: %w", err))
		return
	}
	defer rows.Close()

	cols, _ := rows.Columns()
	colCount := len(cols)

	var tableName string
	var pks []string
	if offset == 0 {
		schema, table := dbpkg.ExtractTableFromQuery(query)
		if table != "" {
			if schema == "" && driver == "postgres" && a.profile != nil {
				schema = "public"
			} else if schema == "" && driver == "sqlserver" {
				schema = "dbo"
			}
			keys, err := dbpkg.FetchTablePrimaryKeys(a.db, driver, schema, table)
			if err == nil && len(keys) > 0 {
				tableName = table
				pks = keys
			}
		}
	}

	seq := 0
	buf := make([][]string, 0, 500)
	sentCols := false
	totalRowsFetched := 0

	for rows.Next() {
		row := scanRowAsStrings(rows, colCount)
		buf = append(buf, row)
		totalRowsFetched++

		if len(buf) == 500 {
			var chunkCols []string
			if !sentCols {
				chunkCols = cols
				sentCols = true
				emitEvent(a.ctx, "query:chunk", buildChunk(tabID, chunkCols, buf, seq, tableName, pks))
			} else {
				emitEvent(a.ctx, "query:chunk", buildChunk(tabID, chunkCols, buf, seq, "", nil))
			}
			buf = buf[:0]
			seq++
		}
	}
	// Emit remainder
	if len(buf) > 0 || !sentCols {
		var chunkCols []string
		if !sentCols {
			chunkCols = cols
			emitEvent(a.ctx, "query:chunk", buildChunk(tabID, chunkCols, buf, seq, tableName, pks))
		} else {
			emitEvent(a.ctx, "query:chunk", buildChunk(tabID, chunkCols, buf, seq, "", nil))
		}
	}

	// hasMore is true only when we fetched exactly fetchLimit rows — meaning there may be more pages.
	hasMore := totalRowsFetched == fetchLimit

	totalRows := int64(seq*500 + len(buf))
	if offset == 0 {
		a.appendHistoryFromResult(tabID, query, totalRows, time.Since(start), rows.Err())
	}
	a.emitDoneWithMore(tabID, int64(totalRowsFetched), time.Since(start), true, hasMore, rows.Err())
}

// FetchMoreRows is called by the frontend to load the next page of results for an active tab.
// Pattern: Facade/Controller method.
func (a *App) FetchMoreRows(tabID string, offset int) {
	a.activeQueriesMu.Lock()
	query, ok := a.activeQueries[tabID]
	a.activeQueriesMu.Unlock()

	if !ok || query == "" {
		a.emitDone(tabID, 0, 0, true, fmt.Errorf("no active query found for pagination"))
		return
	}

	// We must wrap execution in a session just like ExecuteQuery does.
	a.sessions[tabID] = &QuerySession{
		TabID:     tabID,
		StartedAt: time.Now(),
	}

	ctx, cancel := context.WithCancel(a.ctx)
	a.sessions[tabID].CancelFunc = cancel

	go func() {
		defer func() {
			cancel()
			delete(a.sessions, tabID)
		}()

		if a.db == nil {
			a.emitDone(tabID, 0, 0, true, fmt.Errorf("no active connection"))
			return
		}

		start := time.Now()
		a.streamSelect(ctx, tabID, query, offset, start)
	}()
}

// execNonSelect runs INSERT/UPDATE/DELETE/DDL and emits done.
func (a *App) execNonSelect(ctx context.Context, tabID, query string, start time.Time) {
	res, err := a.db.ExecContext(ctx, query)
	dur := time.Since(start)
	if err != nil {
		wrappedErr := fmt.Errorf("exec: %w", err)
		a.appendHistoryFromResult(tabID, query, 0, dur, wrappedErr)
		a.emitDone(tabID, 0, dur, false, wrappedErr)
		return
	}
	affected, _ := res.RowsAffected()
	a.appendHistoryFromResult(tabID, query, affected, dur, nil)
	a.emitDone(tabID, affected, dur, false, nil)
}

// FetchTotalRowCount returns the total row count for the last executed query in the given tab.
func (a *App) FetchTotalRowCount(tabID string) (int64, error) {
	a.activeQueriesMu.Lock()
	query, ok := a.activeQueries[tabID]
	a.activeQueriesMu.Unlock()

	if !ok || query == "" {
		return 0, fmt.Errorf("no active query found for count")
	}

	if a.db == nil {
		return 0, fmt.Errorf("no active connection")
	}

	// Remove trailing semicolon if exists, to safely wrap in subquery
	// Simple trim works for basic cases

	// Create a subquery to count all rows without fetching them
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM (%s) AS zentro_count", query)

	var count int64
	// Don't use a.ctx here directly if we want it cancellable, but a.ctx is fine for short counts
	// or we can use a timeout context.
	ctx, cancel := context.WithTimeout(a.ctx, 30*time.Second)
	defer cancel()

	err := a.db.QueryRowContext(ctx, countQuery).Scan(&count)
	if err != nil {
		return 0, err
	}
	return count, nil
}

// CancelQuery cancels the running query for the specified tab.
func (a *App) CancelQuery(tabID string) {
	if s, ok := a.sessions[tabID]; ok {
		a.logger.Info("cancelling query", "tab", tabID)
		s.CancelFunc()
	}
}

// ── Saved Scripts ─────────────────────────────────────────────────────────

// GetScripts returns all saved script metadata for a connection.
func (a *App) GetScripts(connectionName string) ([]models.SavedScript, error) {
	return utils.LoadScripts(connectionName)
}

// GetScriptContent reads the SQL content of a script by ID.
func (a *App) GetScriptContent(connectionName, scriptID string) (string, error) {
	return utils.GetScriptContent(connectionName, scriptID)
}

// SaveScript upserts a script (metadata + .sql file) for a connection.
func (a *App) SaveScript(script models.SavedScript, content string) error {
	a.logger.Info("saving script", "connection", script.ConnectionName, "name", script.Name, "id", script.ID)
	return utils.SaveScript(script, content)
}

// DeleteScript removes a script by ID for a connection.
func (a *App) DeleteScript(connectionName, scriptID string) error {
	a.logger.Info("deleting script", "connection", connectionName, "id", scriptID)
	return utils.DeleteScript(connectionName, scriptID)
}

// ── Preferences ───────────────────────────────────────────────────────────

// GetPreferences returns current preferences.
func (a *App) GetPreferences() utils.Preferences {
	return a.prefs
}

// SetPreferences saves preferences to disk and applies them in-process.
func (a *App) SetPreferences(p utils.Preferences) error {
	a.prefs = p
	return utils.SavePreferences(p)
}

// ── History ───────────────────────────────────────────────────────────────

const maxHistoryEntries = 500

// appendHistoryFromResult is called internally after each query finishes.
func (a *App) appendHistoryFromResult(tabID, query string, rowCount int64, duration time.Duration, err error) {
	profile := ""
	db := ""
	if a.profile != nil {
		profile = a.profile.Name
		db = a.profile.DBName
	}
	errStr := ""
	if err != nil {
		errStr = err.Error()
	}
	e := HistoryEntry{
		ID:         fmt.Sprintf("%d", time.Now().UnixNano()),
		Query:      query,
		Profile:    profile,
		Database:   db,
		DurationMs: duration.Milliseconds(),
		RowCount:   rowCount,
		Error:      errStr,
		ExecutedAt: time.Now(),
	}
	a.histMu.Lock()
	a.history = append([]HistoryEntry{e}, a.history...) // newest first
	if len(a.history) > maxHistoryEntries {
		a.history = a.history[:maxHistoryEntries]
	}
	entries := make([]HistoryEntry, len(a.history))
	copy(entries, a.history)
	a.histMu.Unlock()
	_ = saveHistoryFile(entries)
}

// GetHistory returns all history entries (newest first).
func (a *App) GetHistory() []HistoryEntry {
	a.histMu.Lock()
	if a.history == nil {
		// Lazy-load from disk on first access
		a.histMu.Unlock()
		entries, _ := loadHistoryFile()
		a.histMu.Lock()
		a.history = entries
	}
	out := make([]HistoryEntry, len(a.history))
	copy(out, a.history)
	a.histMu.Unlock()
	return out
}

// ClearHistory deletes all history.
func (a *App) ClearHistory() error {
	a.histMu.Lock()
	a.history = nil
	a.histMu.Unlock()
	p, err := historyFilePath()
	if err != nil {
		return err
	}
	return os.Remove(p)
}

func historyFilePath() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "zentro", "history.json"), nil
}

func saveHistoryFile(entries []HistoryEntry) error {
	p, err := historyFilePath()
	if err != nil {
		return err
	}
	_ = os.MkdirAll(filepath.Dir(p), 0o755)
	f, err := os.Create(p)
	if err != nil {
		return err
	}
	defer f.Close()
	return json.NewEncoder(f).Encode(entries)
}

func loadHistoryFile() ([]HistoryEntry, error) {
	p, err := historyFilePath()
	if err != nil {
		return nil, err
	}
	f, err := os.Open(p)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	var entries []HistoryEntry
	if err := json.NewDecoder(f).Decode(&entries); err != nil {
		return nil, err
	}
	return entries, nil
}

// ── Export ─────────────────────────────────────────────────────────────────

// ExportCSV opens an OS save dialog and writes columns+rows as CSV.
// Returns the chosen file path (empty string if user cancelled).
func (a *App) ExportCSV(columns []string, rows [][]string) (string, error) {
	return exportCSV(a.ctx, columns, rows)
}

// ── Helpers ────────────────────────────────────────────────────────────────

func (a *App) emitDone(tabID string, affected int64, duration time.Duration, isSelect bool, err error) {
	a.emitDoneWithMore(tabID, affected, duration, isSelect, false, err)
}

func (a *App) emitDoneWithMore(tabID string, affected int64, duration time.Duration, isSelect bool, hasMore bool, err error) {
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
	emitEvent(a.ctx, "query:done", payload)
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

// scanRowAsStrings scans a sql.Rows row into a []string.
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
		} else {
			result[i] = fmt.Sprintf("%v", v)
		}
	}
	return result
}
