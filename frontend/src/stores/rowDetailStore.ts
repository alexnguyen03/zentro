import { create } from 'zustand';

export interface RowDetail {
    columns: string[];
    row: string[];
    tableName?: string;
}

interface RowDetailState {
    detail: RowDetail | null;
    openDetail: (detail: RowDetail) => void;
    clearDetail: () => void;
}

export const useRowDetailStore = create<RowDetailState>((set) => ({
    detail: null,
    openDetail: (detail) => set({ detail }),
    clearDetail: () => set({ detail: null }),
}));
