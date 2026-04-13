import { describe, expect, it } from 'vitest';
import { parseOrderByTerms, serializeOrderByTerms } from './orderByBuilder';

describe('orderByBuilder', () => {
    const columns = ['created_at', 'id', 'createdAt', 'user name'];

    it('parses and serializes simple terms', () => {
        const parsed = parseOrderByTerms('created_at DESC, id ASC', columns);
        expect(parsed.isCustom).toBe(false);
        expect(parsed.terms).toEqual([
            { field: 'created_at', dir: 'DESC' },
            { field: 'id', dir: 'ASC' },
        ]);
        expect(serializeOrderByTerms(parsed.terms)).toBe('created_at DESC, id ASC');
    });

    it('parses quoted identifier and round-trips', () => {
        const parsed = parseOrderByTerms('"createdAt" DESC', columns);
        expect(parsed.isCustom).toBe(false);
        expect(parsed.terms).toEqual([{ field: 'createdAt', dir: 'DESC' }]);
        expect(serializeOrderByTerms(parsed.terms)).toBe('createdAt DESC');
    });

    it('marks custom for unsupported expression', () => {
        const parsed = parseOrderByTerms('lower(name) DESC', columns);
        expect(parsed.isCustom).toBe(true);
        expect(parsed.terms).toEqual([]);
    });
});

