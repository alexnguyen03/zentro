package app

import (
	"context"
	"database/sql"
	"log/slog"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"zentro/internal/constant"
	"zentro/internal/extensions/license"
	pluginext "zentro/internal/extensions/plugin"
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

	pluginRegistry *pluginext.InMemoryRegistry
	licenseService *license.LicenseService
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
		func() utils.Preferences { return a.prefs },
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
	a.pluginRegistry = pluginext.NewInMemoryRegistry()
	a.licenseService = license.NewLicenseService(nil)

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

func (a *App) Reconnect() error                   { return a.conn.Reconnect() }
func (a *App) SwitchDatabase(dbName string) error { return a.conn.SwitchDatabase(dbName) }
func (a *App) Disconnect()                        { a.conn.Disconnect() }

func (a *App) GetConnectionStatus() (ConnectionRuntimeState, error) {
	return a.conn.GetConnectionStatus()
}

func (a *App) FetchDatabaseSchema(profileName, dbName string) error {
	return a.conn.FetchDatabaseSchema(profileName, dbName)
}

func (a *App) FetchTableColumns(schema, table string) ([]*models.ColumnDef, error) {
	return a.conn.FetchTableColumns(schema, table)
}

func (a *App) AlterTableColumn(schema, table string, old, updated models.ColumnDef) error {
	if err := a.ensureWritable("alter table column"); err != nil {
		return err
	}
	return a.conn.AlterTableColumn(schema, table, old, updated)
}

func (a *App) ReorderTableColumns(schema, table string, newOrder []string) error {
	if err := a.ensureWritable("reorder table columns"); err != nil {
		return err
	}
	return a.conn.ReorderTableColumns(schema, table, newOrder)
}

func (a *App) AddTableColumn(schema, table string, col models.ColumnDef) error {
	if err := a.ensureWritable("add table column"); err != nil {
		return err
	}
	return a.conn.AddTableColumn(schema, table, col)
}

func (a *App) DropTableColumn(schema, table, column string) error {
	if err := a.ensureWritable("drop table column"); err != nil {
		return err
	}
	return a.conn.DropTableColumn(schema, table, column)
}

func (a *App) FetchTableRelationships(schema, table string) ([]models.TableRelationship, error) {
	return a.conn.FetchTableRelationships(schema, table)
}

func (a *App) ExecuteQuery(tabID, query string) { a.query.ExecuteQuery(tabID, query) }

func (a *App) ExplainQuery(tabID, query string, analyze bool) error {
	return a.query.ExplainQuery(tabID, query, analyze)
}

func (a *App) FetchMoreRows(tabID string, offset int) { a.query.FetchMoreRows(tabID, offset) }

func (a *App) FetchTotalRowCount(tabID string) (int64, error) {
	return a.query.FetchTotalRowCount(tabID)
}

func (a *App) CancelQuery(tabID string) { a.query.CancelQuery(tabID) }

func (a *App) ExecuteUpdateSync(query string) (int64, error) {
	if err := a.ensureWritable("execute update"); err != nil {
		return 0, err
	}
	return a.query.ExecuteUpdateSync(query)
}

func (a *App) BeginTransaction() error {
	if err := a.ensureWritable("begin transaction"); err != nil {
		return err
	}
	return a.tx.BeginTransaction()
}

func (a *App) CommitTransaction() error {
	if err := a.ensureWritable("commit transaction"); err != nil {
		return err
	}
	return a.tx.CommitTransaction()
}

func (a *App) RollbackTransaction() error            { return a.tx.RollbackTransaction() }
func (a *App) GetTransactionStatus() (string, error) { return a.tx.GetTransactionStatus() }
