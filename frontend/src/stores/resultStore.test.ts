import { beforeEach, describe, expect, it } from 'vitest';
import { useResultStore } from './resultStore';

describe('resultStore', () => {
    beforeEach(() => {
        useResultStore.setState({ results: {} } as any);
    });

    it('initializes and appends rows', () => {
        useResultStore.getState().initTab('tab-1');
        useResultStore.getState().appendRows('tab-1', ['id', 'name'], [['1', 'alice']]);

        const result = useResultStore.getState().results['tab-1'];
        expect(result.columns).toEqual(['id', 'name']);
        expect(result.rows).toHaveLength(1);
    });

    it('marks query done and keeps select rows', () => {
        useResultStore.getState().initTab('tab-1');
        useResultStore.getState().appendRows('tab-1', ['id'], [['1'], ['2']]);
        useResultStore.getState().setDone('tab-1', 0, 12, true, false);

        const result = useResultStore.getState().results['tab-1'];
        expect(result.isDone).toBe(true);
        expect(result.affected).toBe(2);
        expect(result.rows).toHaveLength(2);
    });
});

