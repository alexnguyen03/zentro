import { describe, expect, it } from 'vitest';
import { getDriverCategoryDefinitions } from './connectionTreeCategoryRegistry';
import { buildCategoryTree } from './connectionTreeModel';
import type { SchemaNode } from '../../stores/schemaStore';
import { DRIVER } from '../../lib/constants';

const schemas: SchemaNode[] = [
    {
        Name: 'public',
        Tables: ['users', 'orders'],
        Views: ['active_users'],
        MaterializedViews: [],
        Indexes: ['users_pkey'],
        Functions: ['fn_health'],
        ForeignTables: [],
        Sequences: [],
        DataTypes: [],
        AggregateFunctions: [],
    },
    {
        Name: 'audit',
        Tables: ['logs'],
        Views: [],
        MaterializedViews: ['mv_logs_daily'],
        Indexes: [],
        Functions: [],
        ForeignTables: [],
        Sequences: [],
        DataTypes: [],
        AggregateFunctions: [],
    },
];

describe('connectionTreeModel', () => {
    it('builds category-first tree with driver order', () => {
        const categories = buildCategoryTree({
            schemas,
            definitions: getDriverCategoryDefinitions(DRIVER.POSTGRES),
            filter: '',
            fuzzyMatch: false,
        });

        expect(categories.length).toBe(getDriverCategoryDefinitions(DRIVER.POSTGRES).length);
        expect(categories[0].key).toBe('tables');
        expect(categories[0].schemas.map((schema) => schema.schemaName)).toEqual(['public', 'audit']);
        expect(categories[0].totalCount).toBe(3);
    });

    it('keeps global search by category label', () => {
        const categories = buildCategoryTree({
            schemas,
            definitions: getDriverCategoryDefinitions(DRIVER.POSTGRES),
            filter: 'view',
            fuzzyMatch: false,
        });

        expect(categories.map((category) => category.key)).toContain('views');
        expect(categories.map((category) => category.key)).toContain('materialized_views');

        const viewCategory = categories.find((category) => category.key === 'views');
        expect(viewCategory?.schemas[0].items.map((item) => item.name)).toContain('active_users');
    });

    it('matches schema names in global search', () => {
        const categories = buildCategoryTree({
            schemas,
            definitions: getDriverCategoryDefinitions(DRIVER.POSTGRES),
            filter: 'audit',
            fuzzyMatch: false,
        });

        expect(categories.length).toBeGreaterThan(0);
        categories.forEach((category) => {
            expect(category.schemas.every((schema) => schema.schemaName === 'audit')).toBe(true);
        });
    });

    it('supports fuzzy match as subsequence', () => {
        const categories = buildCategoryTree({
            schemas,
            definitions: getDriverCategoryDefinitions(DRIVER.POSTGRES),
            filter: 'acur',
            fuzzyMatch: true,
        });

        const views = categories.find((category) => category.key === 'views');
        expect(views?.totalCount).toBe(1);
        expect(views?.schemas[0].items[0].name).toBe('active_users');
    });
});
