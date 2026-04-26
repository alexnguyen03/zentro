import { wailsGateway } from '../platform/app-api/wailsGateway';
import type { GitCommitFileDiff, GitCommitResult, GitTimelineItem, GitTrackingStatus } from '../platform/app-api/types';

export const EnableGitTracking = () => wailsGateway.EnableGitTracking();
export const DisableGitTracking = () => wailsGateway.DisableGitTracking();
export const GetGitTrackingStatus = (): Promise<GitTrackingStatus> => wailsGateway.GetGitTrackingStatus();
export const ListGitTimeline = (limit = 100, eventType = ''): Promise<GitTimelineItem[]> =>
    wailsGateway.ListGitTimeline(limit, eventType);
export const GetGitCommitDiff = (commitHash: string) => wailsGateway.GetGitCommitDiff(commitHash);
export const GetCommitFileDiffs = (commitHash: string): Promise<GitCommitFileDiff[]> => wailsGateway.GetCommitFileDiffs(commitHash);
export const ManualGitCommit = (message = ''): Promise<GitCommitResult> => wailsGateway.ManualGitCommit(message);
export const GetGitPendingChanges = (): Promise<string[]> => wailsGateway.GetGitPendingChanges();
export const RestoreGitCommit = (commitHash: string): Promise<void> => wailsGateway.RestoreGitCommit(commitHash);
export const SnapshotStoredProcedures = (schema = '') => wailsGateway.SnapshotStoredProcedures(schema);
export const RunGitTrackingMigration = () => wailsGateway.RunGitTrackingMigration();
