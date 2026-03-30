import { describe, expect, it } from 'vitest';
import { formatDuration, makeCellId, parseCellId } from './resultPanelUtils';

describe('resultPanelUtils', () => {
    it('creates and parses cell ids', () => {
        const cellId = makeCellId('p:12', 3);
        expect(cellId).toBe('p:12|3');
        expect(parseCellId(cellId)).toEqual({ rowKey: 'p:12', colIdx: 3 });
    });

    it('formats duration in milliseconds and seconds', () => {
        expect(formatDuration(321)).toBe('321ms');
        expect(formatDuration(1200)).toBe('1.20s');
    });
});
