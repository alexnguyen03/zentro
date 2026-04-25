package app

import (
	"runtime/debug"
	"strings"
	"time"

	"zentro/internal/models"
	"zentro/internal/utils"
)

func (a *App) GetScripts(projectID, connectionName string) ([]models.SavedScript, error) {
	return a.scripts.GetScripts(projectID, connectionName)
}
func (a *App) GetScriptContent(projectID, connectionName, scriptID string) (string, error) {
	return a.scripts.GetScriptContent(projectID, connectionName, scriptID)
}
func (a *App) SaveScript(script models.SavedScript, content string) error {
	if err := a.scripts.SaveScript(script, content); err != nil {
		return err
	}
	if a.tracking != nil {
		if project := a.trackingProjectByID(script.ProjectID); project != nil {
			_ = a.tracking.TrackScriptSave(project, script, content)
		}
	}
	return nil
}
func (a *App) DeleteScript(projectID, connectionName, scriptID string) error {
	if err := a.scripts.DeleteScript(projectID, connectionName, scriptID); err != nil {
		return err
	}
	if a.tracking != nil {
		if project := a.trackingProjectByID(projectID); project != nil {
			_ = a.tracking.TrackScriptDelete(project, connectionName, scriptID)
		}
	}
	return nil
}

func (a *App) GetHistory() []models.HistoryEntry { return a.history.GetHistory() }
func (a *App) ClearHistory() error               { return a.history.ClearHistory() }

func (a *App) LoadTemplates() ([]models.Template, error) { return a.templates.LoadTemplates() }
func (a *App) SaveTemplate(t models.Template) error {
	if err := a.templates.SaveTemplate(t); err != nil {
		return err
	}
	if a.tracking != nil && a.project != nil {
		_ = a.tracking.TrackTemplateSave(a.project, t)
	}
	return nil
}
func (a *App) DeleteTemplate(id string) error {
	if err := a.templates.DeleteTemplate(id); err != nil {
		return err
	}
	if a.tracking != nil && a.project != nil {
		_ = a.tracking.TrackTemplateDelete(a.project, id)
	}
	return nil
}

func (a *App) FormatSQL(query string, dialect string) (string, error) {
	return a.formatter.FormatSQL(query, dialect)
}

func (a *App) GetBookmarks(connectionID, tabID string) ([]models.Bookmark, error) {
	return a.bookmarks.GetBookmarks(connectionID, tabID)
}

func (a *App) GetBookmarksByConnection(connectionID string) (map[string][]models.Bookmark, error) {
	return a.bookmarks.GetBookmarksByConnection(connectionID)
}

func (a *App) SaveBookmark(connectionID, tabID string, bookmark models.Bookmark) error {
	if err := a.bookmarks.SaveBookmark(connectionID, tabID, bookmark); err != nil {
		return err
	}
	if a.tracking != nil && a.project != nil {
		_ = a.tracking.TrackBookmarkSave(a.project, connectionID, tabID, bookmark)
	}
	return nil
}

func (a *App) DeleteBookmark(connectionID, tabID string, line int) error {
	if err := a.bookmarks.DeleteBookmark(connectionID, tabID, line); err != nil {
		return err
	}
	if a.tracking != nil && a.project != nil {
		_ = a.tracking.TrackBookmarkDelete(a.project, connectionID, tabID, line)
	}
	return nil
}

func (a *App) CompareQueries(query1, query2 string) (string, error) {
	return a.compare.CompareQueries(query1, query2)
}

func (a *App) GetPreferences() utils.Preferences { return a.prefs }
func (a *App) SetPreferences(p utils.Preferences) error {
	a.prefs = p
	return utils.SavePreferences(p)
}

func (a *App) ExportCSV(columns []string, rows [][]string) (string, error) {
	return exportCSV(a.ctx, columns, rows)
}

func (a *App) ExportJSON(columns []string, rows [][]string) (string, error) {
	return exportJSON(a.ctx, columns, rows)
}

func (a *App) ExportSQLInsert(columns []string, rows [][]string, tableName string) (string, error) {
	return exportSQLInsert(a.ctx, columns, rows, tableName)
}

func (a *App) ExportAllCSV(tabID string, selectedColumns []string) (string, error) {
	columns, rows, err := a.query.ExportAllRows(tabID)
	if err != nil {
		return "", err
	}
	filteredColumns, filteredRows, err := filterExportColumns(columns, rows, selectedColumns)
	if err != nil {
		return "", err
	}
	return exportCSV(a.ctx, filteredColumns, filteredRows)
}

func (a *App) ExportAllJSON(tabID string, selectedColumns []string) (string, error) {
	columns, rows, err := a.query.ExportAllRows(tabID)
	if err != nil {
		return "", err
	}
	filteredColumns, filteredRows, err := filterExportColumns(columns, rows, selectedColumns)
	if err != nil {
		return "", err
	}
	return exportJSON(a.ctx, filteredColumns, filteredRows)
}

func (a *App) ExportAllSQLInsert(tabID, tableName string, selectedColumns []string) (string, error) {
	columns, rows, err := a.query.ExportAllRows(tabID)
	if err != nil {
		return "", err
	}
	filteredColumns, filteredRows, err := filterExportColumns(columns, rows, selectedColumns)
	if err != nil {
		return "", err
	}
	return exportSQLInsert(a.ctx, filteredColumns, filteredRows, tableName)
}

// Version is set at build time via -ldflags "-X 'zentro/internal/app.Version=v0.2.0-beta'"
var Version = "v0.2.0-beta"

type AboutInfo struct {
	Version string `json:"version"`
	Commit  string `json:"commit"`
	Date    string `json:"date"`
	OS      string `json:"os"`
}

func (a *App) GetAboutInfo() AboutInfo {
	info := AboutInfo{
		Version: Version,
		Commit:  "unknown",
		Date:    "unknown",
		OS:      osArchLabel(),
	}

	buildInfo, ok := debug.ReadBuildInfo()
	if !ok {
		return info
	}

	for _, setting := range buildInfo.Settings {
		switch setting.Key {
		case "vcs.revision":
			if value := strings.TrimSpace(setting.Value); value != "" {
				info.Commit = value
			}
		case "vcs.time":
			if value := strings.TrimSpace(setting.Value); value != "" {
				if t, err := time.Parse(time.RFC3339, value); err == nil {
					info.Date = t.UTC().Format(time.RFC3339)
				} else {
					info.Date = value
				}
			}
		}
	}

	return info
}

func (a *App) GetCurrentVersion() string {
	return Version
}

func (a *App) CheckForUpdates() (*UpdateInfo, error) {
	return a.update.CheckForUpdates(a.GetCurrentVersion())
}

func (a *App) GetTableDDL(profileName, schema, tableName string) (string, error) {
	_ = profileName
	return GetTableDDLWithConnection(a.profile, a.db, schema, tableName)
}

func (a *App) DropObject(profileName, schema, objectName, objectType string) error {
	_ = profileName
	if err := a.ensureWritable("drop object"); err != nil {
		return err
	}
	return DropObjectWithConnection(a.profile, a.db, schema, objectName, objectType)
}

func (a *App) DropObjectAdvanced(profileName, schema, objectName, objectType string, cascade bool) error {
	_ = profileName
	if err := a.ensureWritable("drop object"); err != nil {
		return err
	}
	return DropObjectAdvancedWithConnection(a.profile, a.db, schema, objectName, objectType, cascade)
}

func (a *App) TruncateTable(profileName, schema, tableName string, cascade bool, restartIdentity bool) error {
	_ = profileName
	if err := a.ensureWritable("truncate table"); err != nil {
		return err
	}
	return TruncateTableWithConnection(a.profile, a.db, schema, tableName, cascade, restartIdentity)
}

func (a *App) CreateIndex(profileName, schema, tableName, indexName string, columns []string, unique bool) error {
	_ = profileName
	if err := a.ensureWritable("create index"); err != nil {
		return err
	}
	return CreateIndexWithConnection(a.profile, a.db, schema, tableName, indexName, columns, unique)
}

func (a *App) DropIndex(profileName, schema, tableName, indexName string) error {
	_ = profileName
	if err := a.ensureWritable("drop index"); err != nil {
		return err
	}
	return DropIndexWithConnection(a.profile, a.db, schema, tableName, indexName)
}

func (a *App) GetIndexes(profileName, schema, tableName string) ([]IndexInfo, error) {
	_ = profileName
	return GetIndexesWithConnection(a.profile, a.db, schema, tableName)
}

// ─── Check Constraints ────────────────────────────────────────────────────────

func (a *App) GetCheckConstraints(profileName, schema, tableName string) ([]CheckConstraintInfo, error) {
	_ = profileName
	return GetCheckConstraintsWithConnection(a.profile, a.db, schema, tableName)
}

func (a *App) CreateCheckConstraint(profileName, schema, tableName, name, expression string) error {
	_ = profileName
	if err := a.ensureWritable("create check constraint"); err != nil {
		return err
	}
	return CreateCheckConstraintWithConnection(a.profile, a.db, schema, tableName, name, expression)
}

func (a *App) DropCheckConstraint(profileName, schema, tableName, name string) error {
	_ = profileName
	if err := a.ensureWritable("drop check constraint"); err != nil {
		return err
	}
	return DropCheckConstraintWithConnection(a.profile, a.db, schema, tableName, name)
}

// ─── Unique Constraints ───────────────────────────────────────────────────────

func (a *App) GetUniqueConstraints(profileName, schema, tableName string) ([]UniqueConstraintInfo, error) {
	_ = profileName
	return GetUniqueConstraintsWithConnection(a.profile, a.db, schema, tableName)
}

func (a *App) CreateUniqueConstraint(profileName, schema, tableName, name string, columns []string) error {
	_ = profileName
	if err := a.ensureWritable("create unique constraint"); err != nil {
		return err
	}
	return CreateUniqueConstraintWithConnection(a.profile, a.db, schema, tableName, name, columns)
}

func (a *App) DropUniqueConstraint(profileName, schema, tableName, name string) error {
	_ = profileName
	if err := a.ensureWritable("drop unique constraint"); err != nil {
		return err
	}
	return DropUniqueConstraintWithConnection(a.profile, a.db, schema, tableName, name)
}

// ─── Primary Key ──────────────────────────────────────────────────────────────

func (a *App) GetPrimaryKey(profileName, schema, tableName string) (*PrimaryKeyInfo, error) {
	_ = profileName
	return GetPrimaryKeyWithConnection(a.profile, a.db, schema, tableName)
}

func (a *App) AddPrimaryKey(profileName, schema, tableName, name string, columns []string) error {
	_ = profileName
	if err := a.ensureWritable("add primary key"); err != nil {
		return err
	}
	return AddPrimaryKeyWithConnection(a.profile, a.db, schema, tableName, name, columns)
}

func (a *App) DropPrimaryKey(profileName, schema, tableName, name string) error {
	_ = profileName
	if err := a.ensureWritable("drop primary key"); err != nil {
		return err
	}
	return DropPrimaryKeyWithConnection(a.profile, a.db, schema, tableName, name)
}

func (a *App) GetForeignKeys(profileName, schema, tableName string) ([]ForeignKeyInfo, error) {
	_ = profileName
	return GetForeignKeysWithConnection(a.profile, a.db, schema, tableName)
}

func (a *App) CreateForeignKey(profileName, schema, tableName string, fk ForeignKeyInfo) error {
	_ = profileName
	if err := a.ensureWritable("create foreign key"); err != nil {
		return err
	}
	return CreateForeignKeyWithConnection(a.profile, a.db, schema, tableName, fk)
}

func (a *App) UpdateForeignKey(profileName, schema, tableName, originalName string, fk ForeignKeyInfo) error {
	_ = profileName
	if err := a.ensureWritable("update foreign key"); err != nil {
		return err
	}
	return UpdateForeignKeyWithConnection(a.profile, a.db, schema, tableName, originalName, fk)
}

func (a *App) DropForeignKey(profileName, schema, tableName, constraintName string) error {
	_ = profileName
	if err := a.ensureWritable("drop foreign key"); err != nil {
		return err
	}
	return DropForeignKeyWithConnection(a.profile, a.db, schema, tableName, constraintName)
}

func (a *App) CreateTable(profileName, schema, tableName string, columns []models.ColumnDef) error {
	_ = profileName
	if err := a.ensureWritable("create table"); err != nil {
		return err
	}
	return CreateTableWithConnection(a.profile, a.db, schema, tableName, columns)
}
