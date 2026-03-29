package app

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"zentro/internal/models"
)

type ConnectionPackage struct {
	Version    string                   `json:"version"`
	Connection models.ConnectionProfile `json:"connection"`
}

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
		if err := a.conn.ConnectWithProfile(projectConnectionToProfile(pc)); err != nil {
			return err
		}
		if pc.EnvironmentKey != "" {
			a.currentEnvironmentKey = pc.EnvironmentKey
		}
		return nil
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
			if err := a.conn.ConnectWithProfile(projectConnectionToProfile(&a.project.Connections[i])); err != nil {
				return err
			}
			a.currentEnvironmentKey = targetKey
			return nil
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

func (a *App) ImportConnectionPackage() (*models.ConnectionProfile, error) {
	filePath, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Import Connection Package",
		Filters: []runtime.FileFilter{
			{DisplayName: "JSON Files (*.json)", Pattern: "*.json"},
		},
	})
	if err != nil {
		return nil, err
	}
	if filePath == "" {
		return nil, nil
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("import connection package: read file: %w", err)
	}

	var pkg ConnectionPackage
	if err := json.Unmarshal(data, &pkg); err != nil {
		return nil, fmt.Errorf("import connection package: invalid json: %w", err)
	}
	if strings.TrimSpace(pkg.Connection.Name) == "" {
		return nil, fmt.Errorf("import connection package: connection name is required")
	}

	pkg.Connection.Password = ""
	pkg.Connection.SavePassword = false
	pkg.Connection.EncryptPassword = false

	if err := a.SaveConnection(pkg.Connection); err != nil {
		return nil, err
	}
	imported := pkg.Connection
	return &imported, nil
}

func (a *App) ExportConnectionPackage(environmentKey string) (string, error) {
	var profile *models.ConnectionProfile

	if a.project != nil {
		targetEnvironment := models.EnvironmentKey(strings.TrimSpace(environmentKey))
		if targetEnvironment == "" {
			targetEnvironment = a.currentProjectEnvironmentKey()
		}

		for i := range a.project.Connections {
			connection := &a.project.Connections[i]
			if connection.EnvironmentKey == targetEnvironment {
				profile = projectConnectionToProfile(connection)
				break
			}
		}
	}

	if profile == nil && a.profile != nil {
		profile = cloneConnectionProfile(a.profile)
	}

	if profile == nil {
		return "", fmt.Errorf("no connection available to export")
	}

	exportProfile := *profile
	exportProfile.Password = ""
	exportProfile.SavePassword = false
	exportProfile.EncryptPassword = false

	defaultFilename := strings.TrimSpace(exportProfile.Name)
	if defaultFilename == "" {
		defaultFilename = "connection"
	}
	defaultFilename = strings.ReplaceAll(defaultFilename, " ", "-")

	filePath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Export Connection Package",
		DefaultFilename: defaultFilename + ".connection.json",
		Filters: []runtime.FileFilter{
			{DisplayName: "JSON Files (*.json)", Pattern: "*.json"},
		},
	})
	if err != nil {
		return "", err
	}
	if filePath == "" {
		return "", nil
	}

	pkg := ConnectionPackage{
		Version:    "v1",
		Connection: exportProfile,
	}
	content, err := json.MarshalIndent(pkg, "", "  ")
	if err != nil {
		return "", err
	}
	if filepath.Ext(filePath) == "" {
		filePath += ".json"
	}
	if err := os.WriteFile(filePath, content, 0o644); err != nil {
		return "", err
	}
	return filePath, nil
}
