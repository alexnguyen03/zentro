import { describe, expect, it, vi } from 'vitest';
import {
    analyzeSqlText,
    buildSqlCompletionItems,
    getSchemasForActiveDatabase,
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
