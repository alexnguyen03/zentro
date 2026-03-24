package app

import (
	"context"
	"database/sql"
	"log/slog"
	"strconv"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"zentro/internal/constant"
	"zentro/internal/models"
	"zentro/internal/utils"
)

// QuerySession tracks one active query execution per tab.
type QuerySession struct {
	TabID      string
	CancelFunc context.CancelFunc
	StartedAt  time.Time
}

// App is the Wails application struct.
type App struct {
	ctx     context.Context
	logger  *slog.Logger
	db      *sql.DB
	profile *models.ConnectionProfile
	project *models.Project
	draft   []*models.ConnectionProfile
	prefs   utils.Preferences

	forceQuit bool
	emitter   EventEmitter

	projects  *ProjectService
	conn      *ConnectionService
	query     *QueryService
	tx        *TransactionService
	history   *HistoryService
	scripts   *ScriptService
	templates *TemplateService
	bookmarks *BookmarkService
	formatter *QueryFormatterService
	compare   *QueryCompareService
	update    *UpdateService
}

func NewApp() *App {
	a := &App{
		emitter: NewWailsEventEmitter(),
		draft:   []*models.ConnectionProfile{},
	}

	a.history = NewHistoryService(func() *models.ConnectionProfile { return a.profile })
	a.tx = NewTransactionService(
		context.Background(),
		nil,
		func() *sql.DB { return a.db },
		func() string {
			if a.profile != nil {
				return a.profile.Driver
			}
			return ""
		},
		a.emitter,
	)

	a.conn = NewConnectionService(
		context.Background(), nil, func() utils.Preferences { return a.prefs },
		func() *sql.DB { return a.db },
		func() *models.ConnectionProfile { return a.profile },
		func() error { return a.tx.RollbackActive() },
		func(db *sql.DB, p *models.ConnectionProfile) {
			a.db = db
			a.profile = p
		},
		a.emitter,
	)

	a.query = NewQueryService(
		context.Background(), nil, func() utils.Preferences { return a.prefs },
		func() *sql.DB { return a.db },
		func() sqlExecutor { return a.tx.GetExecutor() },
		func() string {
			if a.profile != nil {
				return a.profile.Driver
			}
			return ""
		},
		a.history.AppendEntry,
		a.emitter,
	)

	a.scripts = NewScriptService(nil)
	a.templates = NewTemplateService()
	a.bookmarks = NewBookmarkService()
	a.formatter = NewQueryFormatterService()
	a.compare = NewQueryCompareService()
	a.update = NewUpdateService("alexnguyen03/zentro")
	a.projects = NewProjectService(nil)

	return a
}

func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
	a.logger = utils.NewLogger(false)

	a.conn.ctx = ctx
	a.conn.logger = a.logger
	a.query.ctx = ctx
	a.query.logger = a.logger
	a.tx.ctx = ctx
	a.tx.logger = a.logger
	a.scripts.logger = a.logger
	a.projects.logger = a.logger

	prefs, err := utils.LoadPreferences()
	if err != nil {
		a.logger.Warn("load preferences failed", "err", err)
	}
	a.prefs = prefs
	a.logger.Info("zentro starting", "version", "v0.2.0-beta")
}

func (a *App) OnBeforeClose(ctx context.Context) bool {
	if a.forceQuit {
		return false
	}
	a.emitter.Emit(ctx, constant.EventAppBeforeClose, nil)
	return true
}

func (a *App) ForceQuit() {
	a.forceQuit = true
	a.Shutdown()
	runtime.Quit(a.ctx)
}

func (a *App) Shutdown() {
	a.logger.Info("zentro shutting down")
	a.query.Shutdown()
	_ = a.tx.RollbackActive()
	if a.db != nil {
		_ = a.db.Close()
		a.db = nil
	}
	a.profile = nil
	a.project = nil
	a.logger.Info("zentro shutdown complete")
}

func (a *App) ListProjects() ([]*models.Project, error) { return a.projects.ListProjects() }

func (a *App) GetProject(projectID string) (*models.Project, error) {
	return a.projects.GetProject(projectID)
}

func (a *App) CreateProject(p models.Project) (*models.Project, error) {
	project, err := a.projects.CreateProject(p)
	if err != nil {
		return nil, err
	}
	a.project = project
	a.draft = []*models.ConnectionProfile{}
	return project, nil
}

func (a *App) SaveProject(p models.Project) (*models.Project, error) {
	project, err := a.projects.SaveProject(p)
	if err != nil {
		return nil, err
	}
	if a.project == nil || a.project.ID == project.ID {
		a.project = project
	}
	return project, nil
}

func (a *App) DeleteProject(projectID string) error {
	if a.project != nil && a.project.ID == projectID {
		a.project = nil
	}
	return a.projects.DeleteProject(projectID)
}

func (a *App) OpenProject(projectID string) (*models.Project, error) {
	project, err := a.projects.GetProject(projectID)
	if err != nil {
		return nil, err
	}
	a.project = project
	a.draft = []*models.ConnectionProfile{}
	return project, nil
}

func (a *App) GetActiveProject() *models.Project { return a.project }

// ── Connection ─────────────────────────────────────────────────────────────

func (a *App) LoadConnections() ([]*models.ConnectionProfile, error) {
	if a.project != nil {
		return a.projectConnectionProfiles(), nil
	}
	return a.cloneDraftConnections(), nil
}

func (a *App) LoadDatabasesForProfile(name string) ([]string, error) {
	if pc := a.findProjectConnectionByProfileName(name); pc != nil {
		return a.conn.LoadDatabasesForConnectionProfile(projectConnectionToProfile(pc))
	}
	if draft := a.findDraftConnectionByName(name); draft != nil {
		return a.conn.LoadDatabasesForConnectionProfile(draft)
	}
	return []string{}, nil
}
func (a *App) SaveConnection(p models.ConnectionProfile) error {
	if a.project == nil {
		a.upsertDraftConnection(&p)
		return nil
	}

	matched := false
	for i := range a.project.Connections {
		connection := &a.project.Connections[i]
		if connection.EnvironmentKey == "" && projectConnectionMatchesName(connection, p.Name) {
			a.project.Connections[i] = profileToProjectConnection(a.project.ID, "", p, connection.ID)
			matched = true
			break
		}
	}
	if !matched {
		a.project.Connections = append(a.project.Connections, profileToProjectConnection(a.project.ID, "", p, ""))
	}

	_, err := a.saveActiveProject()
	return err
}

func (a *App) DeleteConnection(name string) error {
	if name == "" {
		return nil
	}

	if a.project == nil {
		a.deleteDraftConnection(name)
		return nil
	}

	deleted := map[string]bool{}
	filtered := make([]models.ProjectConnection, 0, len(a.project.Connections))
	for i := range a.project.Connections {
		connection := a.project.Connections[i]
		if projectConnectionMatchesName(&connection, name) {
			if connection.ID != "" {
				deleted[connection.ID] = true
			}
			continue
		}
		filtered = append(filtered, connection)
	}
	a.project.Connections = filtered

	if len(deleted) > 0 {
		for i := range a.project.Environments {
			if deleted[a.project.Environments[i].ConnectionID] {
				a.project.Environments[i].ConnectionID = ""
			}
		}
	}

	if a.profile != nil && a.profile.Name == name {
		a.conn.Disconnect()
	}

	_, err := a.saveActiveProject()
	return err
}
func (a *App) TestConnection(p models.ConnectionProfile) error { return a.conn.TestConnection(p) }
func (a *App) Connect(name string) error {
	if pc := a.findProjectConnectionByProfileName(name); pc != nil {
		return a.conn.ConnectWithProfile(projectConnectionToProfile(pc))
	}
	if draft := a.findDraftConnectionByName(name); draft != nil {
		return a.conn.ConnectWithProfile(draft)
	}
	return sql.ErrNoRows
}

func (a *App) ConnectProjectEnvironment(envKey string) error {
	if a.project == nil {
		return sql.ErrConnDone
	}
	targetKey := models.EnvironmentKey(envKey)
	if targetKey == "" {
		targetKey = a.project.DefaultEnvironmentKey
	}

	for i := range a.project.Connections {
		if a.project.Connections[i].EnvironmentKey == targetKey {
			return a.conn.ConnectWithProfile(projectConnectionToProfile(&a.project.Connections[i]))
		}
	}
	return sql.ErrNoRows
}
func (a *App) Reconnect() error                             { return a.conn.Reconnect() }
func (a *App) SwitchDatabase(dbName string) error           { return a.conn.SwitchDatabase(dbName) }
func (a *App) Disconnect()                                  { a.conn.Disconnect() }
func (a *App) GetConnectionStatus() (map[string]any, error) { return a.conn.GetConnectionStatus() }
func (a *App) FetchDatabaseSchema(profileName, dbName string) error {
	return a.conn.FetchDatabaseSchema(profileName, dbName)
}
func (a *App) FetchTableColumns(schema, table string) ([]*models.ColumnDef, error) {
	return a.conn.FetchTableColumns(schema, table)
}
func (a *App) AlterTableColumn(schema, table string, old, updated models.ColumnDef) error {
	return a.conn.AlterTableColumn(schema, table, old, updated)
}
func (a *App) ReorderTableColumns(schema, table string, newOrder []string) error {
	return a.conn.ReorderTableColumns(schema, table, newOrder)
}
func (a *App) AddTableColumn(schema, table string, col models.ColumnDef) error {
	return a.conn.AddTableColumn(schema, table, col)
}
func (a *App) DropTableColumn(schema, table, column string) error {
	return a.conn.DropTableColumn(schema, table, column)
}
func (a *App) FetchTableRelationships(schema, table string) ([]models.TableRelationship, error) {
	return a.conn.FetchTableRelationships(schema, table)
}

// ── Query ──────────────────────────────────────────────────────────────────

func (a *App) ExecuteQuery(tabID, query string) { a.query.ExecuteQuery(tabID, query) }
func (a *App) ExplainQuery(tabID, query string, analyze bool) error {
	return a.query.ExplainQuery(tabID, query, analyze)
}
func (a *App) FetchMoreRows(tabID string, offset int) { a.query.FetchMoreRows(tabID, offset) }
func (a *App) FetchTotalRowCount(tabID string) (int64, error) {
	return a.query.FetchTotalRowCount(tabID)
}
func (a *App) CancelQuery(tabID string)                      { a.query.CancelQuery(tabID) }
func (a *App) ExecuteUpdateSync(query string) (int64, error) { return a.query.ExecuteUpdateSync(query) }
func (a *App) BeginTransaction() error                       { return a.tx.BeginTransaction() }
func (a *App) CommitTransaction() error                      { return a.tx.CommitTransaction() }
func (a *App) RollbackTransaction() error                    { return a.tx.RollbackTransaction() }
func (a *App) GetTransactionStatus() (string, error)         { return a.tx.GetTransactionStatus() }

// ── Scripts ────────────────────────────────────────────────────────────────

func (a *App) GetScripts(connectionName string) ([]models.SavedScript, error) {
	return a.scripts.GetScripts(connectionName)
}
func (a *App) GetScriptContent(connectionName, scriptID string) (string, error) {
	return a.scripts.GetScriptContent(connectionName, scriptID)
}
func (a *App) SaveScript(script models.SavedScript, content string) error {
	return a.scripts.SaveScript(script, content)
}
func (a *App) DeleteScript(connectionName, scriptID string) error {
	return a.scripts.DeleteScript(connectionName, scriptID)
}

// ── History ────────────────────────────────────────────────────────────────

func (a *App) GetHistory() []models.HistoryEntry { return a.history.GetHistory() }
func (a *App) ClearHistory() error               { return a.history.ClearHistory() }

// ── Templates ──────────────────────────────────────────────────────────────

func (a *App) LoadTemplates() ([]models.Template, error) { return a.templates.LoadTemplates() }
func (a *App) SaveTemplate(t models.Template) error      { return a.templates.SaveTemplate(t) }
func (a *App) DeleteTemplate(id string) error            { return a.templates.DeleteTemplate(id) }

// ── Formatter ──────────────────────────────────────────────────────────────

func (a *App) FormatSQL(query string, dialect string) (string, error) {
	return a.formatter.FormatSQL(query, dialect)
}

// ── Bookmarks ──────────────────────────────────────────────────────────────

func (a *App) GetBookmarks(connectionID, tabID string) ([]models.Bookmark, error) {
	return a.bookmarks.GetBookmarks(connectionID, tabID)
}

func (a *App) SaveBookmark(connectionID, tabID string, bookmark models.Bookmark) error {
	return a.bookmarks.SaveBookmark(connectionID, tabID, bookmark)
}

func (a *App) DeleteBookmark(connectionID, tabID string, line int) error {
	return a.bookmarks.DeleteBookmark(connectionID, tabID, line)
}

// ── Compare ────────────────────────────────────────────────────────────────

func (a *App) CompareQueries(query1, query2 string) (string, error) {
	return a.compare.CompareQueries(query1, query2)
}

// ── Preferences ────────────────────────────────────────────────────────────

func (a *App) GetPreferences() utils.Preferences { return a.prefs }
func (a *App) SetPreferences(p utils.Preferences) error {
	a.prefs = p
	return utils.SavePreferences(p)
}

// ── Export ─────────────────────────────────────────────────────────────────

func (a *App) ExportCSV(columns []string, rows [][]string) (string, error) {
	return exportCSV(a.ctx, columns, rows)
}

func (a *App) ExportJSON(columns []string, rows [][]string) (string, error) {
	return exportJSON(a.ctx, columns, rows)
}

func (a *App) ExportSQLInsert(columns []string, rows [][]string, tableName string) (string, error) {
	return exportSQLInsert(a.ctx, columns, rows, tableName)
}

// ── Updates ────────────────────────────────────────────────────────────────

// Version is set at build time via -ldflags "-X 'zentro/internal/app.Version=v0.2.0-beta'"
var Version = "v0.2.0-beta"

func (a *App) GetCurrentVersion() string {
	return Version
}

func (a *App) CheckForUpdates() (*UpdateInfo, error) {
	return a.update.CheckForUpdates(a.GetCurrentVersion())
}

// ── Schema ─────────────────────────────────────────────────────────────────

func (a *App) GetTableDDL(profileName, schema, tableName string) (string, error) {
	_ = profileName
	return GetTableDDLWithConnection(a.profile, a.db, schema, tableName)
}

func (a *App) DropObject(profileName, schema, objectName, objectType string) error {
	_ = profileName
	return DropObjectWithConnection(a.profile, a.db, schema, objectName, objectType)
}

func (a *App) CreateIndex(profileName, schema, tableName, indexName string, columns []string, unique bool) error {
	_ = profileName
	return CreateIndexWithConnection(a.profile, a.db, schema, tableName, indexName, columns, unique)
}

func (a *App) DropIndex(profileName, schema, indexName string) error {
	_ = profileName
	return DropIndexWithConnection(a.profile, a.db, schema, indexName)
}

func (a *App) GetIndexes(profileName, schema, tableName string) ([]IndexInfo, error) {
	_ = profileName
	return GetIndexesWithConnection(a.profile, a.db, schema, tableName)
}

func (a *App) CreateTable(profileName, schema, tableName string, columns []models.ColumnDef) error {
	_ = profileName
	return CreateTableWithConnection(a.profile, a.db, schema, tableName, columns)
}

func (a *App) findProjectConnectionByProfileName(profileName string) *models.ProjectConnection {
	if a.project == nil || profileName == "" {
		return nil
	}
	for i := range a.project.Connections {
		c := &a.project.Connections[i]
		if c.EnvironmentKey == a.project.DefaultEnvironmentKey {
			if c.Name == profileName || c.AdvancedMeta["profile_name"] == profileName {
				return c
			}
		}
	}
	for i := range a.project.Connections {
		c := &a.project.Connections[i]
		if c.Name == profileName || c.AdvancedMeta["profile_name"] == profileName {
			return c
		}
	}
	return nil
}

func (a *App) projectConnectionProfiles() []*models.ConnectionProfile {
	if a.project == nil {
		return []*models.ConnectionProfile{}
	}
	profiles := make([]*models.ConnectionProfile, 0, len(a.project.Connections))
	seen := make(map[string]int)
	for i := range a.project.Connections {
		connection := &a.project.Connections[i]
		profile := projectConnectionToProfile(connection)
		if profile == nil || profile.Name == "" {
			continue
		}
		if idx, ok := seen[profile.Name]; ok {
			// Prefer local draft entries (environment_key = "") over bound env entries
			// when names collide, so quick-saved credentials are visible immediately.
			if connection.EnvironmentKey == "" {
				profiles[idx] = profile
			}
			continue
		}
		seen[profile.Name] = len(profiles)
		profiles = append(profiles, profile)
	}
	return profiles
}

func projectConnectionToProfile(c *models.ProjectConnection) *models.ConnectionProfile {
	if c == nil {
		return nil
	}
	p := &models.ConnectionProfile{
		Name:            c.Name,
		Driver:          c.Driver,
		Host:            c.Host,
		Port:            c.Port,
		DBName:          c.Database,
		Username:        c.Username,
		Password:        c.Password,
		SSLMode:         c.SSLMode,
		SavePassword:    c.SavePassword,
		EncryptPassword: boolFromMeta(c.AdvancedMeta, "encrypt_password", true),
		ShowAllSchemas:  boolFromMeta(c.AdvancedMeta, "show_all_schemas", false),
		TrustServerCert: boolFromMeta(c.AdvancedMeta, "trust_server_cert", false),
		ConnectTimeout:  30,
	}
	if p.DBName == "" {
		p.DBName = c.AdvancedMeta["db_name"]
	}
	if p.Name == "" {
		p.Name = c.AdvancedMeta["profile_name"]
	}
	return p
}

func boolFromMeta(meta map[string]string, key string, fallback bool) bool {
	if meta == nil {
		return fallback
	}
	raw, ok := meta[key]
	if !ok || raw == "" {
		return fallback
	}
	value, err := strconv.ParseBool(raw)
	if err != nil {
		return fallback
	}
	return value
}

func (a *App) saveActiveProject() (*models.Project, error) {
	if a.project == nil {
		return nil, sql.ErrNoRows
	}
	saved, err := a.projects.SaveProject(*a.project)
	if err != nil {
		return nil, err
	}
	a.project = saved
	return saved, nil
}

func (a *App) cloneDraftConnections() []*models.ConnectionProfile {
	profiles := make([]*models.ConnectionProfile, 0, len(a.draft))
	for i := range a.draft {
		profiles = append(profiles, cloneConnectionProfile(a.draft[i]))
	}
	return profiles
}

func (a *App) findDraftConnectionByName(name string) *models.ConnectionProfile {
	for i := range a.draft {
		profile := a.draft[i]
		if profile != nil && profile.Name == name {
			return cloneConnectionProfile(profile)
		}
	}
	return nil
}

func (a *App) upsertDraftConnection(profile *models.ConnectionProfile) {
	if profile == nil || profile.Name == "" {
		return
	}

	next := cloneConnectionProfile(profile)
	for i := range a.draft {
		if a.draft[i] != nil && a.draft[i].Name == next.Name {
			a.draft[i] = next
			return
		}
	}
	a.draft = append(a.draft, next)
}

func (a *App) deleteDraftConnection(name string) {
	filtered := make([]*models.ConnectionProfile, 0, len(a.draft))
	for i := range a.draft {
		profile := a.draft[i]
		if profile == nil || profile.Name == name {
			continue
		}
		filtered = append(filtered, profile)
	}
	a.draft = filtered
}

func cloneConnectionProfile(profile *models.ConnectionProfile) *models.ConnectionProfile {
	if profile == nil {
		return nil
	}
	copy := *profile
	return &copy
}

func projectConnectionMatchesName(connection *models.ProjectConnection, name string) bool {
	if connection == nil || name == "" {
		return false
	}
	return connection.Name == name || connection.AdvancedMeta["profile_name"] == name
}

func profileToProjectConnection(projectID string, environmentKey models.EnvironmentKey, profile models.ConnectionProfile, existingID string) models.ProjectConnection {
	if profile.SavePassword && !profile.EncryptPassword {
		profile.EncryptPassword = true
	}
	return models.ProjectConnection{
		ID:             existingID,
		ProjectID:      projectID,
		EnvironmentKey: environmentKey,
		Name:           profile.Name,
		Driver:         profile.Driver,
		Host:           profile.Host,
		Port:           profile.Port,
		Database:       profile.DBName,
		Username:       profile.Username,
		Password:       profile.Password,
		SavePassword:   profile.SavePassword,
		SSLMode:        profile.SSLMode,
		AdvancedMeta: map[string]string{
			"profile_name":      profile.Name,
			"db_name":           profile.DBName,
			"encrypt_password":  strconv.FormatBool(profile.EncryptPassword),
			"show_all_schemas":  strconv.FormatBool(profile.ShowAllSchemas),
			"trust_server_cert": strconv.FormatBool(profile.TrustServerCert),
		},
	}
}
