import { SqlClause, SqlToken } from './sqlCompletionTypes';
import { normalizeIdentifier } from './sqlCompletionIdentifiers';

export function tokenizeSql(text: string): { tokens: SqlToken[]; finalDepth: number } {
    const tokens: SqlToken[] = [];
    let depth = 0;
    let i = 0;
    let inSingle = false;
    let inLineComment = false;
    let inBlockComment = false;

    while (i < text.length) {
        const ch = text[i];
        const next = text[i + 1];

        if (inLineComment) {
            if (ch === '\n') inLineComment = false;
            i++;
            continue;
        }
        if (inBlockComment) {
            if (ch === '*' && next === '/') {
                inBlockComment = false;
                i += 2;
                continue;
            }
            i++;
            continue;
        }
        if (inSingle) {
            if (ch === '\'' && next === '\'') {
                i += 2;
                continue;
            }
            if (ch === '\'') inSingle = false;
            i++;
            continue;
        }

        if (ch === '-' && next === '-') {
            inLineComment = true;
            i += 2;
            continue;
        }
        if (ch === '/' && next === '*') {
            inBlockComment = true;
            i += 2;
            continue;
        }
        if (ch === '\'') {
            inSingle = true;
            i++;
            continue;
        }
        if (/\s/.test(ch)) {
            i++;
            continue;
        }

        if (ch === '(' || ch === ')' || ch === ',' || ch === ';' || ch === '.') {
            tokens.push({ value: ch, start: i, end: i + 1, depth });
            if (ch === '(') depth++;
            if (ch === ')' && depth > 0) depth--;
            i++;
            continue;
        }

        if (ch === '"' || ch === '`' || ch === '[') {
            const quote = ch === '[' ? ']' : ch;
            const start = i;
            i++;
            while (i < text.length && text[i] !== quote) i++;
            if (i < text.length) i++;
            tokens.push({ value: text.slice(start, i), start, end: i, depth });
            continue;
        }

        if (isIdentifierChar(ch)) {
            const start = i;
            i++;
            while (i < text.length && isIdentifierChar(text[i])) i++;
            tokens.push({ value: text.slice(start, i), start, end: i, depth });
            continue;
        }

        tokens.push({ value: ch, start: i, end: i + 1, depth });
        i++;
    }

    return { tokens, finalDepth: depth };
}

function isIdentifierChar(ch: string): boolean {
    return /[A-Za-z0-9_$]/.test(ch);
}

export function detectClause(tokens: SqlToken[], depth: number): SqlClause {
    let clause: SqlClause = 'unknown';
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (token.depth !== depth) continue;
        const word = normalizeIdentifier(token.value);
        const nextWord = normalizeIdentifier(tokens[i + 1]?.value || '');

        if (word === 'select') clause = 'select';
        else if (word === 'from') clause = 'from';
        else if (isJoinWord(word, nextWord)) clause = 'join';
        else if (word === 'where') clause = 'where';
        else if (word === 'having') clause = 'having';
        else if (word === 'group' && nextWord === 'by') clause = 'groupBy';
        else if (word === 'order' && nextWord === 'by') clause = 'orderBy';
        else if (word === 'insert') clause = 'insert';
        else if (word === 'values') clause = 'values';
        else if (word === 'update') clause = 'update';
        else if (word === 'set') clause = 'set';
        else if (word === 'delete') clause = 'delete';
        else if (word === 'create' && nextWord === 'table') clause = 'createTable';
        else if (word === 'create' && nextWord === 'view') clause = 'createView';
        else if (word === 'alter' && nextWord === 'table') clause = 'alterTable';
        else if (word === 'on') clause = 'on';
        else if (word === 'with') clause = 'with';
    }
    return clause;
}

function isJoinWord(word: string, nextWord: string): boolean {
    if (word === 'join') return true;
    if (word === 'inner' && nextWord === 'join') return true;
    if (word === 'left' && nextWord === 'join') return true;
    if (word === 'right' && nextWord === 'join') return true;
    if (word === 'full' && nextWord === 'join') return true;
    return false;
}

export function isIdentifierLike(value: string): boolean {
    return /^[A-Za-z_][\w$]*$/.test(value) || /^"[^"]+"$/.test(value) || /^`[^`]+`$/.test(value) || /^\[[^\]]+\]$/.test(value);
}

export function isClauseBoundary(word: string): boolean {
    return [
        'where', 'group', 'order', 'having', 'limit', 'offset', 'union', 'except', 'intersect',
        'join', 'inner', 'left', 'right', 'full', 'cross', 'on', 'set', 'values',
    ].includes(word);
}
