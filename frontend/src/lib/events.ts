/**
 * events.ts — Typed Wails event constants and listener helpers.
 * All frontend event subscriptions should go through this file
 * to avoid string typos and untyped callbacks.
 */
import { EventsOn } from '../../wailsjs/runtime/runtime';

// ── Event name constants ──────────────────────────────────────────────────

export const EVENT = {
    CONNECTION_CHANGED: 'connection:changed',
    SCHEMA_DATABASES: 'schema:databases',
    SCHEMA_LOADED: 'schema:loaded',
    QUERY_STARTED: 'query:started',
    QUERY_CHUNK: 'query:chunk',
    QUERY_DONE: 'query:done',
} as const;

// ── Payload types ─────────────────────────────────────────────────────────

export interface ConnectionChangedPayload {
    status: 'connected' | 'disconnected';
    profile?: {
        name: string;
        driver: string;
        host: string;
        port: number;
        username: string;
        db_name: string;
        ssl_mode: string;
    };
}

export interface SchemaDatabasesPayload {
    profileName: string;
    databases: string[];
}

export interface SchemaNode {
    Name: string;
    Tables: string[];
    Views: string[];
}

export interface SchemaLoadedPayload {
    profileName: string;
    dbName: string;
    schemas: SchemaNode[];
}

export interface QueryStartedPayload {
    tabID: string;
}

export interface QueryChunkPayload {
    tabID: string;
    columns?: string[];
    rows: string[][];
    seq: number;
    tableName?: string;
    primaryKeys?: string[];
}

export interface QueryDonePayload {
    tabID: string;
    affected: number;
    duration: number;
    isSelect: boolean;
    hasMore: boolean;
    error?: string;
}

// ── Typed listener factories ───────────────────────────────────────────────

export type Unsubscribe = () => void;

export function onConnectionChanged(cb: (data: ConnectionChangedPayload) => void): Unsubscribe {
    return EventsOn(EVENT.CONNECTION_CHANGED, cb);
}

export function onSchemaDatabases(cb: (data: SchemaDatabasesPayload) => void): Unsubscribe {
    return EventsOn(EVENT.SCHEMA_DATABASES, cb);
}

export function onSchemaLoaded(cb: (data: SchemaLoadedPayload) => void): Unsubscribe {
    return EventsOn(EVENT.SCHEMA_LOADED, cb);
}

export function onQueryStarted(cb: (data: QueryStartedPayload) => void): Unsubscribe {
    return EventsOn(EVENT.QUERY_STARTED, cb);
}

export function onQueryChunk(cb: (data: QueryChunkPayload) => void): Unsubscribe {
    return EventsOn(EVENT.QUERY_CHUNK, cb);
}

export function onQueryDone(cb: (data: QueryDonePayload) => void): Unsubscribe {
    return EventsOn(EVENT.QUERY_DONE, cb);
}
