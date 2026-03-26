/**
 * events.ts — Typed Wails event constants and listener helpers.
 * All frontend event subscriptions should go through this file
 * to avoid string typos and untyped callbacks.
 */
import { EventsOn } from '../../wailsjs/runtime/runtime';
import { ConnectionStatus } from './constants';
import type { ConnectionProfile } from '../types/connection';

// ── Event name constants ──────────────────────────────────────────────────

export const EVENT = {
    CONNECTION_CHANGED: 'connection:changed',
    SCHEMA_DATABASES: 'schema:databases',
    SCHEMA_LOADED: 'schema:loaded',
    SCHEMA_ERROR: 'schema:error',
    QUERY_STARTED: 'query:started',
    QUERY_CHUNK: 'query:chunk',
    QUERY_DONE: 'query:done',
    TRANSACTION_STATUS: 'transaction:status',
} as const;

// ── Payload types ─────────────────────────────────────────────────────────

export interface ConnectionChangedPayload {
    status: ConnectionStatus;
    databases?: string[];
    profile?: ConnectionProfile;
}

export interface SchemaDatabasesPayload {
    profileName: string;
    databases: string[];
}

export interface SchemaNode {
    Name: string;
    Tables: string[];
    ForeignTables?: string[];
    Views: string[];
    MaterializedViews?: string[];
    Indexes?: string[];
    Functions?: string[];
    Sequences?: string[];
    DataTypes?: string[];
    AggregateFunctions?: string[];
}

export interface SchemaLoadedPayload {
    profileName: string;
    dbName: string;
    schemas: SchemaNode[];
}

export interface SchemaErrorPayload {
    profileName: string;
    dbName: string;
    error: string;
}

export interface QueryStartedPayload {
    tabID: string;
    sourceTabID: string;
    query: string;
    statementText: string;
    statementIndex: number;
    statementCount: number;
}

export interface QueryChunkPayload {
    tabID: string;
    sourceTabID: string;
    columns?: string[];
    rows: string[][];
    seq: number;
    tableName?: string;
    primaryKeys?: string[];
    statementText: string;
    statementIndex: number;
    statementCount: number;
}

export interface QueryDonePayload {
    tabID: string;
    sourceTabID: string;
    affected: number;
    duration: number;
    isSelect: boolean;
    hasMore: boolean;
    error?: string;
    statementText: string;
    statementIndex: number;
    statementCount: number;
}

export interface TransactionStatusPayload {
    status: 'none' | 'active' | 'error';
    error?: string;
    driver?: string;
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

export function onSchemaError(cb: (data: SchemaErrorPayload) => void): Unsubscribe {
    return EventsOn(EVENT.SCHEMA_ERROR, cb);
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

export function onTransactionStatus(cb: (data: TransactionStatusPayload) => void): Unsubscribe {
    return EventsOn(EVENT.TRANSACTION_STATUS, cb);
}
