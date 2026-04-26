package app

import (
	"database/sql"
	"fmt"
	"strconv"
	"strings"

	"zentro/internal/models"
)

func (a *App) ensureWritable(op string) error {
	if a.prefs.ViewMode {
		return fmt.Errorf("view mode is enabled: %s is blocked", op)
	}
	return nil
}

func (a *App) currentProjectEnvironmentKey() models.EnvironmentKey {
	if a.project == nil {
		return ""
	}
	if a.currentEnvironmentKey != "" {
		return a.currentEnvironmentKey
	}
	if a.project.DefaultEnvironmentKey != "" {
		return a.project.DefaultEnvironmentKey
	}
	if len(a.project.Environments) > 0 {
		return a.project.Environments[0].Key
	}
	return ""
}

func (a *App) currentProjectSchema() string {
	if a.project == nil {
		return ""
	}
	activeKey := a.currentProjectEnvironmentKey()
	for i := range a.project.Environments {
		environment := a.project.Environments[i]
		if environment.Key == activeKey {
			return strings.TrimSpace(environment.LastSchema)
		}
	}
	return ""
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

func (a *App) bindTrackingProject(project *models.Project) {
	if a.tracking == nil || project == nil {
		return
	}
	if err := a.tracking.BindProject(project); err != nil && a.logger != nil {
		a.logger.Warn("tracking bind project failed", "project_id", project.ID, "err", err)
	}
}

func (a *App) trackingProjectByID(projectID string) *models.Project {
	if projectID == "" {
		return a.project
	}
	if a.project != nil && a.project.ID == projectID {
		return a.project
	}
	if a.projects == nil {
		return nil
	}
	project, err := a.projects.GetProject(projectID)
	if err != nil {
		return nil
	}
	return project
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
