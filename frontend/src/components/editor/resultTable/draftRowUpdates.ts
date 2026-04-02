import React from 'react';

import { DraftRow } from '../../../lib/dataEditing';

interface DraftValueChange {
    rowKey: string;
    colIdx: number;
    value: string;
}

export function applyDraftRowValueChanges(
    setDraftRows: React.Dispatch<React.SetStateAction<DraftRow[]>>,
    changes: DraftValueChange[],
): void {
    if (changes.length === 0) return;

    setDraftRows((prev) => prev.map((draftRow) => {
        const rowKey = `d:${draftRow.id}`;
        const rowChanges = changes.filter((change) => change.rowKey === rowKey);
        if (rowChanges.length === 0) return draftRow;

        const nextValues = [...draftRow.values];
        rowChanges.forEach((change) => {
            nextValues[change.colIdx] = change.value;
        });

        return { ...draftRow, values: nextValues };
    }));
}
