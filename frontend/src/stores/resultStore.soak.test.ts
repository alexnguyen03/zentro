import { describe, expect, it } from 'vitest';
import { useResultStore } from './resultStore';

function buildRows(count: number, cols = 8): string[][] {
    const rows: string[][] = [];
    for (let i = 0; i < count; i += 1) {
        const row: string[] = [];
        for (let j = 0; j < cols; j += 1) {
            row.push(`r${i}c${j}`);
        }
        rows.push(row);
    }
    return rows;
}

describe('resultStore soak', () => {
    it('handles large append workload without unbounded growth', () => {
        const state = useResultStore.getState();
        state.switchProject('soak-project');
        state.initTab('soak-tab');
        const cols = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'];

        const start = Date.now();
        for (let i = 0; i < 60; i += 1) {
            const rows = buildRows(2000);
            state.appendRows('soak-tab', i === 0 ? cols : undefined, rows);
            state.touchProgress('soak-tab', rows.length);
        }
        const elapsedMs = Date.now() - start;

        const result = useResultStore.getState().results['soak-tab'];
        expect(result.rows.length).toBeLessThanOrEqual(100000);
        expect(result.wasRowCapApplied).toBe(true);
        expect(elapsedMs).toBeLessThan(5000);
    });
});

