import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchTableColumnsMock, fetchTableRelationshipsMock } = vi.hoisted(() => ({
    fetchTableColumnsMock: vi.fn(),
    fetchTableRelationshipsMock: vi.fn(),
}));

vi.mock('../../wailsjs/go/app/App', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../wailsjs/go/app/App')>();
    return {
        ...actual,
        FetchTableColumns: fetchTableColumnsMock,
        FetchTableRelationships: fetchTableRelationshipsMock,
    };
});

import { COLUMN_CACHE_TTL_MS, RELATIONSHIP_CACHE_TTL_MS, useSchemaStore } from './schemaStore';
import { models } from '../../wailsjs/go/models';

function makeColumn(name: string) {
    return models.ColumnDef.createFrom({
        Name: name,
        DataType: 'text',
        IsPrimaryKey: false,
        IsNullable: true,
        DefaultValue: '',
    });
}

describe('schemaStore', () => {
    beforeEach(() => {
        fetchTableColumnsMock.mockReset();
        fetchTableRelationshipsMock.mockReset();
        useSchemaStore.setState({
            trees: {},
            cachedColumns: {},
            cachedRelationships: {},
            pendingColumnRequests: {},
            pendingRelationshipRequests: {},
            loadingKeys: new Set(),
        });
    });

    it('returns cached columns within ttl without refetch', async () => {
        const columns = [makeColumn('id')];
        fetchTableColumnsMock.mockResolvedValue(columns);
        const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_000);

        const first = await useSchemaStore.getState().checkAndFetchColumns('main', 'db1', 'public', 'users');
        const second = await useSchemaStore.getState().checkAndFetchColumns('main', 'db1', 'public', 'users');

        expect(first).toEqual(columns);
        expect(second).toEqual(columns);
        expect(fetchTableColumnsMock).toHaveBeenCalledTimes(1);

        nowSpy.mockRestore();
    });

    it('refetches columns after ttl expires', async () => {
        fetchTableColumnsMock
            .mockResolvedValueOnce([makeColumn('id')])
            .mockResolvedValueOnce([makeColumn('id'), makeColumn('name')]);

        const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_000);
        await useSchemaStore.getState().checkAndFetchColumns('main', 'db1', 'public', 'users');

        nowSpy.mockReturnValue(1_000 + COLUMN_CACHE_TTL_MS + 1);
        const next = await useSchemaStore.getState().checkAndFetchColumns('main', 'db1', 'public', 'users');

        expect(fetchTableColumnsMock).toHaveBeenCalledTimes(2);
        expect(next).toEqual([makeColumn('id'), makeColumn('name')]);

        nowSpy.mockRestore();
    });

    it('dedupes in-flight requests for the same table key', async () => {
        let resolveFetch: ((value: models.ColumnDef[]) => void) | undefined;
        fetchTableColumnsMock.mockReturnValueOnce(new Promise<models.ColumnDef[]>((resolve) => {
            resolveFetch = resolve;
        }));

        const p1 = useSchemaStore.getState().checkAndFetchColumns('main', 'db1', 'public', 'users');
        const p2 = useSchemaStore.getState().checkAndFetchColumns('main', 'db1', 'public', 'users');

        expect(fetchTableColumnsMock).toHaveBeenCalledTimes(1);

        if (resolveFetch) {
            resolveFetch([makeColumn('id')]);
        }
        await expect(p1).resolves.toEqual([makeColumn('id')]);
        await expect(p2).resolves.toEqual([makeColumn('id')]);
    });

    it('invalidates column cache for the same db when schema tree is refreshed', async () => {
        useSchemaStore.setState({
            cachedColumns: {
                'main:db1:public:users': { columns: [makeColumn('id')], fetchedAt: 1_000 },
                'main:db2:public:orders': { columns: [makeColumn('order_id')], fetchedAt: 1_000 },
            },
            cachedRelationships: {
                'main:db1:public:users': {
                    relationships: [models.TableRelationship.createFrom({ ConstraintName: 'fk1' })],
                    fetchedAt: 1_000,
                },
                'main:db2:public:orders': {
                    relationships: [models.TableRelationship.createFrom({ ConstraintName: 'fk2' })],
                    fetchedAt: 1_000,
                },
            },
            pendingColumnRequests: {
                'main:db1:public:users': Promise.resolve([makeColumn('id')]),
                'main:db2:public:orders': Promise.resolve([makeColumn('order_id')]),
            },
            pendingRelationshipRequests: {
                'main:db1:public:users': Promise.resolve([models.TableRelationship.createFrom({ ConstraintName: 'fk1' })]),
                'main:db2:public:orders': Promise.resolve([models.TableRelationship.createFrom({ ConstraintName: 'fk2' })]),
            },
        });

        useSchemaStore.getState().setTree('main', 'db1', [{ Name: 'public', Tables: ['users'], Views: [] }]);

        const state = useSchemaStore.getState();
        expect(state.cachedColumns['main:db1:public:users']).toBeUndefined();
        expect(state.cachedRelationships['main:db1:public:users']).toBeUndefined();
        expect(state.pendingColumnRequests['main:db1:public:users']).toBeUndefined();
        expect(state.pendingRelationshipRequests['main:db1:public:users']).toBeUndefined();
        expect(state.cachedColumns['main:db2:public:orders']).toBeDefined();
        expect(state.cachedRelationships['main:db2:public:orders']).toBeDefined();
        expect(state.pendingColumnRequests['main:db2:public:orders']).toBeDefined();
        expect(state.pendingRelationshipRequests['main:db2:public:orders']).toBeDefined();
    });

    it('returns cached relationships within ttl without refetch', async () => {
        const relationships = [models.TableRelationship.createFrom({
            ConstraintName: 'fk_users_orders',
            SourceSchema: 'public',
            SourceTable: 'users',
            SourceColumn: 'id',
            TargetSchema: 'public',
            TargetTable: 'orders',
            TargetColumn: 'user_id',
        })];
        fetchTableRelationshipsMock.mockResolvedValue(relationships);
        const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_000);

        const first = await useSchemaStore.getState().checkAndFetchRelationships('main', 'db1', 'public', 'users');
        const second = await useSchemaStore.getState().checkAndFetchRelationships('main', 'db1', 'public', 'users');

        expect(first).toEqual(relationships);
        expect(second).toEqual(relationships);
        expect(fetchTableRelationshipsMock).toHaveBeenCalledTimes(1);

        nowSpy.mockRestore();
    });

    it('dedupes in-flight relationship requests for the same table key', async () => {
        let resolveFetch: ((value: models.TableRelationship[]) => void) | undefined;
        fetchTableRelationshipsMock.mockReturnValueOnce(new Promise<models.TableRelationship[]>((resolve) => {
            resolveFetch = resolve;
        }));

        const p1 = useSchemaStore.getState().checkAndFetchRelationships('main', 'db1', 'public', 'users');
        const p2 = useSchemaStore.getState().checkAndFetchRelationships('main', 'db1', 'public', 'users');

        expect(fetchTableRelationshipsMock).toHaveBeenCalledTimes(1);

        if (resolveFetch) {
            resolveFetch([models.TableRelationship.createFrom({
                ConstraintName: 'fk_users_orders',
                SourceSchema: 'public',
                SourceTable: 'users',
                SourceColumn: 'id',
                TargetSchema: 'public',
                TargetTable: 'orders',
                TargetColumn: 'user_id',
            })]);
        }
        await expect(p1).resolves.toHaveLength(1);
        await expect(p2).resolves.toHaveLength(1);
    });

    it('refetches relationships after ttl expires', async () => {
        fetchTableRelationshipsMock
            .mockResolvedValueOnce([models.TableRelationship.createFrom({ ConstraintName: 'fk_users_orders' })])
            .mockResolvedValueOnce([models.TableRelationship.createFrom({ ConstraintName: 'fk_users_orders_v2' })]);

        const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_000);
        await useSchemaStore.getState().checkAndFetchRelationships('main', 'db1', 'public', 'users');

        nowSpy.mockReturnValue(1_000 + RELATIONSHIP_CACHE_TTL_MS + 1);
        const next = await useSchemaStore.getState().checkAndFetchRelationships('main', 'db1', 'public', 'users');

        expect(fetchTableRelationshipsMock).toHaveBeenCalledTimes(2);
        expect(next[0].ConstraintName).toBe('fk_users_orders_v2');

        nowSpy.mockRestore();
    });
});
