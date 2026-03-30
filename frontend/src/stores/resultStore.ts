import { create } from 'zustand';
import { DraftRow } from '../lib/dataEditing';
import { withStoreLogger } from './logger';
import type { QueryExecutionState, QueryFailureCode, QueryProgress } from '../features/query/runtime';

export interface TabResult {
    columns: string[];
    columnTypes?: string[];
    rows: string[][];
    isDone: boolean;
    affected: number;
    duration: number;
    error?: string;
    isSelect: boolean;
    hasMore: boolean;
    offset: number;
    isFetchingMore: boolean;
    tableName?: string;
    primaryKeys?: string[];
    filterExpr: string;
    lastExecutedQuery?: string;
    pendingEdits?: Map<string, string>;
    pendingDeletions?: Set<number>;
    pendingDraftRows?: DraftRow[];
    executionState: QueryExecutionState;
    failureCode: QueryFailureCode;
    progress: QueryProgress;
    cappedRows: number;
    wasRowCapApplied: boolean;
}

type ProjectResultBucket = Record<string, TabResult>;

interface ResultState {
    projectResults: Record<string, ProjectResultBucket>;
    activeProjectId: string | null;
    results: ProjectResultBucket;

    switchProject: (projectId: string | null) => void;
    clearProject: (projectId?: string | null) => void;
    initTab: (tabId: string) => void;
    appendRows: (
        tabId: string,
        columns: string[] | undefined,
        rows: string[][],
        tableName?: string,
        primaryKeys?: string[]
    ) => void;
    setDone: (tabId: string, affected: number, duration: number, isSelect: boolean, hasMore: boolean, error?: string) => void;
    setOffset: (tabId: string, offset: number) => void;
    clearResult: (tabId: string) => void;
    isDone: (tabId: string) => boolean;
    applyEdits: (tabId: string, edits: Map<string, string>, deletedRows?: Set<number>) => void;
    appendInsertedRows: (tabId: string, rows: string[][]) => void;
    setFilterExpr: (tabId: string, filterExpr: string) => void;
    setLastExecutedQuery: (tabId: string, query: string) => void;
    updatePendingState: (tabId: string, editedCells: Map<string, string>, deletedRows: Set<number>, draftRows: DraftRow[]) => void;
    setExecutionState: (tabId: string, state: QueryExecutionState, failureCode?: QueryFailureCode) => void;
    markFirstRow: (tabId: string) => void;
    touchProgress: (tabId: string, appendedRows: number) => void;
}

const DEFAULT_WORKSPACE_ID = '__default__';

const createEmptyBucket = (): ProjectResultBucket => ({});

const getProjectId = (projectId?: string | null) => projectId || DEFAULT_WORKSPACE_ID;

function getActiveBucket(state: Pick<ResultState, 'projectResults' | 'activeProjectId'>) {
    return state.projectResults[getProjectId(state.activeProjectId)] || createEmptyBucket();
}

function updateActiveBucket(
    state: ResultState,
    updater: (bucket: ProjectResultBucket) => ProjectResultBucket
) {
    const projectId = getProjectId(state.activeProjectId);
    const nextBucket = updater(getActiveBucket(state));

    return {
        projectResults: {
            ...state.projectResults,
            [projectId]: nextBucket,
        },
        results: nextBucket,
    };
}

export const useResultStore = create<ResultState>(withStoreLogger('resultStore', (set, get) => ({
    projectResults: {
        [DEFAULT_WORKSPACE_ID]: createEmptyBucket(),
    },
    activeProjectId: DEFAULT_WORKSPACE_ID,
    results: {},

    switchProject: (projectId) => set((state) => {
        const nextProjectId = getProjectId(projectId);
        const results = state.projectResults[nextProjectId] || createEmptyBucket();

        return {
            projectResults: {
                ...state.projectResults,
                [nextProjectId]: results,
            },
            activeProjectId: nextProjectId,
            results,
        };
    }),

    clearProject: (projectId) => set((state) => {
        const nextProjectId = getProjectId(projectId || state.activeProjectId);
        const projectResults = {
            ...state.projectResults,
            [nextProjectId]: createEmptyBucket(),
        };
        const isActive = nextProjectId === getProjectId(state.activeProjectId);

        return {
            projectResults,
            ...(isActive ? { results: projectResults[nextProjectId] } : {}),
        };
    }),

    initTab: (tabId) => set((state) => updateActiveBucket(state, (bucket) => {
        const prev = bucket[tabId];
        return {
            ...bucket,
            [tabId]: {
                columns: prev?.columns || [],
                rows: prev?.rows || [],
                isDone: false,
                affected: 0,
                duration: 0,
                isSelect: true,
                error: undefined,
                hasMore: true,
                offset: 0,
                isFetchingMore: false,
                tableName: prev?.tableName,
                primaryKeys: prev?.primaryKeys,
                filterExpr: prev?.filterExpr || '',
                lastExecutedQuery: prev?.lastExecutedQuery,
                pendingEdits: prev?.pendingEdits || new Map(),
                pendingDeletions: prev?.pendingDeletions || new Set(),
                pendingDraftRows: [],
                executionState: 'queued',
                failureCode: 'none',
                progress: {
                    startedAt: Date.now(),
                    rowsReceived: 0,
                    chunksReceived: 0,
                },
                cappedRows: 0,
                wasRowCapApplied: false,
            },
        };
    })),

    appendRows: (tabId, columns, rows, tableName, primaryKeys) => set((state) => updateActiveBucket(state, (bucket) => {
        const prev = bucket[tabId];
        if (!prev) return bucket;

        const isFirstChunk = columns !== undefined && columns.length > 0;
        const mergedRows = isFirstChunk ? rows : [...prev.rows, ...rows];
        const cap = prev.cappedRows > 0 ? prev.cappedRows : 100000;
        const nextRows = mergedRows.length > cap ? mergedRows.slice(0, cap) : mergedRows;
        const capApplied = mergedRows.length > cap;

        return {
            ...bucket,
            [tabId]: {
                ...prev,
                columns: columns || prev.columns,
                rows: nextRows,
                tableName: tableName || prev.tableName,
                primaryKeys: primaryKeys || prev.primaryKeys,
                wasRowCapApplied: capApplied || prev.wasRowCapApplied,
            },
        };
    })),

    setDone: (tabId, affected, duration, isSelect, hasMore, error) => set((state) => updateActiveBucket(state, (bucket) => {
        const prev = bucket[tabId];
        if (!prev) return bucket;

        return {
            ...bucket,
            [tabId]: {
                ...prev,
                isDone: true,
                affected: isSelect ? prev.rows.length : affected,
                duration,
                isSelect,
                error,
                hasMore,
                isFetchingMore: false,
                rows: isSelect ? prev.rows : [],
                columns: isSelect ? prev.columns : [],
                executionState: error
                    ? (String(error).toLowerCase().includes('cancel') ? 'cancelled' : 'failed')
                    : 'done',
            },
        };
    })),

    setOffset: (tabId, offset) => set((state) => updateActiveBucket(state, (bucket) => {
        const prev = bucket[tabId];
        if (!prev) return bucket;

        return {
            ...bucket,
            [tabId]: {
                ...prev,
                offset,
                isFetchingMore: true,
            },
        };
    })),

    clearResult: (tabId) => set((state) => updateActiveBucket(state, (bucket) => {
        const nextBucket = { ...bucket };
        delete nextBucket[tabId];
        return nextBucket;
    })),

    applyEdits: (tabId, edits, deletedRows) => set((state) => updateActiveBucket(state, (bucket) => {
        const prev = bucket[tabId];
        if (!prev) return bucket;

        let rows = [...prev.rows];
        edits.forEach((value, cellId) => {
            const [rowIndex, columnIndex] = cellId.split(':').map(Number);
            if (!rows[rowIndex]) return;

            const nextRow = [...rows[rowIndex]];
            nextRow[columnIndex] = value;
            rows[rowIndex] = nextRow;
        });

        if (deletedRows && deletedRows.size > 0) {
            rows = rows.filter((_, index) => !deletedRows.has(index));
        }

        return {
            ...bucket,
            [tabId]: {
                ...prev,
                rows,
            },
        };
    })),

    appendInsertedRows: (tabId, rows) => set((state) => updateActiveBucket(state, (bucket) => {
        const prev = bucket[tabId];
        if (!prev || rows.length === 0) return bucket;

        return {
            ...bucket,
            [tabId]: {
                ...prev,
                rows: [...prev.rows, ...rows],
                affected: prev.affected + rows.length,
            },
        };
    })),

    setFilterExpr: (tabId, filterExpr) => set((state) => updateActiveBucket(state, (bucket) => {
        const prev = bucket[tabId];
        if (!prev) return bucket;

        return {
            ...bucket,
            [tabId]: { ...prev, filterExpr },
        };
    })),

    setLastExecutedQuery: (tabId, query) => set((state) => updateActiveBucket(state, (bucket) => {
        const prev = bucket[tabId];
        if (!prev) return bucket;

        return {
            ...bucket,
            [tabId]: { ...prev, lastExecutedQuery: query },
        };
    })),

    updatePendingState: (tabId, pendingEdits, pendingDeletions, pendingDraftRows) => set((state) => updateActiveBucket(state, (bucket) => {
        const prev = bucket[tabId];
        if (!prev) return bucket;

        return {
            ...bucket,
            [tabId]: { ...prev, pendingEdits, pendingDeletions, pendingDraftRows },
        };
    })),

    setExecutionState: (tabId, executionState, failureCode = 'none') => set((state) => updateActiveBucket(state, (bucket) => {
        const prev = bucket[tabId];
        if (!prev) return bucket;
        return {
            ...bucket,
            [tabId]: {
                ...prev,
                executionState,
                failureCode,
            },
        };
    })),

    markFirstRow: (tabId) => set((state) => updateActiveBucket(state, (bucket) => {
        const prev = bucket[tabId];
        if (!prev) return bucket;
        if (prev.progress.firstRowAt) return bucket;
        return {
            ...bucket,
            [tabId]: {
                ...prev,
                progress: {
                    ...prev.progress,
                    firstRowAt: Date.now(),
                },
            },
        };
    })),

    touchProgress: (tabId, appendedRows) => set((state) => updateActiveBucket(state, (bucket) => {
        const prev = bucket[tabId];
        if (!prev) return bucket;
        return {
            ...bucket,
            [tabId]: {
                ...prev,
                executionState: appendedRows > 0 ? 'streaming' : prev.executionState,
                progress: {
                    ...prev.progress,
                    rowsReceived: prev.progress.rowsReceived + appendedRows,
                    chunksReceived: prev.progress.chunksReceived + 1,
                    lastChunkAt: Date.now(),
                },
            },
        };
    })),

    isDone: (tabId) => {
        const result = get().results[tabId];
        return result ? result.isDone : true;
    },
})));
