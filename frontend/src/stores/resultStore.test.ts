import { describe, it, expect, beforeEach } from 'vitest';
import { useResultStore } from './resultStore';

const TAB = 'test-tab';

beforeEach(() => {
    useResultStore.setState({ results: {} });
});

describe('initTab', () => {
    it('creates a fresh result entry', () => {
        useResultStore.getState().initTab(TAB);
        const result = useResultStore.getState().results[TAB];
        expect(result).toBeDefined();
        expect(result.isDone).toBe(false);
        expect(result.rows).toEqual([]);
        expect(result.columns).toEqual([]);
        expect(result.filterExpr).toBe('');
    });

    it('preserves existing columns/rows from the previous run when re-initialised', () => {
        useResultStore.getState().initTab(TAB);
        useResultStore.getState().appendRows(TAB, ['id', 'name'], [['1', 'Alice']]);
        useResultStore.getState().initTab(TAB);
        const result = useResultStore.getState().results[TAB];
        // Previous rows/columns are preserved until the next append resets them.
        expect(result.columns).toEqual(['id', 'name']);
        expect(result.rows).toEqual([['1', 'Alice']]);
        expect(result.isDone).toBe(false);
    });
});

describe('appendRows', () => {
    it('sets columns and rows on the first chunk', () => {
        useResultStore.getState().initTab(TAB);
        useResultStore.getState().appendRows(TAB, ['id', 'value'], [['1', 'a'], ['2', 'b']]);
        const result = useResultStore.getState().results[TAB];
        expect(result.columns).toEqual(['id', 'value']);
        expect(result.rows).toHaveLength(2);
    });

    it('accumulates rows on subsequent chunks (no columns)', () => {
        useResultStore.getState().initTab(TAB);
        useResultStore.getState().appendRows(TAB, ['col'], [['row1']]);
        useResultStore.getState().appendRows(TAB, undefined, [['row2'], ['row3']]);
        const result = useResultStore.getState().results[TAB];
        expect(result.rows).toHaveLength(3);
        expect(result.columns).toEqual(['col']);
    });

    it('replaces rows when new columns are provided (streaming restart)', () => {
        useResultStore.getState().initTab(TAB);
        useResultStore.getState().appendRows(TAB, ['a'], [['x']]);
        useResultStore.getState().appendRows(TAB, ['b'], [['y']]);
        const result = useResultStore.getState().results[TAB];
        // New column set means isFirstChunk = true → newRows = rows only
        expect(result.columns).toEqual(['b']);
        expect(result.rows).toEqual([['y']]);
    });

    it('sets tableName and primaryKeys from the first chunk', () => {
        useResultStore.getState().initTab(TAB);
        useResultStore.getState().appendRows(TAB, ['id'], [['1']], 'users', ['id']);
        const result = useResultStore.getState().results[TAB];
        expect(result.tableName).toBe('users');
        expect(result.primaryKeys).toEqual(['id']);
    });

    it('does nothing when tab is not initialised', () => {
        useResultStore.getState().appendRows('non-init-tab', ['col'], [['val']]);
        expect(useResultStore.getState().results['non-init-tab']).toBeUndefined();
    });
});

describe('setDone', () => {
    it('marks the tab as done', () => {
        useResultStore.getState().initTab(TAB);
        useResultStore.getState().setDone(TAB, 0, 100, true, false);
        const result = useResultStore.getState().results[TAB];
        expect(result.isDone).toBe(true);
    });

    it('reports row count for SELECT queries', () => {
        useResultStore.getState().initTab(TAB);
        useResultStore.getState().appendRows(TAB, ['x'], [['1'], ['2'], ['3']]);
        useResultStore.getState().setDone(TAB, 999, 50, true, false);
        const result = useResultStore.getState().results[TAB];
        // For SELECT, affected = prev.rows.length = 3 (ignores the passed-in 999).
        expect(result.affected).toBe(3);
        expect(result.isSelect).toBe(true);
    });

    it('reports rows affected for DML queries and clears rows', () => {
        useResultStore.getState().initTab(TAB);
        useResultStore.getState().setDone(TAB, 5, 200, false, false);
        const result = useResultStore.getState().results[TAB];
        expect(result.affected).toBe(5);
        expect(result.isSelect).toBe(false);
        expect(result.rows).toEqual([]);
    });

    it('stores the error message when provided', () => {
        useResultStore.getState().initTab(TAB);
        useResultStore.getState().setDone(TAB, 0, 0, true, false, 'something went wrong');
        expect(useResultStore.getState().results[TAB].error).toBe('something went wrong');
    });

    it('stores hasMore flag correctly', () => {
        useResultStore.getState().initTab(TAB);
        useResultStore.getState().setDone(TAB, 0, 0, true, true);
        expect(useResultStore.getState().results[TAB].hasMore).toBe(true);
    });
});

describe('clearResult', () => {
    it('removes the tab result entirely', () => {
        useResultStore.getState().initTab(TAB);
        useResultStore.getState().clearResult(TAB);
        expect(useResultStore.getState().results[TAB]).toBeUndefined();
    });
});

describe('setOffset', () => {
    it('updates offset and sets isFetchingMore', () => {
        useResultStore.getState().initTab(TAB);
        useResultStore.getState().setOffset(TAB, 500);
        const result = useResultStore.getState().results[TAB];
        expect(result.offset).toBe(500);
        expect(result.isFetchingMore).toBe(true);
    });
});

describe('isDone', () => {
    it('returns false for a freshly initialised tab', () => {
        useResultStore.getState().initTab(TAB);
        expect(useResultStore.getState().isDone(TAB)).toBe(false);
    });

    it('returns true after setDone', () => {
        useResultStore.getState().initTab(TAB);
        useResultStore.getState().setDone(TAB, 0, 0, true, false);
        expect(useResultStore.getState().isDone(TAB)).toBe(true);
    });

    it('returns true for an unknown tab (treat as not running)', () => {
        expect(useResultStore.getState().isDone('unknown-tab')).toBe(true);
    });
});

describe('applyEdits', () => {
    it('updates cell values in rows', () => {
        useResultStore.getState().initTab(TAB);
        useResultStore.getState().appendRows(TAB, ['id', 'name'], [['1', 'Alice'], ['2', 'Bob']]);
        const edits = new Map([['1:1', 'Charlie']]);
        useResultStore.getState().applyEdits(TAB, edits);
        expect(useResultStore.getState().results[TAB].rows[1][1]).toBe('Charlie');
    });

    it('removes deleted rows', () => {
        useResultStore.getState().initTab(TAB);
        useResultStore.getState().appendRows(TAB, ['id'], [['1'], ['2'], ['3']]);
        useResultStore.getState().applyEdits(TAB, new Map(), new Set([1]));
        const rows = useResultStore.getState().results[TAB].rows;
        expect(rows).toHaveLength(2);
        expect(rows[0]).toEqual(['1']);
        expect(rows[1]).toEqual(['3']);
    });
});

describe('setFilterExpr', () => {
    it('updates the filter expression', () => {
        useResultStore.getState().initTab(TAB);
        useResultStore.getState().setFilterExpr(TAB, 'name = \'Alice\'');
        expect(useResultStore.getState().results[TAB].filterExpr).toBe('name = \'Alice\'');
    });
});

describe('setLastExecutedQuery', () => {
    it('stores the last executed query', () => {
        useResultStore.getState().initTab(TAB);
        useResultStore.getState().setLastExecutedQuery(TAB, 'SELECT * FROM users');
        expect(useResultStore.getState().results[TAB].lastExecutedQuery).toBe('SELECT * FROM users');
    });
});

describe('updatePendingEdits', () => {
    it('stores pending edits and deletions', () => {
        useResultStore.getState().initTab(TAB);
        const edits = new Map([['0:1', 'updated']]);
        const deletes = new Set([2]);
        useResultStore.getState().updatePendingEdits(TAB, edits, deletes);
        const result = useResultStore.getState().results[TAB];
        expect(result.pendingEdits?.get('0:1')).toBe('updated');
        expect(result.pendingDeletions?.has(2)).toBe(true);
    });
});
