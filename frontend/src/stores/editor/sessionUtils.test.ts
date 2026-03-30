import { describe, expect, it } from 'vitest';
import { getNextTabName } from './sessionUtils';
import type { TabGroup } from './types';

function makeGroup(names: string[]): TabGroup {
    return {
        id: 'group-1',
        activeTabId: names[0] ? `tab-${names[0]}` : null,
        tabs: names.map((name, index) => ({
            id: `tab-${index + 1}`,
            name,
            query: '',
            isRunning: false,
            type: 'query',
        })),
    };
}

describe('getNextTabName', () => {
    it('uses max numeric suffix instead of filling first gap', () => {
        const groups = [makeGroup(['New Query', 'New Query 3'])];
        expect(getNextTabName(groups)).toBe('New Query 4');
    });

    it('returns base name when no matching default tabs exist', () => {
        const groups = [makeGroup(['Customers', 'Orders'])];
        expect(getNextTabName(groups)).toBe('New Query');
    });

    it('increments when base tab exists without suffix', () => {
        const groups = [makeGroup(['New Query'])];
        expect(getNextTabName(groups)).toBe('New Query 2');
    });

    it('includes reserved names from saved scripts', () => {
        const groups = [makeGroup(['New Query'])];
        expect(getNextTabName(groups, 'New Query', ['New Query 2', 'New Query 3'])).toBe('New Query 4');
    });

    it('parses mixed case and spacing from reserved names', () => {
        const groups = [makeGroup([])];
        expect(getNextTabName(groups, 'New Query', [' new query 3 ', 'NEW QUERY 5'])).toBe('New Query 6');
    });
});
