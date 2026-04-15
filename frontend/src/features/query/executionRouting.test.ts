import { describe, expect, it, vi } from 'vitest';
import {
    applyPreExecuteFilterPolicy,
    getRelatedResultTabIds,
    resolveExecuteQuery,
} from './executionRouting';

describe('executionRouting', () => {
    it('collects related result tabs by source tab id', () => {
        const related = getRelatedResultTabIds('tab-1', [
            'tab-1',
            'tab-1::result:2',
            'tab-1::explain:plan',
            'tab-2',
        ]);

        expect(related).toEqual([
            'tab-1',
            'tab-1::result:2',
            'tab-1::explain:plan',
        ]);
    });

    it('returns raw editor query for non-filter sources', () => {
        const query = 'SELECT * FROM inventory_balance';
        expect(resolveExecuteQuery({
            source: 'editor',
            editorQuery: query,
            filterExpr: 'balance_id = 18',
            orderByExpr: 'balance_id DESC',
            filterBaseQuery: 'SELECT * FROM ignored',
        })).toBe(query);
    });

    it('builds filter query only for filter source', () => {
        const query = resolveExecuteQuery({
            source: 'filter',
            editorQuery: 'SELECT * FROM t',
            filterExpr: 'id = 1',
            orderByExpr: '',
            filterBaseQuery: 'SELECT * FROM t',
        });
        expect(query).toContain('where id = 1');
    });

    it('builds ordered query for filter source when order by is provided', () => {
        const query = resolveExecuteQuery({
            source: 'filter',
            editorQuery: 'SELECT * FROM t',
            filterExpr: '',
            orderByExpr: 'id DESC',
            filterBaseQuery: 'SELECT * FROM t',
        });
        expect(query.toLowerCase()).toContain('order by id desc');
    });

    it('clears related filter state for non-filter source', () => {
        const clearResultFilterExpr = vi.fn();
        const clearResultOrderByExpr = vi.fn();
        const updateTabContext = vi.fn();

        applyPreExecuteFilterPolicy({
            source: 'editor',
            sourceTabId: 'tab-1',
            resultTabIds: ['tab-1', 'tab-1::result:2', 'tab-2'],
            clearResultFilterExpr,
            clearResultOrderByExpr,
            updateTabContext,
        });

        expect(clearResultFilterExpr).toHaveBeenCalledTimes(2);
        expect(clearResultFilterExpr).toHaveBeenCalledWith('tab-1');
        expect(clearResultFilterExpr).toHaveBeenCalledWith('tab-1::result:2');
        expect(clearResultOrderByExpr).toHaveBeenCalledTimes(2);
        expect(clearResultOrderByExpr).toHaveBeenCalledWith('tab-1');
        expect(clearResultOrderByExpr).toHaveBeenCalledWith('tab-1::result:2');
        expect(updateTabContext).toHaveBeenCalledWith('tab-1', {
            resultFilterExpr: '',
            resultOrderByExpr: '',
            resultQuickFilter: '',
            resultFilterBaseQuery: '',
        });
    });

    it('does not clear state for filter source', () => {
        const clearResultFilterExpr = vi.fn();
        const clearResultOrderByExpr = vi.fn();
        const updateTabContext = vi.fn();

        applyPreExecuteFilterPolicy({
            source: 'filter',
            sourceTabId: 'tab-1',
            resultTabIds: ['tab-1', 'tab-1::result:2'],
            clearResultFilterExpr,
            clearResultOrderByExpr,
            updateTabContext,
        });

        expect(clearResultFilterExpr).not.toHaveBeenCalled();
        expect(clearResultOrderByExpr).not.toHaveBeenCalled();
        expect(updateTabContext).not.toHaveBeenCalled();
    });
});

