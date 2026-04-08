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
	ctx                   context.Context
	logger                *slog.Logger
	db                    *sql.DB
	profile               *models.ConnectionProfile
	project               *models.Project
	currentEnvironmentKey models.EnvironmentKey
	draft                 []*models.ConnectionProfile
	prefs                 utils.Preferences

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
	tracking  *GitTrackingService
	sc        *SourceControlService

	pluginRegistry *pluginext.InMemoryRegistry
	licenseService *license.LicenseService
}

func NewApp() *App {
	a := &App{
		emitter: NewWailsEventEmitter(),
		draft:   []*models.ConnectionProfile{},
	}

	a.history = NewHistoryService(
		func() *models.ConnectionProfile { return a.profile },
		func() *models.Project { return a.project },
		func() string { return string(a.currentProjectEnvironmentKey()) },
	)
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
		func() string { return a.currentProjectSchema() },
		func() string { return string(a.currentProjectEnvironmentKey()) },
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
	a.tracking = NewGitTrackingService(nil)
	a.sc = NewSourceControlService()
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
	a.tracking.SetLogger(a.logger)

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
	project := a.project
	if a.sc != nil && project != nil && project.AutoCommitOnExit {
		done := make(chan error, 1)
		go func() {
			_, _, err := a.sc.CommitAllIfDirty(project.GitRepoPath, "app.close: autosave flush")
			done <- err
		}()
		select {
		case err := <-done:
			if err != nil {
				a.logger.Warn("source control auto commit on close failed", "err", err, "repo_path", project.GitRepoPath)
			}
		case <-time.After(3 * time.Second):
			a.logger.Warn("source control auto commit on close timed out", "repo_path", project.GitRepoPath)
		}
	}

	a.query.Shutdown()
	_ = a.tx.RollbackActive()
	if a.db != nil {
		_ = a.db.Close()
		a.db = nil
	}
	a.profile = nil
	a.project = nil
	a.currentEnvironmentKey = ""
	if a.tracking != nil {
		a.tracking.Close()
	}
	a.logger.Info("zentro shutdown complete")
}
