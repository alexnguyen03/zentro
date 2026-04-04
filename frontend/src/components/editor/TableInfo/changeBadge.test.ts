import { describe, expect, it } from 'vitest';
import type { RowState } from './types';
import { getColumnsDirtyCount, getDataDirtyCount } from './changeBadge';

const makeRow = (overrides: Partial<RowState> = {}): RowState => ({
    id: 'row-1',
    original: {
        Name: 'id',
        DataType: 'INT',
        DefaultValue: '',
        IsNullable: false,
        IsPrimaryKey: true,
    },
    current: {
        Name: 'id',
        DataType: 'INT',
        DefaultValue: '',
        IsNullable: false,
        IsPrimaryKey: true,
    },
    deleted: false,
    ...overrides,
});

describe('changeBadge helpers', () => {
    it('counts columns dirty rows for new, edited, and deleted rows', () => {
        const rows: RowState[] = [
            makeRow({ id: 'unchanged' }),
            makeRow({ id: 'new', isNew: true }),
            makeRow({ id: 'deleted', deleted: true }),
            makeRow({
                id: 'edited',
                current: {
                    Name: 'name',
                    DataType: 'VARCHAR(255)',
                    DefaultValue: '',
                    IsNullable: true,
                    IsPrimaryKey: false,
                },
            }),
        ];

        expect(getColumnsDirtyCount(rows)).toBe(3);
    });

    it('counts data updates by unique row index', () => {
        const count = getDataDirtyCount({
            pendingEdits: new Map([
                ['2:0', 'a'],
                ['2:1', 'b'],
            ]),
            pendingDeletions: new Set(),
            pendingDraftRows: [],
        });

        expect(count).toBe(1);
    });

    it('does not count updated rows that are also pending deletion', () => {
        const count = getDataDirtyCount({
            pendingEdits: new Map([
                ['1:0', 'a'],
                ['2:1', 'b'],
            ]),
            pendingDeletions: new Set([1]),
            pendingDraftRows: [],
        });

        expect(count).toBe(2);
    });

    it('counts pending draft rows so add-only changes still show badge', () => {
        const count = getDataDirtyCount({
            pendingEdits: new Map(),
            pendingDeletions: new Set(),
            pendingDraftRows: [
                { id: 'd1', kind: 'new', values: ['1'], insertAfterRowIndex: null },
                { id: 'd2', kind: 'duplicate', values: ['2'], insertAfterRowIndex: 0, sourceRowIndex: 0 },
            ],
        });

        expect(count).toBe(2);
    });

    it('returns zero when there are no pending changes', () => {
        expect(getDataDirtyCount()).toBe(0);
        expect(getDataDirtyCount({})).toBe(0);
    });

    it('supports serialized array forms of pending state', () => {
        const count = getDataDirtyCount({
            pendingEdits: [['3:0', 'x']],
            pendingDeletions: [4],
            pendingDraftRows: [{ id: 'd1', kind: 'new', values: ['1'], insertAfterRowIndex: null }],
        });

        expect(count).toBe(3);
    });
});
