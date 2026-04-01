import { describe, expect, it } from 'vitest';
import type { DraftRow } from '../../lib/dataEditing';
import { makeCellId } from './resultPanelUtils';
import {
    applyClipboardPaste,
    applySetNullToSelection,
    buildSelectionMatrix,
    matrixToTsv,
} from './resultSelectionActions';

describe('resultSelectionActions', () => {
    it('builds matrix from selection and serializes to TSV', () => {
        const displayRows = [
            { key: 'p:0', kind: 'persisted' as const, persistedIndex: 0, values: ['1', 'A'] },
            { key: 'p:1', kind: 'persisted' as const, persistedIndex: 1, values: ['2', 'B'] },
        ];
        const selectedCells = new Set<string>([
            makeCellId('p:0', 0),
            makeCellId('p:1', 1),
        ]);
        const rowOrder = new Map<string, number>([
            ['p:0', 0],
            ['p:1', 1],
        ]);
        const editedCells = new Map<string, string>([['1:1', 'BB']]);

        const matrix = buildSelectionMatrix({
            selectedCells,
            displayRows,
            rowOrder,
            editedCells,
        });

        expect(matrix).toEqual([
            ['1', ''],
            ['', 'BB'],
        ]);
        expect(matrixToTsv(matrix)).toBe('1\t\n\tBB');
    });

    it('applies clipboard paste to pending edits/drafts only', () => {
        const selectedCells = new Set<string>([makeCellId('p:0', 0)]);
        const displayRows = [
            { key: 'p:0', kind: 'persisted' as const, persistedIndex: 0, values: ['1', 'Alice'] },
            { key: 'd:draft-1', kind: 'draft' as const, values: ['x', 'y'], draft: { id: 'draft-1' } },
        ];
        const rowOrder = new Map<string, number>([
            ['p:0', 0],
            ['d:draft-1', 1],
        ]);
        const editedCells = new Map<string, string>();
        const draftRows: DraftRow[] = [{
            id: 'draft-1',
            kind: 'new',
            values: ['x', 'y'],
            insertAfterRowIndex: null,
        }];

        const pasted = applyClipboardPaste({
            text: '9\tZ\n7\tW',
            selectedCells,
            displayRows,
            rowOrder,
            editedCells,
            draftRows,
            deletedRows: new Set<number>(),
            columnCount: 2,
        });

        expect(pasted).not.toBeNull();
        expect(pasted?.nextEdited.get('0:0')).toBe('9');
        expect(pasted?.nextEdited.get('0:1')).toBe('Z');
        expect(pasted?.nextDraftRows[0].values).toEqual(['7', 'W']);
        expect(pasted?.pastedCells.has(makeCellId('p:0', 0))).toBe(true);
        expect(pasted?.pastedCells.has(makeCellId('d:draft-1', 1))).toBe(true);
        expect(draftRows[0].values).toEqual(['x', 'y']);
        expect(editedCells.size).toBe(0);
    });

    it('sets NULL only on nullable cells and skips non-nullable cells', () => {
        const selectedCells = new Set<string>([
            makeCellId('p:0', 0),
            makeCellId('p:0', 1),
            makeCellId('d:draft-1', 0),
            makeCellId('d:draft-1', 1),
        ]);
        const displayRowsByKey = new Map([
            ['p:0', { key: 'p:0', kind: 'persisted' as const, persistedIndex: 0, values: ['v0', 'v1'] }],
            ['d:draft-1', { key: 'd:draft-1', kind: 'draft' as const, values: ['x', 'y'], draft: { id: 'draft-1' } }],
        ]);
        const editedCells = new Map<string, string>();
        const draftRows: DraftRow[] = [{
            id: 'draft-1',
            kind: 'new',
            values: ['x', 'y'],
            insertAfterRowIndex: null,
        }];

        const result = applySetNullToSelection({
            selectedCells,
            displayRowsByKey,
            editedCells,
            draftRows,
            nullableByColumnIndex: [true, false],
        });

        expect(result.updatedCount).toBe(2);
        expect(result.skippedCount).toBe(2);
        expect(result.nextEdited.get('0:0')).toBe('');
        expect(result.nextDraftRows[0].values).toEqual(['', 'y']);
        expect(result.updatedCells.has(makeCellId('p:0', 1))).toBe(false);
        expect(result.updatedCells.has(makeCellId('d:draft-1', 1))).toBe(false);
    });
});
