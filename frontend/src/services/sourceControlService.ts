import { wailsGateway } from '../platform/app-api/wailsGateway';
import type { GitCommitFileDiff, SCCommit as SCCommitType, SCStatus } from '../platform/app-api/types';

export const SCGetStatus = (): Promise<SCStatus> => wailsGateway.SCGetStatus();
export const SCStageFile = (filePath: string): Promise<void> => wailsGateway.SCStageFile(filePath);
export const SCUnstageFile = (filePath: string): Promise<void> => wailsGateway.SCUnstageFile(filePath);
export const SCStageAll = (): Promise<void> => wailsGateway.SCStageAll();
export const SCCommit = (message: string): Promise<string> => wailsGateway.SCCommit(message);
export const SCGetHistory = (limit = 100): Promise<SCCommitType[]> => wailsGateway.SCGetHistory(limit);
export const SCGetFileDiffs = (hash: string): Promise<GitCommitFileDiff[]> => wailsGateway.SCGetFileDiffs(hash);
export const SCGetWorkingFileDiff = (filePath: string, staged: boolean): Promise<GitCommitFileDiff> =>
    wailsGateway.SCGetWorkingFileDiff(filePath, staged);
export const SCListBranches = (): Promise<string[]> => wailsGateway.SCListBranches();
export const SCCheckoutBranch = (branchName: string): Promise<void> => wailsGateway.SCCheckoutBranch(branchName);
export const SCCreateBranch = (branchName: string): Promise<void> => wailsGateway.SCCreateBranch(branchName);
export const SCCreateBranchFrom = (branchName: string, fromRef: string): Promise<void> => wailsGateway.SCCreateBranchFrom(branchName, fromRef);
export const SCCheckoutDetached = (ref: string): Promise<void> => wailsGateway.SCCheckoutDetached(ref);
export const SCInitRepo = (): Promise<void> => wailsGateway.SCInitRepo();
