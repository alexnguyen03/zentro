/**
 * constants.ts — Global constants for the frontend application.
 */

export const STORAGE_KEY = {
    EDITOR_SESSION: 'zentro:editor-session-v4',
    CONNECTION_STORE: 'zentro:connection-store-v2',
    PROJECT_STORE: 'zentro:project-store-v2',
    LAYOUT_STORE: 'zentro:layout-store-v2',
    DISMISSED_UPDATE_VERSION: 'zentro:dismissed-update-version-v2',
} as const;

export const DOM_EVENT = {
    OPEN_WORKSPACE_MODAL: 'open-workspace-modal',
    OPEN_PROJECT_HUB: 'open-project-hub',
    OPEN_CONTEXT_SEARCH: 'open-context-search',
    OPEN_ENVIRONMENT_SWITCHER: 'open-environment-switcher',
    CLOSE_ACTIVE_TAB: 'close-active-tab',
    RUN_QUERY_ACTION: 'run-query-action',
    RUN_EXPLAIN_ACTION: 'run-explain-action',
    FORMAT_QUERY_ACTION: 'format-query-action',
    TOGGLE_BOOKMARK_ACTION: 'toggle-bookmark-action',
    NEXT_BOOKMARK_ACTION: 'next-bookmark-action',
    OPEN_QUERY_COMPARE: 'open-query-compare',
    JUMP_TO_LINE_ACTION: 'jump-to-line-action',
    SAVE_TAB_ACTION: 'zentro:save-script',
    RENAME_TAB: 'zentro:rename-tab',
} as const;

export const TAB_TYPE = {
    QUERY: 'query',
    TABLE: 'table',
    SETTINGS: 'settings',
    SHORTCUTS: 'shortcuts',
} as const;
export type TabType = typeof TAB_TYPE[keyof typeof TAB_TYPE];

export const CONNECTION_STATUS = {
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',
    FAILED: 'failed',
    ERROR: 'error',
    CONNECTING: 'connecting',
} as const;
export type ConnectionStatus = typeof CONNECTION_STATUS[keyof typeof CONNECTION_STATUS];

export const DRIVER = {
    POSTGRES: 'postgres',
    SQLSERVER: 'sqlserver',
    MYSQL: 'mysql',
    SQLITE: 'sqlite',
} as const;
export type DriverType = typeof DRIVER[keyof typeof DRIVER];

// ── Environment ───────────────────────────────────────────────────────────────

export const ENVIRONMENT_KEY = {
    LOCAL: 'loc',
    TESTING: 'tes',
    DEVELOPMENT: 'dev',
    STAGING: 'sta',
    PRODUCTION: 'pro',
} as const;
export type EnvironmentKey = typeof ENVIRONMENT_KEY[keyof typeof ENVIRONMENT_KEY];

// ── Transaction ───────────────────────────────────────────────────────────────

export const TRANSACTION_STATUS = {
    NONE: 'none',
    ACTIVE: 'active',
    ERROR: 'error',
} as const;
export type TransactionStatus = typeof TRANSACTION_STATUS[keyof typeof TRANSACTION_STATUS];

// ── Result/Tab generated kind ─────────────────────────────────────────────────

export const GENERATED_KIND = {
    RESULT: 'result',
    EXPLAIN: 'explain',
} as const;
export type GeneratedKind = typeof GENERATED_KIND[keyof typeof GENERATED_KIND];

// ── Project asset types ───────────────────────────────────────────────────────

export const ASSET_TYPE = {
    SAVED_QUERY: 'saved_query',
    SAVED_WORKSPACE: 'saved_workspace',
    TEMPLATE: 'template',
    FAVORITE_OBJECT: 'favorite_object',
    RESULT_SNAPSHOT: 'result_snapshot',
} as const;
export type AssetType = typeof ASSET_TYPE[keyof typeof ASSET_TYPE];

// ── Workspace types ───────────────────────────────────────────────────────────

export const WORKSPACE_TYPE = {
    SCRATCH: 'scratch',
    ANALYSIS: 'analysis',
    INSPECTION: 'inspection',
} as const;
export type WorkspaceType = typeof WORKSPACE_TYPE[keyof typeof WORKSPACE_TYPE];
