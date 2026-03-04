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
}

interface ResultState {
    results: Record<string, TabResult>;

    initTab: (tabId: string) => void;
    appendRows: (tabId: string, columns: string[] | undefined, rows: string[][]) => void;
    setDone: (tabId: string, affected: number, duration: number, isSelect: boolean, error?: string) => void;
    setOffset: (tabId: string, offset: number) => void;
    clearResult: (tabId: string) => void;
    isDone: (tabId: string) => boolean;
}

export const useResultStore = create<ResultState>((set, get) => ({
    results: {},

    initTab: (tabId) => set((state) => ({
        results: {
            ...state.results,
            [tabId]: { columns: [], rows: [], isDone: false, affected: 0, duration: 0, isSelect: true, error: undefined, hasMore: true, offset: 0 }
        }
    })),

    appendRows: (tabId, columns, rows) => set((state) => {
        const prev = state.results[tabId];
        if (!prev) return state; // Should be initialized

        return {
            results: {
                ...state.results,
                [tabId]: {
                    ...prev,
                    columns: columns || prev.columns,
                    rows: [...prev.rows, ...rows],
                }
            }
        };
    }),

    setDone: (tabId, affected, duration, isSelect, error) => set((state) => {
        const prev = state.results[tabId];
        if (!prev) return state;

        // If affected > 0 in SELECT, it means we fetched a chunk.
        // We assume we have more. The precise check is affected == fetchLimit.
        // For safety, let's say if affected == 0, hasMore = false.
        const hasMore = isSelect && affected > 0 && !error;

        return {
            results: {
                ...state.results,
                [tabId]: {
                    ...prev,
                    isDone: true,
                    // keep original affected rows if it's select, so status bar shows cumulative sum
                    affected: isSelect ? prev.rows.length : affected,
                    duration,
                    isSelect,
                    error,
                    hasMore,
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
                    isDone: false, // Set to false so UI shows loading state and prevents immediate re-fetch
                }
            }
        };
    }),

    clearResult: (tabId) => set((state) => {
        const newResults = { ...state.results };
        delete newResults[tabId];
        return { results: newResults };
    }),

    isDone: (tabId) => {
        const r = get().results[tabId];
        return r ? r.isDone : true; // If not found, assume it's not running
    }
}));
