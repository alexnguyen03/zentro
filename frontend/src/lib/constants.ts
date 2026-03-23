/**
 * constants.ts — Global constants for the frontend application.
 */

export const STORAGE_KEY = {
    EDITOR_SESSION: 'zentro:editor-session-v2',
    CONNECTION_STORE: 'zentro:connection-store',
    PROJECT_STORE: 'zentro:project-store',
    DISMISSED_UPDATE_VERSION: 'zentro:dismissed-update-version',
} as const;

export const DOM_EVENT = {
    OPEN_WORKSPACE_MODAL: 'open-workspace-modal',
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
