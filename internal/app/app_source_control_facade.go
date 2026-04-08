package app

import "fmt"

func (a *App) scRepoPath() (string, error) {
	if a.project == nil {
		return "", fmt.Errorf("no active project")
	}
	if a.project.GitRepoPath == "" {
		return "", fmt.Errorf("source control: git repo path not configured for this project")
	}
	return a.project.GitRepoPath, nil
}

func (a *App) SCGetStatus() (SCStatus, error) {
	path, err := a.scRepoPath()
	if err != nil {
		return SCStatus{}, err
	}
	return a.sc.GetStatus(path)
}

func (a *App) SCStageFile(filePath string) error {
	path, err := a.scRepoPath()
	if err != nil {
		return err
	}
	return a.sc.StageFile(path, filePath)
}

func (a *App) SCUnstageFile(filePath string) error {
	path, err := a.scRepoPath()
	if err != nil {
		return err
	}
	return a.sc.UnstageFile(path, filePath)
}

func (a *App) SCStageAll() error {
	path, err := a.scRepoPath()
	if err != nil {
		return err
	}
	return a.sc.StageAll(path)
}

func (a *App) SCCommit(message string) (string, error) {
	path, err := a.scRepoPath()
	if err != nil {
		return "", err
	}
	return a.sc.Commit(path, message)
}

func (a *App) SCGetHistory(limit int) ([]SCCommit, error) {
	path, err := a.scRepoPath()
	if err != nil {
		return nil, err
	}
	return a.sc.GetHistory(path, limit)
}

func (a *App) SCGetFileDiffs(hash string) ([]GitCommitFileDiff, error) {
	path, err := a.scRepoPath()
	if err != nil {
		return nil, err
	}
	return a.sc.GetFileDiffs(path, hash)
}

func (a *App) SCGetWorkingFileDiff(filePath string, staged bool) (GitCommitFileDiff, error) {
	path, err := a.scRepoPath()
	if err != nil {
		return GitCommitFileDiff{}, err
	}
	return a.sc.GetWorkingFileDiff(path, filePath, staged)
}

func (a *App) SCInitRepo() error {
	path, err := a.scRepoPath()
	if err != nil {
		return err
	}
	return a.sc.InitRepo(path)
}
