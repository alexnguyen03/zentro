import { create } from 'zustand';
import { DraftRow } from '../lib/dataEditing';
import { withStoreLogger } from './logger';

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
}

type WorkspaceResultBucket = Record<string, TabResult>;

interface ResultState {
    workspaceResults: Record<string, WorkspaceResultBucket>;
    activeWorkspaceId: string | null;
    results: WorkspaceResultBucket;

    switchWorkspace: (workspaceId: string | null) => void;
    clearWorkspace: (workspaceId?: string | null) => void;
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
}

const DEFAULT_WORKSPACE_ID = '__default__';

const createEmptyBucket = (): WorkspaceResultBucket => ({});

const getWorkspaceId = (workspaceId?: string | null) => workspaceId || DEFAULT_WORKSPACE_ID;

function getActiveBucket(state: Pick<ResultState, 'workspaceResults' | 'activeWorkspaceId'>) {
    return state.workspaceResults[getWorkspaceId(state.activeWorkspaceId)] || createEmptyBucket();
}

function updateActiveBucket(
    state: ResultState,
    updater: (bucket: WorkspaceResultBucket) => WorkspaceResultBucket
) {
    const workspaceId = getWorkspaceId(state.activeWorkspaceId);
    const nextBucket = updater(getActiveBucket(state));

    return {
        workspaceResults: {
            ...state.workspaceResults,
            [workspaceId]: nextBucket,
        },
        results: nextBucket,
    };
}

export const useResultStore = create<ResultState>(withStoreLogger('resultStore', (set, get) => ({
    workspaceResults: {
        [DEFAULT_WORKSPACE_ID]: createEmptyBucket(),
    },
    activeWorkspaceId: DEFAULT_WORKSPACE_ID,
    results: {},

    switchWorkspace: (workspaceId) => set((state) => {
        const nextWorkspaceId = getWorkspaceId(workspaceId);
        const results = state.workspaceResults[nextWorkspaceId] || createEmptyBucket();

        return {
            workspaceResults: {
                ...state.workspaceResults,
                [nextWorkspaceId]: results,
            },
            activeWorkspaceId: nextWorkspaceId,
            results,
        };
    }),

    clearWorkspace: (workspaceId) => set((state) => {
        const nextWorkspaceId = getWorkspaceId(workspaceId || state.activeWorkspaceId);
        const workspaceResults = {
            ...state.workspaceResults,
            [nextWorkspaceId]: createEmptyBucket(),
        };
        const isActive = nextWorkspaceId === getWorkspaceId(state.activeWorkspaceId);

        return {
            workspaceResults,
            ...(isActive ? { results: workspaceResults[nextWorkspaceId] } : {}),
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
            },
        };
    })),

    appendRows: (tabId, columns, rows, tableName, primaryKeys) => set((state) => updateActiveBucket(state, (bucket) => {
        const prev = bucket[tabId];
        if (!prev) return bucket;

        const isFirstChunk = columns !== undefined && columns.length > 0;
        const nextRows = isFirstChunk ? rows : [...prev.rows, ...rows];

        return {
            ...bucket,
            [tabId]: {
                ...prev,
                columns: columns || prev.columns,
                rows: nextRows,
                tableName: tableName || prev.tableName,
                primaryKeys: primaryKeys || prev.primaryKeys,
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

    isDone: (tabId) => {
        const result = get().results[tabId];
        return result ? result.isDone : true;
    },
})));
