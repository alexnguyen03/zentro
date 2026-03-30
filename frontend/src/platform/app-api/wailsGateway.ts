import {
    AddTableColumn,
    AlterTableColumn,
    BeginTransaction,
    CancelQuery,
    CheckForUpdates,
    ClearHistory,
    CommitTransaction,
    CompareQueries,
    Connect,
    ConnectProjectEnvironment,
    CreateIndex,
    CreateProject,
    CreateTable,
    DeleteBookmark,
    DeleteProject,
    DeleteScript,
    DeleteTemplate,
    Disconnect,
    DropIndex,
    DropObject,
    DropTableColumn,
    ExecuteQuery,
    ExecuteUpdateSync,
    ExplainQuery,
    ExportCSV,
    ExportConnectionPackage,
    ExportJSON,
    ExportSQLInsert,
    FetchDatabaseSchema,
    FetchMoreRows,
    FetchTableColumns,
    FetchTableRelationships,
    FetchTotalRowCount,
    ForceQuit,
    FormatSQL,
    GetBookmarks,
    GetConnectionStatus,
    GetActiveProject,
    GetDefaultProjectStorageRoot,
    GetHistory,
    GetIndexes,
    GetPreferences,
    GetProject,
    GetScriptContent,
    GetScripts,
    GetTableDDL,
    GetTransactionStatus,
    ImportConnectionPackage,
    ListProjects,
    LoadConnections,
    LoadDatabasesForProfile,
    LoadTemplates,
    OpenProject,
    OpenProjectFromDirectory,
    PickDirectory,
    Reconnect,
    RollbackTransaction,
    SaveBookmark,
    SaveConnection,
    SaveProject,
    SaveScript,
    SaveTemplate,
    SetPreferences,
    SwitchDatabase,
    TestConnection,
} from '../../../wailsjs/go/app/App';
import type { AppApiGateway, ConnectionRuntimeState } from './types';
import type { ConnectionProfile } from '../../types/connection';
import { CONNECTION_STATUS } from '../../lib/constants';

function normalizeRuntimeConnectionStatus(status: unknown): ConnectionRuntimeState['status'] {
    if (status === CONNECTION_STATUS.CONNECTED || status === CONNECTION_STATUS.CONNECTING || status === CONNECTION_STATUS.DISCONNECTED || status === CONNECTION_STATUS.ERROR) {
        return status as ConnectionRuntimeState['status'];
    }
    return CONNECTION_STATUS.DISCONNECTED;
}

function toConnectionProfile(raw: unknown): ConnectionProfile | null {
    if (!raw || typeof raw !== 'object') return null;
    const source = raw as Record<string, unknown>;

    if (typeof source.name !== 'string' || typeof source.driver !== 'string') {
        return null;
    }

    return {
        name: source.name,
        driver: source.driver,
        host: typeof source.host === 'string' ? source.host : '',
        port: typeof source.port === 'number' ? source.port : 0,
        db_name: typeof source.db_name === 'string' ? source.db_name : '',
        username: typeof source.username === 'string' ? source.username : '',
        password: typeof source.password === 'string' ? source.password : '',
        ssl_mode: typeof source.ssl_mode === 'string' ? source.ssl_mode : '',
        connect_timeout: typeof source.connect_timeout === 'number' ? source.connect_timeout : 10,
        save_password: source.save_password === true,
        encrypt_password: source.encrypt_password === true,
        show_all_schemas: source.show_all_schemas === true,
        trust_server_cert: source.trust_server_cert === true,
    };
}

function toConnectionRuntimeState(raw: unknown): ConnectionRuntimeState {
    if (!raw || typeof raw !== 'object') {
        return { status: CONNECTION_STATUS.DISCONNECTED, profile: null };
    }
    const source = raw as Record<string, unknown>;

    return {
        status: normalizeRuntimeConnectionStatus(source.status),
        profile: toConnectionProfile(source.profile),
    };
}

export const wailsGateway: AppApiGateway = {
    Connect,
    Disconnect,
    Reconnect,
    SwitchDatabase,
    LoadConnections,
    LoadDatabasesForProfile,
    SaveConnection,
    ImportConnectionPackage,
    ExportConnectionPackage,
    TestConnection,
    GetConnectionStatus: async () => toConnectionRuntimeState(await GetConnectionStatus()),

    ExecuteQuery,
    CancelQuery,
    ExplainQuery,
    ExecuteUpdateSync,
    FetchMoreRows,
    FetchTotalRowCount,
    FormatSQL,
    CompareQueries,
    ExportCSV,
    ExportJSON,
    ExportSQLInsert,

    BeginTransaction,
    CommitTransaction,
    RollbackTransaction,
    GetTransactionStatus,

    FetchDatabaseSchema,
    FetchTableColumns,
    FetchTableRelationships,
    CreateTable,
    DropObject,
    GetTableDDL,
    AlterTableColumn,
    AddTableColumn,
    DropTableColumn,
    GetIndexes,
    CreateIndex,
    DropIndex,

    GetPreferences,
    SetPreferences,
    CheckForUpdates,

    GetHistory,
    ClearHistory,
    LoadTemplates,
    SaveTemplate,
    DeleteTemplate,
    GetScripts,
    GetScriptContent,
    SaveScript,
    DeleteScript,
    GetBookmarks,
    SaveBookmark,
    DeleteBookmark,

    ForceQuit,
    ConnectProjectEnvironment,

    ListProjects,
    GetProject,
    CreateProject,
    SaveProject,
    DeleteProject,
    OpenProject,
    OpenProjectFromDirectory,
    GetDefaultProjectStorageRoot,
    PickDirectory,
    GetActiveProject,
};
