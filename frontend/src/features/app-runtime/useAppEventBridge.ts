import { useEffect } from 'react';
import {
    onConnectionChanged,
    onQueryChunk,
    onQueryDone,
    onQueryStarted,
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
import { GetTransactionStatus } from '../../services/queryService';
import { appLogger } from '../../lib/logger';
import type { ConnectionProfile } from '../../types/connection';

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

export function useAppEventBridge(toast: { error: (message: string) => void }) {
    const {
        setIsConnected,
        setActiveProfile,
        setDatabases,
        setConnectionStatus,
    } = useConnectionStore();
    const { setTransactionStatus } = useStatusStore();

    useEffect(() => {
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
                toast.error(`Failed to load schema for ${data.dbName}: ${data.error}`);
            }),
            onQueryStarted((payload) => {
                if (payload.statementIndex === 0) {
                    clearGeneratedResults(payload.sourceTabID);
                }

                useEditorStore.getState().setTabRunning(payload.sourceTabID, true);
                useResultStore.getState().initTab(payload.tabID);
                useLayoutStore.getState().setShowResultPanel(true);

                const executedText = payload.statementText || payload.query;
                if (executedText && !executedText.includes('_zentro_filter')) {
                    useResultStore.getState().setLastExecutedQuery(payload.tabID, executedText);
                }
            }),
            onQueryChunk((payload) => {
                useResultStore.getState().appendRows(payload.tabID, payload.columns, payload.rows, payload.tableName, payload.primaryKeys);
            }),
            onQueryDone((payload) => {
                if (payload.statementCount <= 1 || payload.statementIndex === payload.statementCount - 1 || Boolean(payload.error)) {
                    useEditorStore.getState().setTabRunning(payload.sourceTabID, false);
                }
                useResultStore.getState().setDone(payload.tabID, payload.affected, payload.duration, payload.isSelect, payload.hasMore, payload.error);
                if (payload.error) {
                    toast.error(`Query failed: ${payload.error}`);
                }

                const currentResults = useResultStore.getState().results;
                const rowCount = payload.isSelect
                    ? (currentResults[payload.tabID]?.rows.length ?? payload.affected)
                    : payload.affected;
                useStatusStore.getState().setQueryStats(Number(rowCount), payload.duration);
            }),
            onTransactionStatus((payload) => {
                setTransactionStatus(payload.status as any, payload.error || null);
                if (payload.status === TRANSACTION_STATUS.ERROR && payload.error) {
                    toast.error(`Transaction failed: ${payload.error}`);
                }
            }),
        ];

        return () => subs.forEach((unsub) => unsub());
    }, [setActiveProfile, setConnectionStatus, setDatabases, setIsConnected, setTransactionStatus, toast]);
}

