import { create } from 'zustand';

export interface TabResult {
    columns: string[];
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
}

interface ResultState {
    results: Record<string, TabResult>;

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
    applyEdits: (tabId: string, edits: Map<string, string>) => void;
}

export const useResultStore = create<ResultState>((set, get) => ({
    results: {},

    initTab: (tabId) => set((state) => ({
        results: {
            ...state.results,
            [tabId]: {
                columns: [],
                rows: [],
                isDone: false,
                affected: 0,
                duration: 0,
                isSelect: true,
                error: undefined,
                hasMore: true,
                offset: 0,
                isFetchingMore: false,
                tableName: undefined,
                primaryKeys: undefined
            }
        }
    })),

    appendRows: (tabId, columns, rows, tableName, primaryKeys) => set((state) => {
        const prev = state.results[tabId];
        if (!prev) return state; // Should be initialized

        return {
            results: {
                ...state.results,
                [tabId]: {
                    ...prev,
                    columns: columns || prev.columns,
                    rows: [...prev.rows, ...rows],
                    tableName: tableName || prev.tableName,
                    primaryKeys: primaryKeys || prev.primaryKeys,
                }
            }
        };
    }),

    setDone: (tabId, affected, duration, isSelect, hasMore, error) => set((state) => {
        const prev = state.results[tabId];
        if (!prev) return state;

        return {
            results: {
                ...state.results,
                [tabId]: {
                    ...prev,
                    isDone: true,
                    // keep cumulative row count for status bar
                    affected: isSelect ? prev.rows.length : affected,
                    duration,
                    isSelect,
                    error,
                    hasMore,
                    isFetchingMore: false,
                }
            }
        };
    }),

    setOffset: (tabId, offset) => set((state) => {
        const prev = state.results[tabId];
        if (!prev) return state;
        return {
            results: {
                ...state.results,
                [tabId]: {
                    ...prev,
                    offset,
                    isFetchingMore: true,
                }
            }
        };
    }),

    clearResult: (tabId) => set((state) => {
        const newResults = { ...state.results };
        delete newResults[tabId];
        return { results: newResults };
    }),

    applyEdits: (tabId, edits) => set((state) => {
        const prev = state.results[tabId];
        if (!prev) return state;

        const newRows = [...prev.rows];
        edits.forEach((val, cellId) => {
            const [rIdx, cIdx] = cellId.split(':').map(Number);
            if (newRows[rIdx]) {
                const newRow = [...newRows[rIdx]];
                newRow[cIdx] = val;
                newRows[rIdx] = newRow;
            }
        });

        return {
            results: {
                ...state.results,
                [tabId]: {
                    ...prev,
                    rows: newRows
                }
            }
        };
    }),

    isDone: (tabId) => {
        const r = get().results[tabId];
        return r ? r.isDone : true; // If not found, assume it's not running
    }
}));
