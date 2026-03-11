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
    applyEdits: (tabId: string, edits: Map<string, string>, deletedRows?: Set<number>) => void;
}

export const useResultStore = create<ResultState>((set, get) => ({
    results: {},

    initTab: (tabId) => set((state) => {
        const prev = state.results[tabId];
        return {
            results: {
                ...state.results,
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
                    primaryKeys: prev?.primaryKeys
                }
            }
        };
    }),

    appendRows: (tabId, columns, rows, tableName, primaryKeys) => set((state) => {
        const prev = state.results[tabId];
        if (!prev) return state; // Should be initialized

        const isFirstChunk = columns !== undefined && columns.length > 0;
        const newRows = isFirstChunk ? rows : [...prev.rows, ...rows];

        return {
            results: {
                ...state.results,
                [tabId]: {
                    ...prev,
                    columns: columns || prev.columns,
                    rows: newRows,
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
                    rows: isSelect ? prev.rows : [],
                    columns: isSelect ? prev.columns : [],
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

    applyEdits: (tabId, edits, deletedRows) => set((state) => {
        const prev = state.results[tabId];
        if (!prev) return state;

        let newRows = [...prev.rows];
        edits.forEach((val, cellId) => {
            const [rIdx, cIdx] = cellId.split(':').map(Number);
            if (newRows[rIdx]) {
                const newRow = [...newRows[rIdx]];
                newRow[cIdx] = val;
                newRows[rIdx] = newRow;
            }
        });

        if (deletedRows && deletedRows.size > 0) {
            newRows = newRows.filter((_, idx) => !deletedRows.has(idx));
        }

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
