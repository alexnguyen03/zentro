import { useEffect } from 'react';
import {
    onConnectionChanged,
    onQueryChunk,
    onQueryDone,
    onQueryStarted,
    onSchemaLoaded,
    onSchemaDatabases,
    onSchemaError,
    onTransactionStatus,
    type ConnectionChangedPayload,
} from '../../lib/events';
import { CONNECTION_STATUS, TRANSACTION_STATUS } from '../../lib/constants';
import { useConnectionStore } from '../../stores/connectionStore';
import { useStatusStore } from '../../stores/statusStore';
import { useResultStore } from '../../stores/resultStore';
import { useEditorStore } from '../../stores/editorStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { useSchemaStore } from '../../stores/schemaStore';
import { GetTransactionStatus } from '../../services/queryService';
import { appLogger } from '../../lib/logger';
import type { ConnectionProfile } from '../../types/connection';
import { classifyQueryFailure } from '../query/runtime';
import { getTelemetryConsent } from '../telemetry/consent';
import { queueTelemetryAnalytics, saveQuerySnapshot, toTelemetryEvent } from '../telemetry/localMetricsStore';

function normalizeTransactionStatus(value: string): typeof TRANSACTION_STATUS[keyof typeof TRANSACTION_STATUS] {
    if (value === TRANSACTION_STATUS.ACTIVE || value === TRANSACTION_STATUS.ERROR) return value as any;
    return TRANSACTION_STATUS.NONE;
}

function toConnectionProfile(profile: ConnectionChangedPayload['profile']): ConnectionProfile {
    return profile as ConnectionProfile;
}

function clearGeneratedResults(sourceTabID: string) {
    const resultState = useResultStore.getState();
    Object.keys(resultState.results).forEach((k) => {
        if (
            k !== sourceTabID &&
            (k.startsWith(`${sourceTabID}::result:`) || k.startsWith(`${sourceTabID}::explain:`))
        ) {
            resultState.clearResult(k);
        }
    });
}

function recordTelemetryEvent(event: string, payload: Record<string, unknown>) {
    toTelemetryEvent(event, payload);
    queueTelemetryAnalytics(event, payload, getTelemetryConsent());
}

export function useAppEventBridge(toast: { error: (message: string) => void }) {
    const {
        setIsConnected,
        setActiveProfile,
        setDatabases,
        setConnectionStatus,
    } = useConnectionStore();
    const { setTransactionStatus } = useStatusStore();

    useEffect(() => {
        const chunkBuffers = new Map<string, {
            columns?: string[];
            rows: string[][];
            tableName?: string;
            primaryKeys?: string[];
        }>();
        let flushHandle: number | null = null;

        const flushChunks = () => {
            for (const [tabId, chunk] of chunkBuffers.entries()) {
                useResultStore.getState().appendRows(tabId, chunk.columns, chunk.rows, chunk.tableName, chunk.primaryKeys);
                useResultStore.getState().touchProgress(tabId, chunk.rows.length);
                if (chunk.rows.length > 0) {
                    useResultStore.getState().markFirstRow(tabId);
                }
            }
            chunkBuffers.clear();
            flushHandle = null;
        };

        const scheduleFlush = () => {
            if (flushHandle !== null) return;
            flushHandle = window.requestAnimationFrame(flushChunks);
        };

        const subs = [
            onConnectionChanged((data: ConnectionChangedPayload) => {
                appLogger.info('connection changed', data);
                if (data.status === CONNECTION_STATUS.CONNECTED && data.profile) {
                    setIsConnected(true);
                    setConnectionStatus(CONNECTION_STATUS.CONNECTED);
                    setActiveProfile(toConnectionProfile(data.profile));
                    setDatabases(data.databases ?? []);
                    GetTransactionStatus()
                        .then((status) => setTransactionStatus(normalizeTransactionStatus(status)))
                        .catch(() => setTransactionStatus(TRANSACTION_STATUS.NONE));
                } else if (data.status === CONNECTION_STATUS.CONNECTING && data.profile) {
                    setConnectionStatus(CONNECTION_STATUS.CONNECTING);
                    setActiveProfile(toConnectionProfile(data.profile));
                } else if (data.status === CONNECTION_STATUS.DISCONNECTED) {
                    setIsConnected(false);
                    setConnectionStatus(CONNECTION_STATUS.DISCONNECTED);
                    setActiveProfile(null);
                    setDatabases([]);
                    setTransactionStatus(TRANSACTION_STATUS.NONE);
                } else if (data.status === CONNECTION_STATUS.ERROR) {
                    if (data.profile) {
                        setActiveProfile(toConnectionProfile(data.profile));
                    }
                    setConnectionStatus(CONNECTION_STATUS.ERROR);
                    setIsConnected(false);
                    setTransactionStatus(TRANSACTION_STATUS.ERROR, 'connection error');
                    toast.error('Connection failed or lost. Please check your settings.');
                } else {
                    toast.error('Connection failed');
                }
            }),
            onSchemaDatabases((data) => {
                appLogger.info('schema databases', data);
                setDatabases(data.databases ?? []);
            }),
            onSchemaError((data) => {
                appLogger.warn('schema error', data);
                useSchemaStore.getState().setLoading(data.profileName, data.dbName, false);
                toast.error(`Failed to load schema for ${data.dbName}: ${data.error}`);
            }),
            onSchemaLoaded((data) => {
                useSchemaStore.getState().setTree(data.profileName, data.dbName, data.schemas);
            }),
            onQueryStarted((payload) => {
                if (payload.statementIndex === 0) {
                    clearGeneratedResults(payload.sourceTabID);
                }

                useEditorStore.getState().setTabRunning(payload.sourceTabID, true);
                useResultStore.getState().initTab(payload.tabID);
                useResultStore.getState().setExecutionState(payload.tabID, 'running');
                useLayoutStore.getState().setShowResultPanel(true);
                useStatusStore.getState().setQueryRuntime('running');

                const executedText = payload.statementText || payload.query;
                if (executedText) {
                    useResultStore.getState().setLastExecutedQuery(payload.tabID, executedText);
                }

                // Derive a stable, human-readable label for multi-statement runs.
                if (payload.statementText && payload.statementCount > 1) {
                    const normalized = payload.statementText
                        .replace(/\s+/g, ' ')
                        .replace(/;+\s*$/, '')
                        .trim();
                    const statementNo = payload.statementIndex + 1;
                    const preview = normalized.length > 56 ? `${normalized.slice(0, 56).trimEnd()}...` : normalized;
                    const label = `#${statementNo} ${preview || `Statement ${statementNo}`}`;
                    useResultStore.getState().setStatementLabel(payload.tabID, label);
                }
                recordTelemetryEvent('query.started', {
                    tabId: payload.tabID,
                    sourceTabId: payload.sourceTabID,
                    statementIndex: payload.statementIndex,
                    statementCount: payload.statementCount,
                });
            }),
            onQueryChunk((payload) => {
                const current = chunkBuffers.get(payload.tabID);
                if (!current) {
                    chunkBuffers.set(payload.tabID, {
                        columns: payload.columns,
                        rows: [...payload.rows],
                        tableName: payload.tableName,
                        primaryKeys: payload.primaryKeys,
                    });
                } else {
                    current.rows.push(...payload.rows);
                    if (!current.columns && payload.columns?.length) current.columns = payload.columns;
                    if (!current.tableName && payload.tableName) current.tableName = payload.tableName;
                    if (!current.primaryKeys && payload.primaryKeys) current.primaryKeys = payload.primaryKeys;
                }

                const pending = chunkBuffers.get(payload.tabID);
                if ((pending?.rows.length ?? 0) > 5000) {
                    flushChunks();
                } else {
                    scheduleFlush();
                }
            }),
            onQueryDone((payload) => {
                if (chunkBuffers.has(payload.tabID)) {
                    flushChunks();
                }
                if (payload.statementCount <= 1 || payload.statementIndex === payload.statementCount - 1 || Boolean(payload.error)) {
                    useEditorStore.getState().setTabRunning(payload.sourceTabID, false);
                }
                useResultStore.getState().setDone(payload.tabID, payload.affected, payload.duration, payload.isSelect, payload.hasMore, payload.error);
                const failureCode = classifyQueryFailure(payload.error);
                useResultStore.getState().setExecutionState(
                    payload.tabID,
                    failureCode === 'none' ? 'done' : (failureCode === 'cancelled' ? 'cancelled' : 'failed'),
                    failureCode,
                );

                const tabResult = useResultStore.getState().results[payload.tabID];
                const firstRowLatencyMs = tabResult?.progress.firstRowAt
                    ? tabResult.progress.firstRowAt - tabResult.progress.startedAt
                    : null;
                useStatusStore.getState().setQueryRuntime(
                    failureCode === 'none' ? 'done' : (failureCode === 'cancelled' ? 'cancelled' : 'failed'),
                    failureCode,
                    firstRowLatencyMs,
                );

                saveQuerySnapshot({
                    tabId: payload.tabID,
                    sourceTabId: payload.sourceTabID,
                    startedAt: tabResult?.progress.startedAt ?? Date.now(),
                    firstRowLatencyMs: firstRowLatencyMs ?? undefined,
                    totalDurationMs: payload.duration,
                    rowsReceived: tabResult?.progress.rowsReceived ?? 0,
                    failureCode,
                });

                if (payload.error) {
                    toast.error(`Query failed: ${payload.error}`);
                }

                const currentResults = useResultStore.getState().results;
                const rowCount = payload.isSelect
                    ? (currentResults[payload.tabID]?.rows.length ?? payload.affected)
                    : payload.affected;
                recordTelemetryEvent('query.done', {
                    tabId: payload.tabID,
                    sourceTabId: payload.sourceTabID,
                    durationMs: payload.duration,
                    rowCount,
                    failureCode,
                });
                useStatusStore.getState().setQueryStats(Number(rowCount), payload.duration);
                if (currentResults[payload.tabID]?.wasRowCapApplied) {
                    toast.error('Result row cap reached. Showing truncated rows for smooth UI.');
                }
            }),
            onTransactionStatus((payload) => {
                setTransactionStatus(payload.status as any, payload.error || null);
                if (payload.status === TRANSACTION_STATUS.ERROR && payload.error) {
                    toast.error(`Transaction failed: ${payload.error}`);
                }
            }),
        ];

        return () => {
            if (flushHandle !== null) {
                window.cancelAnimationFrame(flushHandle);
            }
            subs.forEach((unsub) => unsub());
        };
    }, [setActiveProfile, setConnectionStatus, setDatabases, setIsConnected, setTransactionStatus, toast]);
}

