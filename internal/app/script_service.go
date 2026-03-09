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

func (s *ScriptService) GetScripts(connectionName string) ([]models.SavedScript, error) {
	return utils.LoadScripts(connectionName)
}

func (s *ScriptService) GetScriptContent(connectionName, scriptID string) (string, error) {
	return utils.GetScriptContent(connectionName, scriptID)
}

func (s *ScriptService) SaveScript(script models.SavedScript, content string) error {
	s.logger.Info("saving script", "connection", script.ConnectionName, "name", script.Name, "id", script.ID)
	return utils.SaveScript(script, content)
}

func (s *ScriptService) DeleteScript(connectionName, scriptID string) error {
	s.logger.Info("deleting script", "connection", connectionName, "id", scriptID)
	return utils.DeleteScript(connectionName, scriptID)
}
