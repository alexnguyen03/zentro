// Package app is the Wails backend — all exported methods are bound to the frontend JS.
// Pattern: Facade — single surface hiding db, driver, and prefs complexity.
// Pattern: Singleton — one App instance created in main.go via NewApp().
// Pattern: Observer — results pushed to frontend via runtime.EventsEmit.
package app

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
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

// App is the Wails application struct.
// All exported methods become callable from the frontend via generated bindings.
type App struct {
	ctx      context.Context
	logger   *slog.Logger
	db       *sql.DB
	profile  *models.ConnectionProfile
	sessions map[string]*QuerySession // tabID → active session
	prefs    utils.Preferences
}

// NewApp creates the App. Called once in main.go.
func NewApp() *App {
	return &App{
		sessions: make(map[string]*QuerySession),
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

	a.logger.Info("connecting", "profile", name)
	db, err := dbpkg.OpenConnection(prof)
	if err != nil {
		return dbpkg.FriendlyError(prof.Driver, err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		db.Close()
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
	a.logger.Info("connected", "profile", name, "driver", prof.Driver)

	// Fetch DB list async — lazy schema per-DB loaded on demand
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
	a.logger.Info("disconnected")
}

// fetchDatabaseList fetches just the database names and emits "schema:databases".
// Full per-DB schema is fetched lazily via FetchDatabaseSchema.
func (a *App) fetchDatabaseList() {
	if a.db == nil || a.profile == nil {
		return
	}
	dbs, err := dbpkg.FetchDatabases(a.db, a.profile.Driver, a.profile.DBName, a.logger)
	if err != nil {
		a.logger.Warn("fetch databases failed", "err", err)
		return
	}

	names := make([]string, 0, len(dbs))
	seen := make(map[string]bool)

	// Always put the profile's configured DBName first — even if the pooler
	// doesn't expose it in pg_database (e.g., Neon serverless pooler).
	if a.profile.DBName != "" {
		names = append(names, a.profile.DBName)
		seen[a.profile.DBName] = true
	}
	for _, d := range dbs {
		if !seen[d.Name] {
			names = append(names, d.Name)
			seen[d.Name] = true
		}
	}

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
		schemas, err := d.FetchSchema(ctx, conn, a.logger)
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
			a.streamSelect(ctx, tabID, query, start)
		} else {
			a.execNonSelect(ctx, tabID, query, start)
		}
	}()
}

// streamSelect runs a SELECT and emits chunks of 500 rows progressively.
func (a *App) streamSelect(ctx context.Context, tabID, query string, start time.Time) {
	normalized := dbpkg.InjectLimitIfMissing(query, a.prefs.DefaultLimit)
	rows, err := a.db.QueryContext(ctx, normalized)
	if err != nil {
		a.emitDone(tabID, 0, time.Since(start), true, fmt.Errorf("query: %w", err))
		return
	}
	defer rows.Close()

	cols, _ := rows.Columns()
	colCount := len(cols)

	seq := 0
	buf := make([][]string, 0, 500)
	sentCols := false

	for rows.Next() {
		row := scanRowAsStrings(rows, colCount)
		buf = append(buf, row)

		if len(buf) == 500 {
			var chunkCols []string
			if !sentCols {
				chunkCols = cols
				sentCols = true
			}
			emitEvent(a.ctx, "query:chunk", buildChunk(tabID, chunkCols, buf, seq))
			buf = buf[:0]
			seq++
		}
	}
	// Emit remainder
	if len(buf) > 0 || !sentCols {
		var chunkCols []string
		if !sentCols {
			chunkCols = cols
		}
		emitEvent(a.ctx, "query:chunk", buildChunk(tabID, chunkCols, buf, seq))
	}

	a.emitDone(tabID, 0, time.Since(start), true, rows.Err())
}

// execNonSelect runs INSERT/UPDATE/DELETE/DDL and emits done.
func (a *App) execNonSelect(ctx context.Context, tabID, query string, start time.Time) {
	res, err := a.db.ExecContext(ctx, query)
	if err != nil {
		a.emitDone(tabID, 0, time.Since(start), false, fmt.Errorf("exec: %w", err))
		return
	}
	affected, _ := res.RowsAffected()
	a.emitDone(tabID, affected, time.Since(start), false, nil)
}

// CancelQuery cancels the running query for the specified tab.
func (a *App) CancelQuery(tabID string) {
	if s, ok := a.sessions[tabID]; ok {
		a.logger.Info("cancelling query", "tab", tabID)
		s.CancelFunc()
	}
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

// ── Export ─────────────────────────────────────────────────────────────────

// ExportCSV opens an OS save dialog and writes columns+rows as CSV.
// Returns the chosen file path (empty string if user cancelled).
func (a *App) ExportCSV(columns []string, rows [][]string) (string, error) {
	return exportCSV(a.ctx, columns, rows)
}

// ── Helpers ────────────────────────────────────────────────────────────────

func (a *App) emitDone(tabID string, affected int64, duration time.Duration, isSelect bool, err error) {
	payload := map[string]any{
		"tabID":    tabID,
		"affected": affected,
		"duration": duration.Milliseconds(),
		"isSelect": isSelect,
	}
	if err != nil {
		payload["error"] = err.Error()
	}
	emitEvent(a.ctx, "query:done", payload)
}

func buildChunk(tabID string, cols []string, rows [][]string, seq int) map[string]any {
	chunk := map[string]any{
		"tabID": tabID,
		"rows":  rows,
		"seq":   seq,
	}
	if cols != nil {
		chunk["columns"] = cols
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
