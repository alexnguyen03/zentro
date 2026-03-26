import type { app, models, utils } from '../../../wailsjs/go/models';
import type { ConnectionProfile } from '../../types/connection';

export type RuntimeConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

export interface ConnectionRuntimeState {
    status: RuntimeConnectionStatus;
    profile?: ConnectionProfile | null;
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
    TestConnection(profile: models.ConnectionProfile): Promise<void>;
    GetConnectionStatus(): Promise<ConnectionRuntimeState>;

    // Query & execution
    ExecuteQuery(tabId: string, query: string): Promise<void>;
    CancelQuery(tabId: string): Promise<void>;
    ExplainQuery(tabId: string, query: string, analyze: boolean): Promise<void>;
    ExecuteUpdateSync(sql: string): Promise<number>;
    FetchMoreRows(tabId: string, offset: number): Promise<void>;
    FetchTotalRowCount(tabId: string): Promise<number>;
    FormatSQL(query: string, driver: string): Promise<string>;
    CompareQueries(original: string, modified: string): Promise<string>;
    ExportCSV(columns: string[], rows: unknown[]): Promise<string>;
    ExportJSON(columns: string[], rows: unknown[]): Promise<string>;
    ExportSQLInsert(columns: string[], rows: unknown[], tableName: string): Promise<string>;

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
    GetTableDDL(profileName: string, schema: string, tableName: string): Promise<string>;
    AlterTableColumn(profileName: string, schema: string, current: models.ColumnDef, next: models.ColumnDef): Promise<void>;
    AddTableColumn(profileName: string, schema: string, col: models.ColumnDef): Promise<void>;
    DropTableColumn(profileName: string, schema: string, columnName: string): Promise<void>;
    GetIndexes(profileName: string, schema: string, table: string): Promise<app.IndexInfo[]>;
    CreateIndex(profileName: string, schema: string, table: string, indexName: string, columns: string[], unique: boolean): Promise<void>;
    DropIndex(profileName: string, schema: string, indexName: string): Promise<void>;

    // Settings & updates
    GetPreferences(): Promise<utils.Preferences>;
    SetPreferences(preferences: utils.Preferences): Promise<void>;
    CheckForUpdates(): Promise<app.UpdateInfo>;

    // History / templates / scripts / bookmarks
    GetHistory(): Promise<models.HistoryEntry[]>;
    ClearHistory(): Promise<void>;
    LoadTemplates(): Promise<models.Template[]>;
    SaveTemplate(template: models.Template): Promise<void>;
    DeleteTemplate(templateId: string): Promise<void>;
    GetScripts(connectionName: string): Promise<models.SavedScript[]>;
    GetScriptContent(connectionName: string, scriptId: string): Promise<string>;
    SaveScript(script: models.SavedScript, content: string): Promise<void>;
    DeleteScript(connectionName: string, scriptId: string): Promise<void>;
    GetBookmarks(profileName: string, dbName: string): Promise<models.Bookmark[]>;
    SaveBookmark(profileName: string, dbName: string, bookmark: models.Bookmark): Promise<void>;
    DeleteBookmark(profileName: string, dbName: string, lineNumber: number): Promise<void>;

    // App-level lifecycle
    ForceQuit(): Promise<void>;
    ConnectProjectEnvironment(environmentKey: string): Promise<void>;
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
