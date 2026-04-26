import { languages } from 'monaco-editor';
import { SQL_FUNCTIONS } from './sqlCompletionConstants';
import { SqlAnalysis, SqlClause, SuggestionRecord } from './sqlCompletionTypes';

export function buildSelectLikeSuggestions(
    addKeyword: (label: string, insertText?: string, priority?: number) => void,
    addFunction: (label: string, snippet?: string, priority?: number) => void,
    addText: (label: string, insertText?: string, priority?: number) => void,
    addOperator: (label: string, insertText?: string, priority?: number) => void,
) {
    addKeyword('SELECT', 'SELECT ', 5);
    ['CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'NULL', 'NOT', 'IN', 'BETWEEN', 'LIKE', 'EXISTS']
        .forEach((kw) => addKeyword(kw, kw, 210));
    SQL_FUNCTIONS.forEach((fn) => addFunction(fn, `${fn}($1)`, 120));
    addText('*', '*', 10);
    ['=', '<>', '!=', '>', '<', '>=', '<='].forEach((op) => addOperator(op, `${op} `, 60));
}

export function normalizeInsertClause(analysis: SqlAnalysis): SqlClause | 'insertColumns' {
    if (analysis.clause === 'insert' && /\binsert\s+into\b[\s\S]*\(\s*$/i.test(analysis.statementText)) return 'insertColumns';
    return analysis.clause;
}

export function makeSortText(priority: number, label: string): string {
    return `${String(Math.max(0, priority)).padStart(4, '0')}_${label.toLowerCase()}`;
}

export function finalizeSuggestions(suggestionMap: Map<string, SuggestionRecord>): languages.CompletionItem[] {
    return Array.from(suggestionMap.values())
        .sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority;
            const aLabel = String(a.item.label);
            const bLabel = String(b.item.label);
            return aLabel.localeCompare(bLabel);
        })
        .map((record) => record.item);
}

export function getOffsetAtPosition(text: string, position: { lineNumber: number; column: number }): number {
    const lines = text.split(/\r?\n/);
    let offset = 0;
    for (let i = 0; i < Math.max(0, position.lineNumber - 1); i++) offset += (lines[i]?.length ?? 0) + 1;
    offset += Math.max(0, position.column - 1);
    return Math.min(offset, text.length);
}
