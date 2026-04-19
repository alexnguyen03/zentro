import type { app, models, utils } from '../../../wailsjs/go/models';
import type { ConnectionProfile } from '../../types/connection';
import { CONNECTION_STATUS } from '../../lib/constants';
import type { LicenseState } from '../../features/license/types';
import type { PluginContribution } from '../../features/plugin/contracts';
import type { ExecutionPolicy } from '../../features/query/runtime';

export type RuntimeConnectionStatus = typeof CONNECTION_STATUS[keyof typeof CONNECTION_STATUS];

export interface ConnectionRuntimeState {
    status: RuntimeConnectionStatus;
    profile?: ConnectionProfile | null;
}

export interface GitTrackingStatus {
    enabled: boolean;
    initialized: boolean;
    repo_path?: string;
    project_id?: string;
    last_commit_hash?: string;
    last_error?: string;
    pending_count?: number;
}

export interface GitTimelineItem {
    hash: string;
    message: string;
    event_type: string;
    author: string;
    when: string;
    files: string[];
}

export interface GitCommitFileDiff {
    path: string;
    before: string;
    after: string;
}

export interface SCFileStatus {
    path: string;
    staged: boolean;
    status: 'modified' | 'added' | 'deleted' | 'untracked';
}

export interface SCStatus {
    branch: string;
    files: SCFileStatus[];
    clean: boolean;
}

export interface SCCommit {
    hash: string;
    message: string;
    author: string;
    when: string;
}

export interface GitCommitResult {
    hash?: string;
    message: string;
    files: string[];
    created_at: string;
    no_changes: boolean;
}

export interface AppApiGateway {
    // Connection
    Connect(database: string): Promise<void>;
    Disconnect(): Promise<void>;
    Reconnect(): Promise<void>;
    SwitchDatabase(database: string): Promise<void>;
    LoadConnections(): Promise<models.ConnectionProfile[]>;
    LoadDatabasesForProfile(profileName: string): Promise<string[]>;
    SaveConnection(profile: models.ConnectionProfile): Promise<void>;
    DeleteConnection(name: string): Promise<void>;
    ImportConnectionPackage(): Promise<models.ConnectionProfile | null>;
    ExportConnectionPackage(environmentKey: string): Promise<string>;
    TestConnection(profile: models.ConnectionProfile): Promise<void>;
    GetConnectionStatus(): Promise<ConnectionRuntimeState>;

    // Query & execution
    ExecuteQuery(tabId: string, query: string): Promise<void>;
    CancelQuery(tabId: string): Promise<void>;
    ExplainQuery(tabId: string, query: string, analyze: boolean): Promise<void>;
    ExecuteUpdateSync(sql: string): Promise<number>;
    FetchMoreRows(tabId: string, offset: number): Promise<void>;
    FormatSQL(query: string, driver: string): Promise<string>;
    CompareQueries(original: string, modified: string): Promise<string>;
    ExportCSV(columns: string[], rows: unknown[]): Promise<string>;
    ExportAllCSV(tabId: string, selectedColumns: string[]): Promise<string>;
    ExportJSON(columns: string[], rows: unknown[]): Promise<string>;
    ExportAllJSON(tabId: string, selectedColumns: string[]): Promise<string>;
    ExportSQLInsert(columns: string[], rows: unknown[], tableName: string): Promise<string>;
    ExportAllSQLInsert(tabId: string, tableName: string, selectedColumns: string[]): Promise<string>;

    // Transaction
    BeginTransaction(): Promise<void>;
    CommitTransaction(): Promise<void>;
    RollbackTransaction(): Promise<void>;
    GetTransactionStatus(): Promise<string>;

    // Schema & table ops
    FetchDatabaseSchema(profileName: string, dbName: string): Promise<void>;
    FetchTableColumns(schema: string, table: string): Promise<models.ColumnDef[]>;
    FetchTableRelationships(schema: string, table: string): Promise<models.TableRelationship[]>;
    CreateTable(profileName: string, schema: string, tableName: string, columns: models.ColumnDef[]): Promise<void>;
    DropObject(profileName: string, schema: string, objectName: string, objectType: string): Promise<void>;
    DropObjectAdvanced(profileName: string, schema: string, objectName: string, objectType: string, cascade: boolean): Promise<void>;
    TruncateTable(profileName: string, schema: string, tableName: string, cascade: boolean, restartIdentity: boolean): Promise<void>;
    GetTableDDL(profileName: string, schema: string, tableName: string): Promise<string>;
    AlterTableColumn(profileName: string, schema: string, current: models.ColumnDef, next: models.ColumnDef): Promise<void>;
    AddTableColumn(profileName: string, schema: string, col: models.ColumnDef): Promise<void>;
    DropTableColumn(profileName: string, schema: string, columnName: string): Promise<void>;
    GetIndexes(profileName: string, schema: string, table: string): Promise<app.IndexInfo[]>;
    CreateIndex(profileName: string, schema: string, table: string, indexName: string, columns: string[], unique: boolean): Promise<void>;
    DropIndex(profileName: string, schema: string, tableName: string, indexName: string): Promise<void>;
    GetCheckConstraints(profileName: string, schema: string, table: string): Promise<app.CheckConstraintInfo[]>;
    CreateCheckConstraint(profileName: string, schema: string, table: string, name: string, expression: string): Promise<void>;
    DropCheckConstraint(profileName: string, schema: string, table: string, name: string): Promise<void>;
    GetUniqueConstraints(profileName: string, schema: string, table: string): Promise<app.UniqueConstraintInfo[]>;
    CreateUniqueConstraint(profileName: string, schema: string, table: string, name: string, columns: string[]): Promise<void>;
    DropUniqueConstraint(profileName: string, schema: string, table: string, name: string): Promise<void>;
    GetPrimaryKey(profileName: string, schema: string, table: string): Promise<app.PrimaryKeyInfo | null>;
    AddPrimaryKey(profileName: string, schema: string, table: string, name: string, columns: string[]): Promise<void>;
    DropPrimaryKey(profileName: string, schema: string, table: string, name: string): Promise<void>;
    GetForeignKeys(profileName: string, schema: string, table: string): Promise<app.ForeignKeyInfo[]>;
    CreateForeignKey(profileName: string, schema: string, table: string, fk: app.ForeignKeyInfo): Promise<void>;
    UpdateForeignKey(profileName: string, schema: string, table: string, originalName: string, fk: app.ForeignKeyInfo): Promise<void>;
    DropForeignKey(profileName: string, schema: string, table: string, name: string): Promise<void>;

    // Settings & updates
    GetPreferences(): Promise<utils.Preferences>;
    SetPreferences(preferences: utils.Preferences): Promise<void>;
    CheckForUpdates(): Promise<app.UpdateInfo>;
    GetAboutInfo(): Promise<app.AboutInfo>;

    // History / templates / scripts / bookmarks
    GetHistory(): Promise<models.HistoryEntry[]>;
    ClearHistory(): Promise<void>;
    LoadTemplates(): Promise<models.Template[]>;
    SaveTemplate(template: models.Template): Promise<void>;
    DeleteTemplate(templateId: string): Promise<void>;
    GetScripts(projectId: string, connectionName: string): Promise<models.SavedScript[]>;
    GetScriptContent(projectId: string, connectionName: string, scriptId: string): Promise<string>;
    SaveScript(script: models.SavedScript, content: string): Promise<void>;
    DeleteScript(projectId: string, connectionName: string, scriptId: string): Promise<void>;
    GetBookmarks(profileName: string, dbName: string): Promise<models.Bookmark[]>;
    GetBookmarksByConnection(connectionID: string): Promise<Record<string, models.Bookmark[]>>;
    SaveBookmark(profileName: string, dbName: string, bookmark: models.Bookmark): Promise<void>;
    DeleteBookmark(profileName: string, dbName: string, lineNumber: number): Promise<void>;
    EnableGitTracking(): Promise<void>;
    DisableGitTracking(): Promise<void>;
    GetGitTrackingStatus(): Promise<GitTrackingStatus>;
    ListGitTimeline(limit: number, eventType: string): Promise<GitTimelineItem[]>;
    GetGitCommitDiff(commitHash: string): Promise<string>;
    GetCommitFileDiffs(commitHash: string): Promise<GitCommitFileDiff[]>;
    ManualGitCommit(message: string): Promise<GitCommitResult>;
    GetGitPendingChanges(): Promise<string[]>;
    RestoreGitCommit(commitHash: string): Promise<void>;
    SnapshotStoredProcedures(schema: string): Promise<number>;
    RunGitTrackingMigration(): Promise<void>;

    // Source Control (user repo)
    SCGetStatus(): Promise<SCStatus>;
    SCStageFile(filePath: string): Promise<void>;
    SCUnstageFile(filePath: string): Promise<void>;
    SCStageAll(): Promise<void>;
    SCCommit(message: string): Promise<string>;
    SCGetHistory(limit: number): Promise<SCCommit[]>;
    SCGetFileDiffs(hash: string): Promise<GitCommitFileDiff[]>;
    SCGetWorkingFileDiff(filePath: string, staged: boolean): Promise<GitCommitFileDiff>;
    SCListBranches(): Promise<string[]>;
    SCCheckoutBranch(branchName: string): Promise<void>;
    SCCreateBranch(branchName: string): Promise<void>;
    SCCreateBranchFrom(branchName: string, fromRef: string): Promise<void>;
    SCCheckoutDetached(ref: string): Promise<void>;
    SCInitRepo(): Promise<void>;
    SCReadGitIgnore(): Promise<string>;
    SCWriteGitIgnore(content: string): Promise<void>;

    // App-level lifecycle
    ForceQuit(): Promise<void>;
    ConnectProjectEnvironment(environmentKey: string): Promise<void>;

    // Project
    ListProjects(): Promise<models.Project[]>;
    GetProject(projectId: string): Promise<models.Project>;
    CreateProject(project: models.Project): Promise<models.Project>;
    SaveProject(project: models.Project): Promise<models.Project>;
    DeleteProject(projectId: string): Promise<void>;
    OpenProject(projectId: string): Promise<models.Project>;
    OpenDirectoryInExplorer(path: string): Promise<void>;
    OpenProjectFromDirectory(directoryPath: string): Promise<models.Project>;
    GetDefaultProjectStorageRoot(): Promise<string>;
    PickDirectory(initialPath: string): Promise<string>;
    GetActiveProject(): Promise<models.Project>;

    // Extensions / license architecture
    ActivateLicense?(key: string, deviceInfo: string): Promise<LicenseState>;
    RefreshLicense?(sessionToken: string): Promise<LicenseState>;
    DeactivateLicense?(reason: string): Promise<void>;
    GetLicenseState?(): Promise<LicenseState>;
    RegisterPluginContribution?(contribution: PluginContribution): Promise<void>;
    ListPluginByCapability?(capability: string): Promise<PluginContribution[]>;
    GetExecutionPolicy?(environmentKey: string): Promise<ExecutionPolicy>;
}

export interface ServiceError {
    code: string;
    message: string;
    cause?: unknown;
}

export type ServiceResult<T> =
    | { ok: true; data: T }
    | { ok: false; error: ServiceError };

export function toServiceError(code: string, message: string, cause?: unknown): ServiceError {
    return { code, message, cause };
}

export async function toServiceResult<T>(
    code: string,
    message: string,
    runner: () => Promise<T>,
): Promise<ServiceResult<T>> {
    try {
        const data = await runner();
        return { ok: true, data };
    } catch (cause) {
        return {
            ok: false,
            error: toServiceError(code, message, cause),
        };
    }
}
