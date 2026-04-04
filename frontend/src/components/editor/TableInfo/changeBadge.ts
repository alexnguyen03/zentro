import type { DraftRow } from '../../../lib/dataEditing';
import type { RowState } from './types';

interface DataPendingState {
    pendingEdits?: Map<string, string> | Array<[string, string]> | null;
    pendingDeletions?: Set<number> | number[] | null;
    pendingDraftRows?: DraftRow[] | null;
}

const parsePendingEdits = (pendingEdits: DataPendingState['pendingEdits']): Map<string, string> => {
    if (pendingEdits instanceof Map) return pendingEdits;
    if (Array.isArray(pendingEdits)) {
        try {
            return new Map(pendingEdits);
        } catch {
            return new Map();
        }
    }
    return new Map();
};

const parsePendingDeletions = (pendingDeletions: DataPendingState['pendingDeletions']): Set<number> => {
    if (pendingDeletions instanceof Set) return pendingDeletions;
    if (Array.isArray(pendingDeletions)) {
        return new Set(
            pendingDeletions.filter((value): value is number => typeof value === 'number' && Number.isFinite(value)),
        );
    }
    return new Set();
};

const hasRowChanged = (row: RowState) =>
    row.isNew || row.deleted || JSON.stringify(row.original) !== JSON.stringify(row.current);

export const getColumnsDirtyCount = (rows: RowState[]): number =>
    rows.reduce((count, row) => count + (hasRowChanged(row) ? 1 : 0), 0);

export const getDataDirtyCount = (state?: DataPendingState): number => {
    if (!state) return 0;

    const pendingDraftRows = state.pendingDraftRows ?? [];
    const pendingEdits = parsePendingEdits(state.pendingEdits);
    const pendingDeletions = parsePendingDeletions(state.pendingDeletions);
    const updatedRowIndices = new Set<number>();

    pendingEdits.forEach((_, cellId) => {
        const [rowIndexRaw] = cellId.split(':');
        const rowIndex = Number(rowIndexRaw);
        if (!Number.isFinite(rowIndex)) return;
        if (pendingDeletions.has(rowIndex)) return;
        updatedRowIndices.add(rowIndex);
    });

    return pendingDraftRows.length + pendingDeletions.size + updatedRowIndices.size;
};
