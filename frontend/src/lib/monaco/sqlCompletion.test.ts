import { describe, expect, it, vi } from 'vitest';
import {
    analyzeSqlText,
    buildSqlCompletionItems,
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
});
