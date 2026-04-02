package app

import (
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
	return a.scripts.SaveScript(script, content)
}
func (a *App) DeleteScript(projectID, connectionName, scriptID string) error {
	return a.scripts.DeleteScript(projectID, connectionName, scriptID)
}

func (a *App) GetHistory() []models.HistoryEntry { return a.history.GetHistory() }
func (a *App) ClearHistory() error               { return a.history.ClearHistory() }

func (a *App) LoadTemplates() ([]models.Template, error) { return a.templates.LoadTemplates() }
func (a *App) SaveTemplate(t models.Template) error      { return a.templates.SaveTemplate(t) }
func (a *App) DeleteTemplate(id string) error            { return a.templates.DeleteTemplate(id) }

func (a *App) FormatSQL(query string, dialect string) (string, error) {
	return a.formatter.FormatSQL(query, dialect)
}

func (a *App) GetBookmarks(connectionID, tabID string) ([]models.Bookmark, error) {
	return a.bookmarks.GetBookmarks(connectionID, tabID)
}

func (a *App) SaveBookmark(connectionID, tabID string, bookmark models.Bookmark) error {
	return a.bookmarks.SaveBookmark(connectionID, tabID, bookmark)
}

func (a *App) DeleteBookmark(connectionID, tabID string, line int) error {
	return a.bookmarks.DeleteBookmark(connectionID, tabID, line)
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

func (a *App) CreateIndex(profileName, schema, tableName, indexName string, columns []string, unique bool) error {
	_ = profileName
	if err := a.ensureWritable("create index"); err != nil {
		return err
	}
	return CreateIndexWithConnection(a.profile, a.db, schema, tableName, indexName, columns, unique)
}

func (a *App) DropIndex(profileName, schema, indexName string) error {
	_ = profileName
	if err := a.ensureWritable("drop index"); err != nil {
		return err
	}
	return DropIndexWithConnection(a.profile, a.db, schema, indexName)
}

func (a *App) GetIndexes(profileName, schema, tableName string) ([]IndexInfo, error) {
	_ = profileName
	return GetIndexesWithConnection(a.profile, a.db, schema, tableName)
}

func (a *App) CreateTable(profileName, schema, tableName string, columns []models.ColumnDef) error {
	_ = profileName
	if err := a.ensureWritable("create table"); err != nil {
		return err
	}
	return CreateTableWithConnection(a.profile, a.db, schema, tableName, columns)
}
