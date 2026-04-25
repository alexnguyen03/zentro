import { describe, expect, it } from 'vitest';
import { parseOrderByTerms, serializeOrderByTerms } from './orderByBuilder';

describe('orderByBuilder', () => {
    const columns = ['created_at', 'id', 'createdAt', 'user name', 'o.account_id'];

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

    it('keeps qualified identifiers unquoted in serialization', () => {
        const parsed = parseOrderByTerms('o.account_id ASC', columns);
        expect(parsed.isCustom).toBe(false);
        expect(parsed.terms).toEqual([{ field: 'o.account_id', dir: 'ASC' }]);
        expect(serializeOrderByTerms(parsed.terms)).toBe('o.account_id ASC');
    });
});
