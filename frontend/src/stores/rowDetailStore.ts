import { create } from 'zustand';
import { models } from '../../wailsjs/go/models';

export interface RowDetail {
    columns: string[];
    columnTypes?: string[];
    columnDefs?: models.ColumnDef[];
    row: string[];
    tableName?: string;
    primaryKeys?: string[];
    onSave?: (colIdx: number, newVal: string) => void;
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
