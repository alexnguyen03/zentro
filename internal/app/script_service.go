package app

import (
	"log/slog"
	"zentro/internal/models"
	"zentro/internal/utils"
)

type ScriptService struct {
	logger *slog.Logger
}

func NewScriptService(logger *slog.Logger) *ScriptService {
	return &ScriptService{
		logger: logger,
	}
}

func (s *ScriptService) GetScripts(projectID, connectionName string) ([]models.SavedScript, error) {
	return utils.LoadScripts(projectID, connectionName)
}

func (s *ScriptService) GetScriptContent(projectID, connectionName, scriptID string) (string, error) {
	return utils.GetScriptContent(projectID, connectionName, scriptID)
}

func (s *ScriptService) SaveScript(script models.SavedScript, content string) error {
	s.logger.Info("saving script", "project", script.ProjectID, "connection", script.ConnectionName, "name", script.Name, "id", script.ID)
	return utils.SaveScript(script, content)
}

func (s *ScriptService) DeleteScript(projectID, connectionName, scriptID string) error {
	s.logger.Info("deleting script", "project", projectID, "connection", connectionName, "id", scriptID)
	return utils.DeleteScript(projectID, connectionName, scriptID)
}
