package app

import (
	"fmt"
	"strings"

	"zentro/internal/constant"
)

func (a *App) EnableGitTracking() error {
	if a.project == nil {
		return fmt.Errorf("no active project")
	}
	if a.tracking == nil {
		return fmt.Errorf("tracking service unavailable")
	}
	return a.tracking.Enable(a.project)
}

func (a *App) DisableGitTracking() error {
	if a.project == nil {
		return fmt.Errorf("no active project")
	}
	if a.tracking == nil {
		return fmt.Errorf("tracking service unavailable")
	}
	return a.tracking.Disable(a.project)
}

func (a *App) GetGitTrackingStatus() (GitTrackingStatus, error) {
	if a.project == nil {
		return GitTrackingStatus{Enabled: false, Initialized: false}, nil
	}
	if a.tracking == nil {
		return GitTrackingStatus{}, fmt.Errorf("tracking service unavailable")
	}
	return a.tracking.GetStatus(a.project)
}

func (a *App) ListGitTimeline(limit int, eventType string) ([]GitTimelineItem, error) {
	if a.project == nil {
		return []GitTimelineItem{}, nil
	}
	if a.tracking == nil {
		return nil, fmt.Errorf("tracking service unavailable")
	}
	return a.tracking.ListTimeline(a.project, limit, eventType)
}

func (a *App) GetGitCommitDiff(commitHash string) (string, error) {
	if a.project == nil {
		return "", fmt.Errorf("no active project")
	}
	if a.tracking == nil {
		return "", fmt.Errorf("tracking service unavailable")
	}
	return a.tracking.GetCommitDiff(a.project, commitHash)
}

func (a *App) ManualGitCommit(message string) (GitCommitResult, error) {
	if a.project == nil {
		return GitCommitResult{}, fmt.Errorf("no active project")
	}
	if a.tracking == nil {
		return GitCommitResult{}, fmt.Errorf("tracking service unavailable")
	}
	return a.tracking.ManualCommit(a.project, message)
}

func (a *App) GetCommitFileDiffs(commitHash string) ([]GitCommitFileDiff, error) {
	if a.project == nil {
		return nil, fmt.Errorf("no active project")
	}
	if a.tracking == nil {
		return nil, fmt.Errorf("tracking service unavailable")
	}
	return a.tracking.GetCommitFileDiffs(a.project, commitHash)
}

func (a *App) RestoreGitCommit(commitHash string) error {
	if a.project == nil {
		return fmt.Errorf("no active project")
	}
	if a.tracking == nil {
		return fmt.Errorf("tracking service unavailable")
	}
	return a.tracking.RestoreCommit(a.project, commitHash)
}

func (a *App) GetGitPendingChanges() ([]string, error) {
	if a.project == nil {
		return []string{}, nil
	}
	if a.tracking == nil {
		return nil, fmt.Errorf("tracking service unavailable")
	}
	return a.tracking.GetPendingChanges(a.project)
}

func (a *App) RunGitTrackingMigration() error {
	if a.project == nil {
		return fmt.Errorf("no active project")
	}
	if a.tracking == nil {
		return fmt.Errorf("tracking service unavailable")
	}
	return a.tracking.RunMigration(a.project)
}

func (a *App) SnapshotStoredProcedures(schema string) (int, error) {
	return a.snapshotStoredProcedures(schema)
}

func (a *App) snapshotStoredProcedures(schema string) (int, error) {
	if a.project == nil || a.tracking == nil {
		return 0, nil
	}
	if a.profile == nil || a.db == nil {
		return 0, fmt.Errorf("no active connection")
	}
	if strings.ToLower(a.profile.Driver) != constant.DriverPostgres {
		return 0, fmt.Errorf("stored procedure snapshot is only supported for postgres in v1")
	}

	snapshots, err := fetchPostgresRoutineSnapshots(a.db, schema)
	if err != nil {
		return 0, err
	}
	if len(snapshots) == 0 {
		return 0, nil
	}
	if err := a.tracking.TrackStoredProcedureSnapshot(a.project, snapshots); err != nil {
		return 0, err
	}
	return len(snapshots), nil
}
