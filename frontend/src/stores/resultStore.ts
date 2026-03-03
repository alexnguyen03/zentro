import { create } from 'zustand';

export interface TabResult {
    columns: string[];
    rows: string[][];
    isDone: boolean;
    affected: number;
    duration: number;
    error?: string;
    isSelect: boolean;
}

interface ResultState {
    results: Record<string, TabResult>;

    initTab: (tabId: string) => void;
    appendRows: (tabId: string, columns: string[] | undefined, rows: string[][]) => void;
    setDone: (tabId: string, affected: number, duration: number, isSelect: boolean, error?: string) => void;
    clearResult: (tabId: string) => void;
    isDone: (tabId: string) => boolean;
}

export const useResultStore = create<ResultState>((set, get) => ({
    results: {},

    initTab: (tabId) => set((state) => ({
        results: {
            ...state.results,
            [tabId]: { columns: [], rows: [], isDone: false, affected: 0, duration: 0, isSelect: true, error: undefined }
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

        return {
            results: {
                ...state.results,
                [tabId]: {
                    ...prev,
                    isDone: true,
                    affected,
                    duration,
                    isSelect,
                    error,
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
