/**
 * Global constants for the frontend application.
 */

export const STORAGE_KEY = {
    EDITOR_SESSION:                       'zentro:editor-session',
    PROJECT_STORE:                        'zentro:project-store',
    LAYOUT_STORE:                         'zentro:layout-store',
    SIDEBAR_UI:                           'zentro:sidebar-ui',
    CONNECTION_TREE_UI:                   'zentro:connection-tree-ui',
    DISMISSED_UPDATE_VERSION:             'zentro:dismissed-update-version',
    TELEMETRY_CONSENT:                    'zentro:telemetry-consent',
    QUERY_PERFORMANCE_SNAPSHOTS:          'zentro:query-performance-snapshots',
    TELEMETRY_EVENTS:                     'zentro:telemetry-events',
    TELEMETRY_ANALYTICS_OUTBOX:           'zentro:telemetry-analytics-outbox',
    EXECUTION_POLICY_PROFILES:            'zentro:execution-policy-profiles',
    EXECUTION_POLICY_ASSIGNMENTS:         'zentro:execution-policy-assignments',
    EXECUTION_POLICY_STRONG_CONFIRM_FROM: 'zentro:execution-policy-strong-confirm-from',
} as const;

export const DOM_EVENT = {
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
    OPEN_TABLE_EXPORT: 'open-table-export',
    OPEN_RESULT_EXPORT: 'open-result-export',
    JUMP_TO_LINE_ACTION: 'jump-to-line-action',
    SAVE_TAB_ACTION: 'zentro:save-script',
    RENAME_TAB: 'zentro:rename-tab',
} as const;

export type ProjectHubSurface = 'entry' | 'wizard';
export type ProjectWizardMode = 'create' | 'edit';
export type ProjectHubLaunchContext = 'default' | 'env-config';

export interface ProjectHubLaunchIntent {
    surface?: ProjectHubSurface;
    wizardMode?: ProjectWizardMode;
    projectId?: string;
    initialEnvironmentKey?: EnvironmentKey;
    launchContext?: ProjectHubLaunchContext;
}

export const TAB_TYPE = {
    QUERY: 'query',
    TABLE: 'table',
    SETTINGS: 'settings',
    SHORTCUTS: 'shortcuts',
    GIT_DIFF: 'git_diff',
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

export const ENVIRONMENT_KEY = {
    LOCAL: 'loc',
    TESTING: 'tes',
    DEVELOPMENT: 'dev',
    STAGING: 'sta',
    PRODUCTION: 'pro',
} as const;
export type EnvironmentKey = typeof ENVIRONMENT_KEY[keyof typeof ENVIRONMENT_KEY];

export const TRANSACTION_STATUS = {
    NONE: 'none',
    ACTIVE: 'active',
    ERROR: 'error',
} as const;
export type TransactionStatus = typeof TRANSACTION_STATUS[keyof typeof TRANSACTION_STATUS];

export const GENERATED_KIND = {
    RESULT: 'result',
    EXPLAIN: 'explain',
} as const;
export type GeneratedKind = typeof GENERATED_KIND[keyof typeof GENERATED_KIND];

export const ASSET_TYPE = {
    SAVED_QUERY: 'saved_query',
    TEMPLATE: 'template',
    FAVORITE_OBJECT: 'favorite_object',
    RESULT_SNAPSHOT: 'result_snapshot',
} as const;
export type AssetType = typeof ASSET_TYPE[keyof typeof ASSET_TYPE];
