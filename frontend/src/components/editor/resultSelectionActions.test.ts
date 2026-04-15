import { describe, expect, it } from 'vitest';
import type { DraftRow } from '../../lib/dataEditing';
import { makeCellId } from './resultPanelUtils';
import {
    applyClipboardPaste,
    applySetNullToSelection,
    buildSelectByPrimaryKeyQuery,
    buildRowAsUpdateStatement,
    buildSelectionMatrix,
    buildWhereClauseByPrimaryKeys,
    buildWhereClauseBySelectionIn,
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

    it('builds UPDATE statements for each selected persisted row with row-specific PK values', () => {
        const selectedCells = new Set<string>([
            makeCellId('p:0', 0),
            makeCellId('p:1', 0),
        ]);
        const displayRows = [
            { key: 'p:0', kind: 'persisted' as const, persistedIndex: 0, values: ['1', 'Alice', 'A1'] },
            { key: 'p:1', kind: 'persisted' as const, persistedIndex: 1, values: ['2', 'Bob', 'B2'] },
        ];
        const rowOrder = new Map<string, number>([
            ['p:0', 0],
            ['p:1', 1],
        ]);
        const editedCells = new Map<string, string>([
            ['0:1', 'Alice X'],
            ['1:2', 'B9'],
        ]);

        const sql = buildRowAsUpdateStatement({
            selectedCells,
            displayRows,
            rowOrder,
            editedCells,
            columns: ['id', 'name', 'code'],
            pkColumns: ['id'],
            tableName: 'users',
            driver: 'postgres',
        });

        expect(sql).toContain('"id" = \'1\'');
        expect(sql).toContain('"id" = \'2\'');
        expect(sql).toContain('"name" = \'Alice X\'');
        expect(sql).toContain('"code" = \'B9\'');
        expect(sql.match(/UPDATE "users"/g)?.length).toBe(2);
    });

    it('builds WHERE clause from selected persisted rows by primary key', () => {
        const clause = buildWhereClauseByPrimaryKeys({
            persistedRowIndices: [0, 1],
            displayRows: [
                { key: 'p:0', kind: 'persisted' as const, persistedIndex: 0, values: ['1', 'Alice'] },
                { key: 'p:1', kind: 'persisted' as const, persistedIndex: 1, values: ['2', 'Bob'] },
            ],
            editedCells: new Map<string, string>(),
            columns: ['id', 'name'],
            pkColumns: ['id'],
            driver: 'postgres',
        });

        expect(clause).toBe('"id" = \'1\' OR "id" = \'2\'');
    });

    it('builds WHERE IN clause from selected single-column cell values', () => {
        const selectedCells = new Set<string>([
            makeCellId('p:0', 1),
            makeCellId('p:1', 1),
        ]);
        const displayRowsByKey = new Map([
            ['p:0', { key: 'p:0', kind: 'persisted' as const, persistedIndex: 0, values: ['1', 'HN'] }],
            ['p:1', { key: 'p:1', kind: 'persisted' as const, persistedIndex: 1, values: ['2', 'HCM'] }],
        ]);

        const clause = buildWhereClauseBySelectionIn({
            selectedCells,
            displayRowsByKey,
            editedCells: new Map<string, string>(),
            columns: ['id', 'branch_id'],
            driver: 'postgres',
        });

        expect(clause).toBe('"branch_id" IN (\'HN\', \'HCM\')');
    });

    it('builds SELECT query for a persisted row by primary key', () => {
        const query = buildSelectByPrimaryKeyQuery({
            persistedRowIndex: 1,
            displayRows: [
                { key: 'p:0', kind: 'persisted' as const, persistedIndex: 0, values: ['1', 'Alice'] },
                { key: 'p:1', kind: 'persisted' as const, persistedIndex: 1, values: ['2', 'Bob'] },
            ],
            editedCells: new Map<string, string>(),
            columns: ['id', 'name'],
            pkColumns: ['id'],
            tableName: 'users',
            driver: 'postgres',
        });

        expect(query).toBe('SELECT * FROM "users" WHERE "id" = \'2\';');
    });
});
