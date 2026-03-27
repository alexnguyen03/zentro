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
        expect(blocks?.insertText).toBe('blocks b');
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
        expect(target?.insertText).toBe('order_items oi');
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
            { driver: 'postgres', expected: '"sales order" so' },
            { driver: 'mysql', expected: '`sales order` so' },
            { driver: 'sqlserver', expected: '[sales order] so' },
            { driver: 'sqlite', expected: '"sales order" so' },
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
