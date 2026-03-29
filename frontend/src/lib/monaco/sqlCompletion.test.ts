import { describe, expect, it, vi } from 'vitest';
import {
    analyzeSqlText,
    buildSqlCompletionItems,
    formatTableSuggestionDocumentation,
    getSchemasForActiveDatabase,
    isTableCompletionItem,
    resolveTableSuggestionItem,
    type SqlCompletionEnv,
} from './sqlCompletion';

const monacoStub = {
    languages: {
        CompletionItemKind: {
            Field: 1,
            Module: 2,
            Class: 3,
            Keyword: 4,
            Function: 5,
            Text: 6,
            Operator: 7,
            Snippet: 8,
        },
        CompletionItemInsertTextRule: {
            InsertAsSnippet: 1,
        },
    },
};

const env: SqlCompletionEnv = {
    monaco: monacoStub,
    schemas: [
        { Name: 'public', Tables: ['users'], Views: ['active_users'] },
    ],
    driver: 'postgres',
    profileKey: 'main',
    dbName: 'db1',
    fetchColumns: vi.fn(async (schemaName: string, tableName: string) => {
        if (schemaName === 'public' && tableName === 'users') {
            return [
                { Name: 'id', DataType: 'integer', IsPrimaryKey: true },
                { Name: 'name', DataType: 'text' },
            ];
        }
        return [];
    }),
    fetchRelationships: vi.fn(async () => []),
    templates: [],
};

function createRange(column: number) {
    return { startLineNumber: 1, endLineNumber: 1, startColumn: column, endColumn: column };
}

describe('sqlCompletion', () => {
    it('detects the current statement and clause across multiple statements', () => {
        const text = 'SELECT 1; SELECT * FROM users u WHERE u.';
        const analysis = analyzeSqlText(text, text.length);

        expect(analysis.statementText.trimStart()).toContain('SELECT * FROM users u WHERE u.');
        expect(analysis.clause).toBe('where');
        expect(analysis.afterDot).toBe(true);
        expect(analysis.dotIdentifier).toBe('u');
    });

    it('suppresses completion inside comments and strings', async () => {
        const text = "SELECT * FROM users -- comment";
        const analysis = analyzeSqlText(text, text.length);
        const items = await buildSqlCompletionItems(
            analysis,
            '',
            { startLineNumber: 1, endLineNumber: 1, startColumn: text.length, endColumn: text.length },
            env,
        );

        expect(analysis.isInCommentOrString).toBe(true);
        expect(items).toEqual([]);
    });

    it('suggests columns for alias dot completion', async () => {
        const text = 'SELECT * FROM users u WHERE u.';
        const analysis = analyzeSqlText(text, text.length);
        const items = await buildSqlCompletionItems(
            analysis,
            '',
            { startLineNumber: 1, endLineNumber: 1, startColumn: text.length, endColumn: text.length },
            env,
        );

        expect(items.map((item) => String(item.label))).toEqual(expect.arrayContaining(['id', 'name']));
        expect(String(items[0].label)).toBe('id');
        const byLabel = new Map(items.map((item) => [String(item.label), item]));
        expect(byLabel.get('id')?.detail).toBe('integer');
        expect(byLabel.get('name')?.detail).toBe('text');
    });

    it('prioritizes table suggestions in FROM clause', async () => {
        const text = 'SELECT * FROM us';
        const analysis = analyzeSqlText(text, text.length);
        const items = await buildSqlCompletionItems(
            analysis,
            'us',
            { startLineNumber: 1, endLineNumber: 1, startColumn: text.length, endColumn: text.length },
            env,
        );

        expect(String(items[0].label)).toBe('users');
        expect(items[0].detail).toBe('Table - public');
    });

    it('attaches table metadata to table suggestions', async () => {
        const text = 'SELECT * FROM us';
        const analysis = analyzeSqlText(text, text.length);
        const items = await buildSqlCompletionItems(
            analysis,
            'us',
            createRange(text.length),
            env,
        );
        const users = items.find((item) => String(item.label) === 'users');
        expect(users).toBeTruthy();
        expect(isTableCompletionItem(users!)).toBe(true);
        if (isTableCompletionItem(users!)) {
            expect(users!.__zentroTableMeta).toMatchObject({
                schemaName: 'public',
                tableName: 'users',
                objectKind: 'table',
                profileKey: 'main',
                dbName: 'db1',
            });
        }
    });

    it('formats table documentation with full columns and data types', () => {
        const doc = formatTableSuggestionDocumentation(
            {
                schemaName: 'public',
                tableName: 'users',
                objectKind: 'table',
                profileKey: 'main',
                dbName: 'db1',
                driver: 'postgres',
            },
            [
                { Name: 'id', DataType: 'integer', IsPrimaryKey: true, IsNullable: false, DefaultValue: '' },
                { Name: 'name', DataType: 'text', IsNullable: true, DefaultValue: 'NULL' },
            ],
        );
        expect(doc.value).toContain('Table - public.users');
        expect(doc.value).toContain('<table');
        expect(doc.value).toContain('class="zentro-suggest-doc__table"');
        expect(doc.value).toContain('>Data Type<');
        expect(doc.value).toContain('>id<');
        expect(doc.value).toContain('>integer<');
        expect(doc.value).toContain('>PK<');
        expect(doc.supportHtml).toBe(true);
        expect(doc.isTrusted).toBe(true);
    });

    it('resolves table suggestion lazily on focus', async () => {
        const item = {
            label: 'users',
            kind: monacoStub.languages.CompletionItemKind.Module,
            __zentroTableMeta: {
                schemaName: 'public',
                tableName: 'users',
                objectKind: 'table',
                profileKey: 'main',
                dbName: 'db1',
                driver: 'postgres',
            },
        } as any;
        const fetchColumns = vi.fn(async () => [
            { Name: 'id', DataType: 'integer', IsPrimaryKey: true, IsNullable: false, DefaultValue: '' },
            { Name: 'name', DataType: 'text', IsNullable: true, DefaultValue: 'NULL' },
        ]);

        const resolved = await resolveTableSuggestionItem(item, {
            shouldAbort: () => false,
            fetchColumns,
        });
        expect(fetchColumns).toHaveBeenCalledTimes(1);
        expect((resolved.documentation as { value: string }).value).toContain('<table');
        expect((resolved.documentation as { value: string }).value).toContain('>id<');
        expect((resolved.documentation as { value: string }).value).toContain('>name<');
    });

    it('returns fallback documentation when lazy table metadata fetch fails', async () => {
        const item = {
            label: 'users',
            kind: monacoStub.languages.CompletionItemKind.Module,
            __zentroTableMeta: {
                schemaName: 'public',
                tableName: 'users',
                objectKind: 'table',
                profileKey: 'main',
                dbName: 'db1',
                driver: 'postgres',
            },
        } as any;

        const resolved = await resolveTableSuggestionItem(item, {
            shouldAbort: () => false,
            fetchColumns: vi.fn(async () => {
                throw new Error('boom');
            }),
        });
        expect((resolved.documentation as { value: string }).value).toContain('Unable to load column metadata');
    });

    it('auto-fills table alias using initials in FROM clause', async () => {
        const text = 'SELECT * FROM bl';
        const analysis = analyzeSqlText(text, text.length);
        const items = await buildSqlCompletionItems(
            analysis,
            'bl',
            createRange(text.length),
            {
                ...env,
                schemas: [{ Name: 'public', Tables: ['blocks'], Views: [] }],
            },
        );

        const blocks = items.find((item) => String(item.label) === 'blocks');
        expect(blocks?.insertText).toBe('blocks b;');
    });

    it('auto-fills alias initials for snake_case table names', async () => {
        const text = 'SELECT * FROM ord';
        const analysis = analyzeSqlText(text, text.length);
        const items = await buildSqlCompletionItems(
            analysis,
            'ord',
            createRange(text.length),
            {
                ...env,
                schemas: [{ Name: 'public', Tables: ['order_items'], Views: [] }],
            },
        );

        const target = items.find((item) => String(item.label) === 'order_items');
        expect(target?.insertText).toBe('order_items oi;');
    });

    it('keeps table insert text unqualified when name is unique across schemas', async () => {
        const text = 'SELECT * FROM inventory_bal';
        const analysis = analyzeSqlText(text, text.length);
        const items = await buildSqlCompletionItems(
            analysis,
            'inventory_bal',
            createRange(text.length),
            {
                ...env,
                driver: 'postgres',
                schemas: [
                    { Name: 'inv', Tables: ['inventory_balance'], Views: [] },
                    { Name: 'public', Tables: ['users'], Views: [] },
                ],
            },
        );

        const target = items.find((item) => String(item.label) === 'inventory_balance');
        expect(target?.insertText).toBe('inventory_balance ib;');
    });

    it('auto-qualifies insert text when table name is duplicated across schemas', async () => {
        const text = 'SELECT * FROM us';
        const analysis = analyzeSqlText(text, text.length);
        const items = await buildSqlCompletionItems(
            analysis,
            'us',
            createRange(text.length),
            {
                ...env,
                driver: 'postgres',
                schemas: [
                    { Name: 'inv', Tables: ['users'], Views: [] },
                    { Name: 'public', Tables: ['users'], Views: [] },
                ],
            },
        );

        const target = items.find((item) => String(item.label) === 'inv.users');
        expect(target?.insertText).toBe('"inv"."users" u;');
    });

    it('uses persisted current schema as fallback context for duplicate names', async () => {
        const text = 'SELECT * FROM us';
        const analysis = analyzeSqlText(text, text.length);
        const items = await buildSqlCompletionItems(
            analysis,
            'us',
            createRange(text.length),
            {
                ...env,
                driver: 'postgres',
                currentSchema: 'inv',
                schemas: [
                    { Name: 'inv', Tables: ['users'], Views: [] },
                    { Name: 'public', Tables: ['users'], Views: [] },
                ],
            },
        );

        const target = items.find((item) => String(item.label) === 'inv.users');
        expect(target?.insertText).toBe('users u;');
    });

    it('keeps duplicate table unqualified when current statement schema context matches', async () => {
        const text = 'SELECT * FROM inventory_balance ib JOIN us';
        const analysis = analyzeSqlText(text, text.length);
        const items = await buildSqlCompletionItems(
            analysis,
            'us',
            createRange(text.length),
            {
                ...env,
                driver: 'postgres',
                schemas: [
                    { Name: 'inv', Tables: ['inventory_balance', 'users'], Views: [] },
                    { Name: 'public', Tables: ['users'], Views: [] },
                ],
            },
        );

        const target = items.find((item) => String(item.label) === 'inv.users');
        expect(target?.insertText).toBe('users u');
    });

    it('keeps duplicate table qualified when selected schema differs from current context schema', async () => {
        const text = 'SELECT * FROM inventory_balance ib JOIN us';
        const analysis = analyzeSqlText(text, text.length);
        const items = await buildSqlCompletionItems(
            analysis,
            'us',
            createRange(text.length),
            {
                ...env,
                driver: 'postgres',
                schemas: [
                    { Name: 'inv', Tables: ['inventory_balance'], Views: [] },
                    { Name: 'public', Tables: ['users'] as string[], Views: [] },
                    { Name: 'ops', Tables: ['users'] as string[], Views: [] },
                ],
            },
        );

        const target = items.find((item) => String(item.label) === 'public.users');
        expect(target?.insertText).toBe('"public"."users" u');
    });

    it('prioritizes tables over keywords for matching prefixes', async () => {
        const text = 'SELECT * FROM a';
        const analysis = analyzeSqlText(text, text.length);
        const items = await buildSqlCompletionItems(
            analysis,
            'a',
            { startLineNumber: 1, endLineNumber: 1, startColumn: text.length, endColumn: text.length },
            env,
        );

        expect(String(items[0].label)).toBe('active_users');
    });

    it('prioritizes keyword suggestions for keyword prefixes', async () => {
        const text = 'se';
        const analysis = analyzeSqlText(text, text.length);
        const items = await buildSqlCompletionItems(
            analysis,
            'se',
            { startLineNumber: 1, endLineNumber: 1, startColumn: 1, endColumn: 3 },
            env,
        );

        expect(String(items[0].label)).toBe('SELECT');
    });

    it('adds trailing semicolon snippet for statement starter suggestion in unknown clause', async () => {
        const text = 'se';
        const analysis = analyzeSqlText(text, text.length);
        const items = await buildSqlCompletionItems(
            analysis,
            'se',
            { startLineNumber: 1, endLineNumber: 1, startColumn: 1, endColumn: 3 },
            env,
        );

        const selectItem = items.find((item) => String(item.label) === 'SELECT');
        expect(selectItem?.insertText).toBe('SELECT $0;');
        expect(selectItem?.insertTextRules).toBe(monacoStub.languages.CompletionItemInsertTextRule.InsertAsSnippet);
    });

    it('suggests relationship-based INNER JOIN snippets when typing jo', async () => {
        const text = 'SELECT * FROM inventory_balance ib jo';
        const analysis = analyzeSqlText(text, text.length);
        const items = await buildSqlCompletionItems(
            analysis,
            'jo',
            createRange(text.length),
            {
                ...env,
                schemas: [{ Name: 'inv', Tables: ['inventory_balance', 'inventory_lot_balance'], Views: [] }],
                fetchRelationships: vi.fn(async (schemaName: string, tableName: string) => {
                    if (schemaName === 'inv' && tableName === 'inventory_balance') {
                        return [{
                            ConstraintName: 'fk_inventory_balance_lot_balance',
                            SourceSchema: 'inv',
                            SourceTable: 'inventory_balance',
                            SourceColumn: 'balance_id',
                            TargetSchema: 'inv',
                            TargetTable: 'inventory_lot_balance',
                            TargetColumn: 'balance_id',
                        }];
                    }
                    return [];
                }),
            },
        );

        const joinSnippet = items.find((item) => String(item.label).startsWith('JOIN inv.inventory_lot_balance'));
        expect(joinSnippet).toBeTruthy();
        expect(String(joinSnippet?.insertText)).toContain('INNER JOIN inv.inventory_lot_balance ilb ON ib.balance_id = ilb.balance_id');
        expect(items.findIndex((item) => String(item.label).startsWith('JOIN inv.inventory_lot_balance')))
            .toBeLessThan(items.findIndex((item) => String(item.label) === 'JOIN'));
        const plainJoin = items.find((item) => String(item.label) === 'JOIN');
        expect(plainJoin).toBeTruthy();
    });

    it('suggests relationship JOIN snippet when Monaco word extraction is empty but trailing token is jo', async () => {
        const text = 'SELECT * FROM inventory_balance ib jo';
        const analysis = analyzeSqlText(text, text.length);
        const items = await buildSqlCompletionItems(
            analysis,
            '',
            createRange(text.length),
            {
                ...env,
                schemas: [{ Name: 'inv', Tables: ['inventory_balance', 'inventory_lot_balance'], Views: [] }],
                fetchRelationships: vi.fn(async () => [{
                    ConstraintName: 'fk_inventory_balance_lot_balance',
                    SourceSchema: 'inv',
                    SourceTable: 'inventory_balance',
                    SourceColumn: 'balance_id',
                    TargetSchema: 'inv',
                    TargetTable: 'inventory_lot_balance',
                    TargetColumn: 'balance_id',
                }]),
            },
        );

        expect(items.some((item) => String(item.label).startsWith('JOIN inv.inventory_lot_balance'))).toBe(true);
    });

    it('builds ON clause for reverse relationship direction and dedupes alias', async () => {
        const text = 'SELECT * FROM inventory_balance ib jo';
        const analysis = analyzeSqlText(text, text.length);
        const items = await buildSqlCompletionItems(
            analysis,
            'jo',
            createRange(text.length),
            {
                ...env,
                schemas: [{ Name: 'inv', Tables: ['inventory_balance', 'inventory_batch'], Views: [] }],
                fetchRelationships: vi.fn(async () => [{
                    ConstraintName: 'fk_inventory_batch_balance',
                    SourceSchema: 'inv',
                    SourceTable: 'inventory_batch',
                    SourceColumn: 'id',
                    TargetSchema: 'inv',
                    TargetTable: 'inventory_balance',
                    TargetColumn: 'batch_id',
                }]),
            },
        );
        const joinItem = items.find((item) => String(item.label).startsWith('JOIN inv.inventory_batch'));
        expect(joinItem).toBeTruthy();
        expect(String(joinItem?.insertText)).toContain('INNER JOIN inv.inventory_batch ib2 ON ib.batch_id = ib2.id');
    });

    it('groups multi-column relationships into single JOIN ON with AND', async () => {
        const text = 'SELECT * FROM inventory_balance ib jo';
        const analysis = analyzeSqlText(text, text.length);
        const items = await buildSqlCompletionItems(
            analysis,
            'jo',
            createRange(text.length),
            {
                ...env,
                schemas: [{ Name: 'inv', Tables: ['inventory_balance', 'inventory_ledger'], Views: [] }],
                fetchRelationships: vi.fn(async () => [
                    {
                        ConstraintName: 'fk_inventory_balance_ledger',
                        SourceSchema: 'inv',
                        SourceTable: 'inventory_balance',
                        SourceColumn: 'store_id',
                        TargetSchema: 'inv',
                        TargetTable: 'inventory_ledger',
                        TargetColumn: 'store_id',
                    },
                    {
                        ConstraintName: 'fk_inventory_balance_ledger',
                        SourceSchema: 'inv',
                        SourceTable: 'inventory_balance',
                        SourceColumn: 'item_id',
                        TargetSchema: 'inv',
                        TargetTable: 'inventory_ledger',
                        TargetColumn: 'item_id',
                    },
                ]),
            },
        );
        const joinItem = items.find((item) => String(item.label).startsWith('JOIN inv.inventory_ledger'));
        expect(joinItem).toBeTruthy();
        expect(String(joinItem?.insertText)).toContain('ib.store_id = il.store_id AND ib.item_id = il.item_id');
    });

    it('keeps default behavior when relationship fetch returns empty', async () => {
        const text = 'SELECT * FROM inventory_balance ib jo';
        const analysis = analyzeSqlText(text, text.length);
        const items = await buildSqlCompletionItems(
            analysis,
            'jo',
            createRange(text.length),
            {
                ...env,
                schemas: [{ Name: 'inv', Tables: ['inventory_balance'], Views: [] }],
                fetchRelationships: vi.fn(async () => []),
            },
        );
        expect(items.some((item) => String(item.label).startsWith('JOIN inv.'))).toBe(false);
        expect(items.some((item) => String(item.label) === 'JOIN')).toBe(true);
    });

    it('suggests relationship JOIN snippets after ON clause when typing jo again', async () => {
        const text = 'SELECT * FROM inventory_count_header ich INNER JOIN inv.inventory_document_header idh ON ich.adjustment_document_id = idh.document_id INNER JOIN inv.inventory_transaction it ON idh.document_id = it.document_id jo';
        const analysis = analyzeSqlText(text, text.length);
        const items = await buildSqlCompletionItems(
            analysis,
            'jo',
            createRange(text.length),
            {
                ...env,
                schemas: [{
                    Name: 'inv',
                    Tables: [
                        'inventory_count_header',
                        'inventory_document_header',
                        'inventory_transaction',
                        'inventory_balance',
                    ],
                    Views: [],
                }],
                fetchRelationships: vi.fn(async (schemaName: string, tableName: string) => {
                    if (schemaName === 'inv' && tableName === 'inventory_transaction') {
                        return [{
                            ConstraintName: 'fk_transaction_balance',
                            SourceSchema: 'inv',
                            SourceTable: 'inventory_transaction',
                            SourceColumn: 'balance_id',
                            TargetSchema: 'inv',
                            TargetTable: 'inventory_balance',
                            TargetColumn: 'balance_id',
                        }];
                    }
                    return [];
                }),
            },
        );

        const joinSnippet = items.find((item) => String(item.label).startsWith('JOIN inv.inventory_balance'));
        expect(joinSnippet).toBeTruthy();
        expect(String(joinSnippet?.insertText)).toContain('INNER JOIN inv.inventory_balance ib ON it.balance_id = ib.balance_id');
    });

    it('suggests all aliases and alias-qualified columns in WHERE clause', async () => {
        const text = 'SELECT * FROM "inv"."inventory_balance" ib INNER JOIN inv.inventory_lot il ON ib.lot_id = il.lot_id WHERE i';
        const analysis = analyzeSqlText(text, text.length);
        const items = await buildSqlCompletionItems(
            analysis,
            'i',
            createRange(text.length),
            {
                ...env,
                driver: 'postgres',
                schemas: [
                    { Name: 'inv', Tables: ['inventory_balance', 'inventory_lot'], Views: [] },
                ],
                fetchColumns: vi.fn(async (schemaName: string, tableName: string) => {
                    if (schemaName === 'inv' && tableName === 'inventory_balance') {
                        return [
                            { Name: 'item_id', DataType: 'uuid' },
                            { Name: 'in_transit_qty', DataType: 'numeric' },
                        ];
                    }
                    if (schemaName === 'inv' && tableName === 'inventory_lot') {
                        return [
                            { Name: 'item_id', DataType: 'uuid' },
                            { Name: 'lot_id', DataType: 'uuid' },
                        ];
                    }
                    return [];
                }),
            },
        );

        const labels = items.map((item) => String(item.label));
        expect(labels).toContain('ib');
        expect(labels).toContain('il');
        expect(labels).toContain('ib.item_id');
        expect(labels).toContain('ib.in_transit_qty');
        expect(labels).toContain('il.item_id');
        expect(labels).toContain('il.lot_id');
    });

    it('falls back to previous source table when last joined table has no relationships', async () => {
        const text = 'SELECT * FROM inventory_count_header ich INNER JOIN inv.inventory_count_line icl ON ich.count_id = icl.count_id jo';
        const analysis = analyzeSqlText(text, text.length);
        const items = await buildSqlCompletionItems(
            analysis,
            'jo',
            createRange(text.length),
            {
                ...env,
                schemas: [{
                    Name: 'inv',
                    Tables: ['inventory_count_header', 'inventory_count_line', 'inventory_document_header'],
                    Views: [],
                }],
                fetchRelationships: vi.fn(async (schemaName: string, tableName: string) => {
                    if (schemaName === 'inv' && tableName === 'inventory_count_line') return [];
                    if (schemaName === 'inv' && tableName === 'inventory_count_header') {
                        return [{
                            ConstraintName: 'fk_count_header_document',
                            SourceSchema: 'inv',
                            SourceTable: 'inventory_count_header',
                            SourceColumn: 'document_id',
                            TargetSchema: 'inv',
                            TargetTable: 'inventory_document_header',
                            TargetColumn: 'document_id',
                        }];
                    }
                    return [];
                }),
            },
        );

        const joinSnippet = items.find((item) => String(item.label).startsWith('JOIN inv.inventory_document_header'));
        expect(joinSnippet).toBeTruthy();
        expect(String(joinSnippet?.insertText)).toContain('INNER JOIN inv.inventory_document_header idh ON ich.document_id = idh.document_id');
    });

    it('does not infer schema for join snippets when unqualified source is ambiguous', async () => {
        const text = 'SELECT * FROM inventory_balance ib jo';
        const analysis = analyzeSqlText(text, text.length);
        const items = await buildSqlCompletionItems(
            analysis,
            'jo',
            createRange(text.length),
            {
                ...env,
                schemas: [
                    { Name: 'inv', Tables: ['inventory_balance', 'inventory_lot_balance'], Views: [] },
                    { Name: 'public', Tables: ['inventory_balance'], Views: [] },
                ],
                fetchRelationships: vi.fn(async (schemaName: string, tableName: string) => {
                    if (schemaName === 'inv' && tableName === 'inventory_balance') {
                        return [{
                            ConstraintName: 'fk_inventory_balance_lot_balance',
                            SourceSchema: 'inv',
                            SourceTable: 'inventory_balance',
                            SourceColumn: 'balance_id',
                            TargetSchema: 'inv',
                            TargetTable: 'inventory_lot_balance',
                            TargetColumn: 'balance_id',
                        }];
                    }
                    return [];
                }),
            },
        );

        expect(items.some((item) => String(item.label).startsWith('JOIN inv.inventory_lot_balance'))).toBe(false);
        expect(items.some((item) => String(item.label) === 'JOIN')).toBe(true);
    });

    it('always includes keyword suggestions when active db schema is missing', async () => {
        const text = 'sel';
        const analysis = analyzeSqlText(text, text.length);
        const items = await buildSqlCompletionItems(
            analysis,
            'sel',
            createRange(3),
            {
                ...env,
                schemas: [],
                templates: [
                    { trigger: 'sel_all', name: 'Select all', content: 'SELECT * FROM $1;' },
                ],
            },
        );

        const labels = items.map((item) => String(item.label));
        expect(labels).toContain('SELECT');
        expect(labels).toContain('sel_all');
        const selectItem = items.find((item) => String(item.label) === 'SELECT');
        expect(selectItem?.insertText).toBe('SELECT $0;');
    });

    it('adds driver-specific keyword suggestions', async () => {
        const text = 'ILI';
        const analysis = analyzeSqlText(text, text.length);
        const items = await buildSqlCompletionItems(
            analysis,
            'ILI',
            createRange(3),
            {
                ...env,
                driver: 'postgres',
                schemas: [],
            },
        );

        expect(items.map((item) => String(item.label))).toContain('ILIKE');
    });

    it('quotes spaced table names by driver and appends alias initials', async () => {
        const text = 'SELECT * FROM sal';
        const analysis = analyzeSqlText(text, text.length);
        const drivers: Array<{ driver: string; expected: string }> = [
            { driver: 'postgres', expected: '"sales order" so;' },
            { driver: 'mysql', expected: '`sales order` so;' },
            { driver: 'sqlserver', expected: '[sales order] so;' },
            { driver: 'sqlite', expected: '"sales order" so;' },
        ];

        for (const { driver, expected } of drivers) {
            const items = await buildSqlCompletionItems(
                analysis,
                'sal',
                createRange(text.length),
                {
                    ...env,
                    driver,
                    schemas: [{ Name: 'public', Tables: ['sales order'], Views: [] }],
                },
            );

            const target = items.find((item) => String(item.label) === 'sales order');
            expect(target?.insertText).toBe(expected);
        }
    });

    it('keeps spaced table names unqualified when unique across schemas', async () => {
        const text = 'SELECT * FROM inv';
        const analysis = analyzeSqlText(text, text.length);
        const items = await buildSqlCompletionItems(
            analysis,
            'inv',
            createRange(text.length),
            {
                ...env,
                driver: 'postgres',
                schemas: [
                    { Name: 'inv', Tables: ['inventory balance'], Views: [] },
                    { Name: 'public', Tables: ['users'], Views: [] },
                ],
            },
        );

        const target = items.find((item) => String(item.label) === 'inventory balance');
        expect(target?.insertText).toBe('"inventory balance" ib;');
    });

    it('uses strict db context key when resolving schemas', () => {
        const trees = {
            'main:db1': [{ Name: 'public', Tables: ['users'], Views: [] }],
            'main:db2': [{ Name: 'public', Tables: ['orders'], Views: [] }],
        };

        const schemas = getSchemasForActiveDatabase(trees, 'main', 'db1');
        expect(schemas).toHaveLength(1);
        expect(schemas[0].Tables).toEqual(['users']);
    });

    it('drops stale suggestions when request is aborted mid-flight', async () => {
        let resolveFetch: ((value: Array<{ Name: string }>) => void) | undefined;
        let aborted = false;
        const fetchColumns = vi.fn(() => new Promise<Array<{ Name: string }>>((resolve) => {
            resolveFetch = resolve;
        }));

        const text = 'SELECT * FROM users u WHERE u.';
        const analysis = analyzeSqlText(text, text.length);
        const promise = buildSqlCompletionItems(
            analysis,
            '',
            createRange(text.length),
            {
                ...env,
                fetchColumns: fetchColumns as any,
            },
            {
                shouldAbort: () => aborted,
            },
        );

        aborted = true;
        if (resolveFetch) {
            resolveFetch([{ Name: 'id' }]);
        }

        const items = await promise;
        expect(items).toEqual([]);
    });
});
