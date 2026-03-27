import { describe, expect, it } from 'vitest';
import type { SchemaNode } from '../../stores/schemaStore';
import { resolveTableNavigationAtPosition, type SqlModelLike, type SqlPositionLike } from './sqlTableNavigation';

function createModel(text: string): SqlModelLike {
    return {
        getValue: () => text,
        getOffsetAt: (position: SqlPositionLike) => {
            const lines = text.split('\n');
            let offset = 0;
            for (let i = 0; i < position.lineNumber - 1; i++) {
                offset += (lines[i]?.length ?? 0) + 1;
            }
            return offset + Math.max(0, position.column - 1);
        },
    };
}

const schemas: SchemaNode[] = [
    {
        Name: 'public',
        Tables: ['users', 'orders'],
        Views: ['active_users'],
    },
    {
        Name: 'audit',
        Tables: ['users'],
        Views: [],
    },
];

describe('sqlTableNavigation.resolveTableNavigationAtPosition', () => {
    it('resolves unqualified table name when it has a single match', () => {
        const model = createModel('SELECT * FROM orders o');
        const result = resolveTableNavigationAtPosition(model, { lineNumber: 1, column: 15 }, schemas);

        expect(result.kind).toBe('single_match');
        if (result.kind !== 'single_match') return;
        expect(result.match.qualifiedName).toBe('public.orders');
    });

    it('resolves schema-qualified table name', () => {
        const model = createModel('SELECT * FROM public.users u');
        const result = resolveTableNavigationAtPosition(model, { lineNumber: 1, column: 23 }, schemas);

        expect(result.kind).toBe('single_match');
        if (result.kind !== 'single_match') return;
        expect(result.match.qualifiedName).toBe('public.users');
    });

    it('resolves quoted schema/table identifier', () => {
        const model = createModel('SELECT * FROM "public"."users"');
        const result = resolveTableNavigationAtPosition(model, { lineNumber: 1, column: 28 }, schemas);

        expect(result.kind).toBe('single_match');
        if (result.kind !== 'single_match') return;
        expect(result.match.qualifiedName).toBe('public.users');
    });

    it('returns not_found when the table does not exist in context', () => {
        const model = createModel('SELECT * FROM products');
        const result = resolveTableNavigationAtPosition(model, { lineNumber: 1, column: 17 }, schemas);

        expect(result.kind).toBe('not_found');
    });

    it('returns multiple_matches when table name exists in multiple schemas', () => {
        const model = createModel('SELECT * FROM users');
        const result = resolveTableNavigationAtPosition(model, { lineNumber: 1, column: 15 }, schemas);

        expect(result.kind).toBe('multiple_matches');
        if (result.kind !== 'multiple_matches') return;
        expect(result.matches.map((x) => x.qualifiedName)).toEqual(['audit.users', 'public.users']);
    });
});
