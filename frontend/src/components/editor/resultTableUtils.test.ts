import { describe, expect, it } from 'vitest';
import {
    buildHeaderColumnFilterExpr,
    computeAutoFitWidth,
    normalizeDataTypeLabel,
    reorderDataColumnIds,
} from './resultTableUtils';

describe('resultTableUtils', () => {
    it('normalizes data type labels for compact header display', () => {
        expect(normalizeDataTypeLabel('CHARACTER VARYING')).toBe('varchar');
        expect(normalizeDataTypeLabel('timestamp with time zone')).toBe('timestamptz');
        expect(normalizeDataTypeLabel('')).toBe('unknown');
    });

    it('builds header filter expression and escapes unsafe chars', () => {
        const expr = buildHeaderColumnFilterExpr(
            {
                name: "O'Reilly_100%~",
                city: 'HCM',
                empty: '   ',
            },
            'postgres',
        );
        expect(expr).toContain(`CAST("name" AS TEXT) ILIKE '%O''Reilly~_100~%~~%' ESCAPE '~'`);
        expect(expr).toContain(`CAST("city" AS TEXT) ILIKE '%HCM%' ESCAPE '~'`);
        expect(expr).not.toContain('"empty"');
        expect(expr.includes(' AND ')).toBe(true);
    });

    it('reorders ids while keeping unknown ids unchanged', () => {
        expect(reorderDataColumnIds(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'c', 'a']);
        expect(reorderDataColumnIds(['a', 'b', 'c'], 'x', 'c')).toEqual(['a', 'b', 'c']);
    });

    it('computes bounded auto-fit width from text lengths', () => {
        const width = computeAutoFitWidth(['id', 'very_long_customer_identifier']);
        expect(width).toBeGreaterThan(120);
        expect(computeAutoFitWidth(['x'], { min: 90, max: 120, charWidth: 10, padding: 0 })).toBe(90);
        expect(computeAutoFitWidth(['x'.repeat(100)], { min: 90, max: 120, charWidth: 10, padding: 0 })).toBe(120);
    });
});
