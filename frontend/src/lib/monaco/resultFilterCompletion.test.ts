import { describe, expect, it } from 'vitest';
import { buildResultFilterCompletionItems } from './resultFilterCompletion';
import type { SqlCompletionEnv } from './sqlCompletion';

const monacoStub: SqlCompletionEnv['monaco'] = {
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

function createRange(column: number) {
    return { startLineNumber: 1, endLineNumber: 1, startColumn: column, endColumn: column };
}

describe('resultFilterCompletion', () => {
    it('prioritizes result columns above keyword suggestions for matching prefixes', async () => {
        const suggestions = await buildResultFilterCompletionItems({
            monaco: monacoStub as any,
            filterText: 'd',
            cursorOffset: 1,
            currentWord: 'd',
            range: createRange(2),
            columns: ['document_id'],
            driver: 'postgres',
        });

        const labels = suggestions.map((item) => String(item.label));
        expect(labels).toContain('document_id');
        expect(labels).toContain('DISTINCT');
        expect(labels.indexOf('document_id')).toBeLessThan(labels.indexOf('DISTINCT'));
    });

    it('matches columns case-insensitively', async () => {
        const suggestions = await buildResultFilterCompletionItems({
            monaco: monacoStub as any,
            filterText: 'DOC',
            cursorOffset: 3,
            currentWord: 'DOC',
            range: createRange(4),
            columns: ['document_id'],
            driver: 'postgres',
        });

        expect(suggestions.map((item) => String(item.label))).toContain('document_id');
    });

    it('suppresses completions while cursor is in comment or string context', async () => {
        const suggestions = await buildResultFilterCompletionItems({
            monaco: monacoStub as any,
            filterText: "-- only comment",
            cursorOffset: 15,
            currentWord: '',
            range: createRange(16),
            columns: ['document_id'],
            driver: 'postgres',
        });

        expect(suggestions).toEqual([]);
    });
});
