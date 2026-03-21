import { languages } from 'monaco-editor';
import { useConnectionStore } from '../../stores/connectionStore';
import { SchemaNode, useSchemaStore } from '../../stores/schemaStore';
import { useTemplateStore } from '../../stores/templateStore';
import { getTypesForDriver } from '../dbTypes';

type CompletionKind = number;

export type SqlClause =
    | 'unknown'
    | 'select'
    | 'from'
    | 'join'
    | 'where'
    | 'having'
    | 'groupBy'
    | 'orderBy'
    | 'insert'
    | 'insertColumns'
    | 'values'
    | 'update'
    | 'set'
    | 'delete'
    | 'createTable'
    | 'createView'
    | 'alterTable'
    | 'on'
    | 'with';

export interface SqlToken {
    value: string;
    start: number;
    end: number;
    depth: number;
}

export interface SqlColumnLike {
    Name: string;
    DataType?: string;
    IsPrimaryKey?: boolean;
}

export interface SqlTemplateLike {
    trigger: string;
    name: string;
    content: string;
}

export interface SqlSourceRef {
    kind: 'table' | 'view' | 'cte' | 'subquery';
    name: string;
    schemaName?: string;
    alias?: string;
    columns?: string[];
}

export interface SqlAnalysis {
    fullText: string;
    statementText: string;
    statementStartOffset: number;
    cursorOffset: number;
    cursorDepth: number;
    clause: SqlClause;
    isInCommentOrString: boolean;
    afterDot: boolean;
    dotIdentifier: string;
    sources: SqlSourceRef[];
    ctes: Map<string, SqlSourceRef>;
}

export interface SqlCompletionEnv {
    monaco: any;
    schemas: SchemaNode[];
    driver: string;
    fetchColumns: (schemaName: string, tableName: string) => Promise<SqlColumnLike[]>;
    templates: SqlTemplateLike[];
}

interface SuggestionRecord {
    priority: number;
    item: languages.CompletionItem;
}

const SQL_KEYWORDS = [
    'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN',
    'OUTER JOIN', 'ON', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'INSERT INTO',
    'VALUES', 'UPDATE', 'SET', 'DELETE FROM', 'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE',
    'CREATE VIEW', 'DROP VIEW', 'CREATE INDEX', 'DROP INDEX', 'PRIMARY KEY', 'FOREIGN KEY',
    'AS', 'DISTINCT', 'UNION', 'ALL', 'IN', 'BETWEEN', 'LIKE', 'IS NULL', 'IS NOT NULL',
    'EXISTS', 'ANY', 'SOME', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'ASC', 'DESC', 'NULL', 'NOT',
    'WITH', 'DEFAULT', 'RETURNING', 'USING', 'EXPLAIN'
];

const SQL_FUNCTIONS = [
    'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE', 'CONCAT', 'SUBSTRING', 'LENGTH', 'UPPER',
    'LOWER', 'TRIM', 'NOW', 'DATE', 'CAST', 'ROUND', 'FLOOR', 'CEIL', 'ABS', 'CURRENT_TIMESTAMP'
];

const SQL_OPERATORS = [
    '=', '<>', '!=', '>', '<', '>=', '<=', 'LIKE', 'IN', 'BETWEEN', 'IS NULL', 'IS NOT NULL'
];

const SELECT_LIKE_CLAUSES = new Set<SqlClause>(['select', 'where', 'having', 'groupBy', 'orderBy', 'on', 'set', 'createView']);
const COLUMN_LIKE_CLAUSES = new Set<SqlClause>(['select', 'where', 'having', 'groupBy', 'orderBy', 'on', 'set', 'insertColumns', 'createView']);
const TABLE_LIKE_CLAUSES = new Set<SqlClause>(['from', 'join', 'insert', 'update', 'delete']);

const DISPOSABLES_KEY = '__ZENTRO_SQL_COMPLETION_DISPOSABLES__';

if (!(window as any)[DISPOSABLES_KEY]) {
    (window as any)[DISPOSABLES_KEY] = [];
}

export function analyzeSqlText(fullText: string, cursorOffset: number): SqlAnalysis {
    const cursor = Math.max(0, Math.min(cursorOffset, fullText.length));
    const statementStartOffset = findStatementStartOffset(fullText, cursor);
    const statementText = fullText.slice(statementStartOffset, cursor);
    const tokenization = tokenizeSql(statementText);
    const cursorDepth = tokenization.finalDepth;
    const clause = detectClause(tokenization.tokens, cursorDepth);
    const isInCommentOrString = isInsideLineCommentOrString(statementText);
    const afterDotMatch = statementText.match(/([A-Za-z_][\w$]*|"[^"]+"|`[^`]+`|\[[^\]]+\])\.$/);
    const dotIdentifier = afterDotMatch ? normalizeIdentifier(afterDotMatch[1]) : '';
    const ctes = extractCtes(statementText);
    const sources = extractSources(statementText, tokenization.tokens, cursorDepth, ctes);

    return {
        fullText,
        statementText,
        statementStartOffset,
        cursorOffset: cursor,
        cursorDepth,
        clause,
        isInCommentOrString,
        afterDot: Boolean(afterDotMatch),
        dotIdentifier,
        sources,
        ctes,
    };
}

function findStatementStartOffset(text: string, cursorOffset: number): number {
    let start = 0;
    let depth = 0;
    let inSingle = false;
    let inLineComment = false;
    let inBlockComment = false;

    for (let i = 0; i < cursorOffset; i++) {
        const ch = text[i];
        const next = text[i + 1];

        if (inLineComment) {
            if (ch === '\n') inLineComment = false;
            continue;
        }

        if (inBlockComment) {
            if (ch === '*' && next === '/') {
                inBlockComment = false;
                i++;
            }
            continue;
        }

        if (inSingle) {
            if (ch === '\'' && next === '\'') {
                i++;
                continue;
            }
            if (ch === '\'') inSingle = false;
            continue;
        }

        if (ch === '-' && next === '-') {
            inLineComment = true;
            i++;
            continue;
        }
        if (ch === '/' && next === '*') {
            inBlockComment = true;
            i++;
            continue;
        }
        if (ch === '\'') {
            inSingle = true;
            continue;
        }
        if (ch === '(') {
            depth++;
        } else if (ch === ')' && depth > 0) {
            depth--;
        } else if (ch === ';' && depth === 0) {
            start = i + 1;
        }
    }

    return start;
}

function isInsideLineCommentOrString(text: string): boolean {
    let inSingle = false;
    let inLineComment = false;
    let inBlockComment = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const next = text[i + 1];

        if (inLineComment) {
            if (ch === '\n') inLineComment = false;
            continue;
        }

        if (inBlockComment) {
            if (ch === '*' && next === '/') {
                inBlockComment = false;
                i++;
            }
            continue;
        }

        if (inSingle) {
            if (ch === '\'' && next === '\'') {
                i++;
                continue;
            }
            if (ch === '\'') inSingle = false;
            continue;
        }

        if (ch === '-' && next === '-') {
            inLineComment = true;
            i++;
            continue;
        }
        if (ch === '/' && next === '*') {
            inBlockComment = true;
            i++;
            continue;
        }
        if (ch === '\'') {
            inSingle = true;
        }
    }

    return inSingle || inLineComment || inBlockComment;
}

function tokenizeSql(text: string): { tokens: SqlToken[]; finalDepth: number } {
    const tokens: SqlToken[] = [];
    let depth = 0;

    for (let i = 0; i < text.length;) {
        const ch = text[i];
        const next = text[i + 1];

        if (/\s/.test(ch)) {
            i++;
            continue;
        }

        if (ch === '-' && next === '-') {
            i += 2;
            while (i < text.length && text[i] !== '\n') i++;
            continue;
        }

        if (ch === '/' && next === '*') {
            i += 2;
            while (i < text.length - 1 && !(text[i] === '*' && text[i + 1] === '/')) i++;
            i += 2;
            continue;
        }

        if (ch === '\'') {
            i++;
            while (i < text.length) {
                if (text[i] === '\'' && text[i + 1] === '\'') {
                    i += 2;
                    continue;
                }
                if (text[i] === '\'') {
                    i++;
                    break;
                }
                i++;
            }
            continue;
        }

        if (ch === '"' || ch === '`') {
            const quote = ch;
            const start = i;
            i++;
            let value = '';
            while (i < text.length) {
                if (text[i] === quote && text[i + 1] === quote) {
                    value += quote;
                    i += 2;
                    continue;
                }
                if (text[i] === quote) {
                    i++;
                    break;
                }
                value += text[i];
                i++;
            }
            tokens.push({ value, start, end: i, depth });
            continue;
        }

        if (ch === '[') {
            const start = i;
            i++;
            let value = '';
            while (i < text.length) {
                if (text[i] === ']' && text[i + 1] === ']') {
                    value += ']';
                    i += 2;
                    continue;
                }
                if (text[i] === ']') {
                    i++;
                    break;
                }
                value += text[i];
                i++;
            }
            tokens.push({ value, start, end: i, depth });
            continue;
        }

        if (isIdentifierChar(ch)) {
            const start = i;
            let value = '';
            while (i < text.length && isIdentifierChar(text[i])) {
                value += text[i];
                i++;
            }
            tokens.push({ value, start, end: i, depth });
            continue;
        }

        if ('().,;*<>!=+-/%'.includes(ch)) {
            const start = i;
            if (ch === '(') {
                tokens.push({ value: ch, start, end: i + 1, depth });
                depth++;
                i++;
                continue;
            }
            if (ch === ')') {
                depth = Math.max(0, depth - 1);
                tokens.push({ value: ch, start, end: i + 1, depth });
                i++;
                continue;
            }
            if ((ch === '<' || ch === '>' || ch === '!') && (next === '=' || (ch === '<' && next === '>'))) {
                tokens.push({ value: `${ch}${next}`, start, end: i + 2, depth });
                i += 2;
                continue;
            }
            if (ch === '-' && next === '>') {
                tokens.push({ value: '->', start, end: i + 2, depth });
                i += 2;
                continue;
            }
            tokens.push({ value: ch, start, end: i + 1, depth });
            i++;
            continue;
        }

        i++;
    }

    return { tokens, finalDepth: depth };
}

function isIdentifierChar(ch: string): boolean {
    return /[A-Za-z0-9_$]/.test(ch);
}

function detectClause(tokens: SqlToken[], depth: number): SqlClause {
    let clause: SqlClause = 'unknown';

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (token.depth !== depth) continue;
        const word = normalizeIdentifier(token.value);
        const nextWord = normalizeIdentifier(tokens[i + 1]?.value ?? '');

        if (word === 'select') clause = 'select';
        else if (word === 'from') clause = 'from';
        else if (word === 'where') clause = 'where';
        else if (word === 'having') clause = 'having';
        else if (word === 'group' && nextWord === 'by') clause = 'groupBy';
        else if (word === 'order' && nextWord === 'by') clause = 'orderBy';
        else if (word === 'insert' && nextWord === 'into') clause = 'insert';
        else if (word === 'values') clause = 'values';
        else if (word === 'update') clause = 'update';
        else if (word === 'set') clause = 'set';
        else if (word === 'delete' && nextWord === 'from') clause = 'delete';
        else if (word === 'create' && nextWord === 'table') clause = 'createTable';
        else if (word === 'create' && nextWord === 'view') clause = 'createView';
        else if (word === 'alter' && nextWord === 'table') clause = 'alterTable';
        else if (word === 'with') clause = 'with';
        else if (word === 'on') clause = 'on';
        else if (isJoinWord(word, nextWord)) clause = 'join';
    }

    return clause;
}

function isJoinWord(word: string, nextWord: string): boolean {
    if (word === 'join') return true;
    return (
        (word === 'inner' || word === 'left' || word === 'right' || word === 'full' || word === 'outer' || word === 'cross')
        && nextWord === 'join'
    );
}

function isIdentifierLike(value: string): boolean {
    return /^[A-Za-z_][\w$]*$/.test(value) || /^".*"$/.test(value) || /^`.*`$/.test(value) || /^\[.*\]$/.test(value);
}

function isClauseBoundary(word: string): boolean {
    return [
        'select', 'from', 'where', 'having', 'group', 'order', 'insert', 'values', 'update', 'set', 'delete',
        'create', 'alter', 'join', 'on', 'limit', 'offset', 'union', 'except', 'intersect', 'returning', 'with',
    ].includes(word);
}

function normalizeIdentifier(value: string): string {
    return stripIdentifierQuotes(String(value || '')).trim().toLowerCase();
}

function stripIdentifierQuotes(value: string): string {
    const trimmed = String(value || '').trim();
    if (!trimmed) return '';
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith('`') && trimmed.endsWith('`'))) {
        return trimmed.slice(1, -1);
    }
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
}

function extractCtes(statementText: string): Map<string, SqlSourceRef> {
    const { tokens } = tokenizeSql(statementText);
    const ctes = new Map<string, SqlSourceRef>();
    const withIndex = tokens.findIndex((token) => token.depth === 0 && normalizeIdentifier(token.value) === 'with');
    if (withIndex === -1) return ctes;

    let i = withIndex + 1;
    while (i < tokens.length) {
        while (i < tokens.length && tokens[i].depth === 0 && tokens[i].value === ',') i++;
        if (i >= tokens.length) break;

        const nameToken = tokens[i];
        if (nameToken.depth !== 0 || !isIdentifierLike(nameToken.value)) break;
        const name = nameToken.value;
        i++;

        while (i < tokens.length && tokens[i].depth === 0 && normalizeIdentifier(tokens[i].value) === 'as') i++;
        if (i >= tokens.length || tokens[i].value !== '(') break;

        const openToken = tokens[i];
        const closeOffset = findMatchingParenFrom(statementText, openToken.start);
        const bodyText = statementText.slice(openToken.end, closeOffset);
        const columns = extractProjectedColumns(bodyText);
        ctes.set(normalizeIdentifier(name), { kind: 'cte', name, alias: name, columns });

        const nextIndex = findTokenIndexAfterOffset(tokens, closeOffset + 1);
        if (nextIndex === -1) break;
        i = nextIndex;
        if (tokens[i]?.depth === 0 && tokens[i]?.value !== ',') {
            const nextWord = normalizeIdentifier(tokens[i]?.value ?? '');
            if (['select', 'insert', 'update', 'delete', 'with'].includes(nextWord)) break;
        }
    }

    return ctes;
}

function extractSources(statementText: string, tokens: SqlToken[], cursorDepth: number, ctes: Map<string, SqlSourceRef>): SqlSourceRef[] {
    const sources: SqlSourceRef[] = [];

    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].depth !== cursorDepth) continue;
        const clauseInfo = getSourceClause(tokens, i);
        if (!clauseInfo) continue;

        const parsed = parseSourcesAfterClause(tokens, statementText, clauseInfo.nextIndex, cursorDepth, ctes);
        sources.push(...parsed.sources);
        i = Math.max(i, parsed.nextIndex - 1);
    }

    return sources;
}

function getSourceClause(tokens: SqlToken[], index: number): { nextIndex: number } | null {
    const word = normalizeIdentifier(tokens[index]?.value ?? '');
    const nextWord = normalizeIdentifier(tokens[index + 1]?.value ?? '');

    if (word === 'from' || word === 'join' || word === 'update') {
        return { nextIndex: index + 1 };
    }
    if (word === 'insert' && nextWord === 'into') {
        return { nextIndex: index + 2 };
    }
    if (word === 'delete' && nextWord === 'from') {
        return { nextIndex: index + 2 };
    }
    if ((word === 'inner' || word === 'left' || word === 'right' || word === 'full' || word === 'outer' || word === 'cross') && nextWord === 'join') {
        return { nextIndex: index + 2 };
    }
    if (word === 'join') {
        return { nextIndex: index + 1 };
    }
    return null;
}

function parseSourcesAfterClause(
    tokens: SqlToken[],
    statementText: string,
    startIndex: number,
    currentDepth: number,
    ctes: Map<string, SqlSourceRef>,
): { sources: SqlSourceRef[]; nextIndex: number } {
    const sources: SqlSourceRef[] = [];
    let i = startIndex;

    while (i < tokens.length) {
        while (i < tokens.length && tokens[i].depth === currentDepth && tokens[i].value === ',') i++;
        if (i >= tokens.length) break;
        if (tokens[i].depth !== currentDepth) {
            i++;
            continue;
        }

        const word = normalizeIdentifier(tokens[i].value);
        if (isClauseBoundary(word)) break;

        const parsed = parseSingleSource(tokens, statementText, i, currentDepth, ctes);
        if (!parsed.source) break;
        sources.push(parsed.source);
        i = parsed.nextIndex;

        while (i < tokens.length && tokens[i].depth === currentDepth && tokens[i].value === ',') {
            i++;
        }
        const nextWord = normalizeIdentifier(tokens[i]?.value ?? '');
        if (isClauseBoundary(nextWord)) break;
        if (tokens[i] && tokens[i].depth < currentDepth) break;
    }

    return { sources, nextIndex: i };
}

function parseSingleSource(
    tokens: SqlToken[],
    statementText: string,
    startIndex: number,
    currentDepth: number,
    ctes: Map<string, SqlSourceRef>,
): { source?: SqlSourceRef; nextIndex: number } {
    let i = startIndex;
    const token = tokens[i];
    if (!token) return { nextIndex: i };

    if (token.value === '(') {
        const closeOffset = findMatchingParenFrom(statementText, token.start);
        const bodyText = statementText.slice(token.end, closeOffset);
        const columns = extractProjectedColumns(bodyText);
        i = findTokenIndexAfterOffset(tokens, closeOffset + 1);
        if (i === -1) i = tokens.length;

        let alias: string | undefined;
        if (normalizeIdentifier(tokens[i]?.value ?? '') === 'as') {
            i++;
        }
        if (tokens[i] && tokens[i].depth === currentDepth && isIdentifierLike(tokens[i].value)) {
            alias = tokens[i].value;
            i++;
        }

        return {
            source: {
                kind: 'subquery',
                name: alias || '(subquery)',
                alias,
                columns,
            },
            nextIndex: i,
        };
    }

    const nameParts: string[] = [];
    while (i < tokens.length) {
        const current = tokens[i];
        if (!current || current.depth !== currentDepth) break;
        const currentWord = normalizeIdentifier(current.value);
        if (current.value === '.') {
            nameParts.push('.');
            i++;
            continue;
        }
        if (!isIdentifierLike(current.value) || isClauseBoundary(currentWord)) break;
        nameParts.push(current.value);
        i++;
        if (tokens[i]?.value === '.') {
            nameParts.push('.');
            i++;
            continue;
        }
        break;
    }

    const rawName = nameParts.join('').replace(/\s+/g, ' ').trim();
    if (!rawName) return { nextIndex: i };

    const parts = rawName.split('.').map((part) => part.trim()).filter(Boolean);
    const schemaName = parts.length > 1 ? parts[0] : undefined;
    const objectName = parts[parts.length - 1];
    const cte = ctes.get(normalizeIdentifier(objectName));
    const source: SqlSourceRef = cte
        ? { ...cte, alias: cte.alias ?? objectName, name: cte.name }
        : {
            kind: 'table',
            name: objectName,
            schemaName,
        };

    if (normalizeIdentifier(tokens[i]?.value ?? '') === 'as') {
        i++;
    }
    if (tokens[i] && tokens[i].depth === currentDepth && isIdentifierLike(tokens[i].value) && !isClauseBoundary(normalizeIdentifier(tokens[i].value))) {
        source.alias = tokens[i].value;
        i++;
    }

    if (!source.alias && source.kind !== 'cte' && source.kind !== 'subquery') {
        source.alias = objectName;
    }

    return { source, nextIndex: i };
}

function extractProjectedColumns(bodyText: string): string[] {
    const { tokens } = tokenizeSql(bodyText);
    const selectIndex = tokens.findIndex((token) => token.depth === 0 && normalizeIdentifier(token.value) === 'select');
    if (selectIndex === -1) return [];

    let fromIndex = tokens.length;
    for (let i = selectIndex + 1; i < tokens.length; i++) {
        if (tokens[i].depth === 0 && normalizeIdentifier(tokens[i].value) === 'from') {
            fromIndex = i;
            break;
        }
    }

    const selectStart = tokens[selectIndex].end;
    const selectEnd = fromIndex < tokens.length ? tokens[fromIndex].start : bodyText.length;
    const selectList = bodyText.slice(selectStart, selectEnd);
    const items = splitTopLevelItems(selectList);

    return items
        .map(inferProjectionName)
        .filter((name): name is string => Boolean(name));
}

function splitTopLevelItems(text: string): string[] {
    const items: string[] = [];
    let current = '';
    let depth = 0;
    let inSingle = false;
    let inLineComment = false;
    let inBlockComment = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const next = text[i + 1];

        if (inLineComment) {
            current += ch;
            if (ch === '\n') inLineComment = false;
            continue;
        }
        if (inBlockComment) {
            current += ch;
            if (ch === '*' && next === '/') {
                current += next;
                inBlockComment = false;
                i++;
            }
            continue;
        }
        if (inSingle) {
            current += ch;
            if (ch === '\'' && next === '\'') {
                current += next;
                i++;
                continue;
            }
            if (ch === '\'') inSingle = false;
            continue;
        }
        if (ch === '-' && next === '-') {
            current += ch + next;
            inLineComment = true;
            i++;
            continue;
        }
        if (ch === '/' && next === '*') {
            current += ch + next;
            inBlockComment = true;
            i++;
            continue;
        }
        if (ch === '\'') {
            current += ch;
            inSingle = true;
            continue;
        }
        if (ch === '(') depth++;
        if (ch === ')' && depth > 0) depth--;

        if (ch === ',' && depth === 0) {
            if (current.trim()) items.push(current.trim());
            current = '';
            continue;
        }

        current += ch;
    }

    if (current.trim()) items.push(current.trim());
    return items;
}

function inferProjectionName(item: string): string | null {
    const trimmed = item.trim();
    if (!trimmed) return null;
    if (trimmed === '*') return '*';

    const asMatch = trimmed.match(/\s+AS\s+([A-Za-z_][\w$]*|"[^"]+"|`[^`]+`|\[[^\]]+\])$/i);
    if (asMatch) return stripIdentifierQuotes(asMatch[1]);

    const parts = trimmed.split(/\s+/);
    if (parts.length > 1) {
        const candidate = parts[parts.length - 1];
        if (isIdentifierLike(candidate)) {
            return stripIdentifierQuotes(candidate);
        }
    }

    const qualified = trimmed.split('.').filter(Boolean);
    const last = qualified[qualified.length - 1];
    return stripIdentifierQuotes(last);
}

function findMatchingParenFrom(text: string, openIndex: number): number {
    let depth = 1;
    let inSingle = false;
    let inLineComment = false;
    let inBlockComment = false;

    for (let i = openIndex + 1; i < text.length; i++) {
        const ch = text[i];
        const next = text[i + 1];

        if (inLineComment) {
            if (ch === '\n') inLineComment = false;
            continue;
        }
        if (inBlockComment) {
            if (ch === '*' && next === '/') {
                inBlockComment = false;
                i++;
            }
            continue;
        }
        if (inSingle) {
            if (ch === '\'' && next === '\'') {
                i++;
                continue;
            }
            if (ch === '\'') inSingle = false;
            continue;
        }
        if (ch === '-' && next === '-') {
            inLineComment = true;
            i++;
            continue;
        }
        if (ch === '/' && next === '*') {
            inBlockComment = true;
            i++;
            continue;
        }
        if (ch === '\'') {
            inSingle = true;
            continue;
        }
        if (ch === '(') depth++;
        else if (ch === ')') {
            depth--;
            if (depth === 0) return i;
        }
    }

    return text.length;
}

function findTokenIndexAfterOffset(tokens: SqlToken[], offset: number): number {
    return tokens.findIndex((token) => token.start >= offset);
}

function buildCatalogIndex(schemas: SchemaNode[]) {
    const entries: Array<{ schemaName: string; name: string; kind: 'table' | 'view'; duplicateCount: number }> = [];
    const counts = new Map<string, number>();

    schemas.forEach((schema) => {
        (schema.Tables || []).forEach((name) => {
            const key = normalizeIdentifier(name);
            counts.set(key, (counts.get(key) || 0) + 1);
            entries.push({ schemaName: schema.Name, name, kind: 'table', duplicateCount: 0 });
        });
        (schema.Views || []).forEach((name) => {
            const key = normalizeIdentifier(name);
            counts.set(key, (counts.get(key) || 0) + 1);
            entries.push({ schemaName: schema.Name, name, kind: 'view', duplicateCount: 0 });
        });
    });

    return {
        entries: entries.map((entry) => ({
            ...entry,
            duplicateCount: counts.get(normalizeIdentifier(entry.name)) || 0,
        })),
    };
}

function findCatalogMatches(schemas: SchemaNode[], objectName: string, schemaName?: string) {
    const normObject = normalizeIdentifier(objectName);
    const normSchema = schemaName ? normalizeIdentifier(schemaName) : '';
    const matches: Array<{ schemaName: string; name: string; kind: 'table' | 'view' }> = [];

    schemas.forEach((schema) => {
        if (normSchema && normalizeIdentifier(schema.Name) !== normSchema) return;
        (schema.Tables || []).forEach((name) => {
            if (normalizeIdentifier(name) === normObject) {
                matches.push({ schemaName: schema.Name, name, kind: 'table' });
            }
        });
        (schema.Views || []).forEach((name) => {
            if (normalizeIdentifier(name) === normObject) {
                matches.push({ schemaName: schema.Name, name, kind: 'view' });
            }
        });
    });

    return matches;
}

function resolveSourcesFromIdentifier(
    identifier: string,
    sources: SqlSourceRef[],
    ctes: Map<string, SqlSourceRef>,
    schemas: SchemaNode[],
): SqlSourceRef[] {
    const norm = normalizeIdentifier(identifier);
    if (!norm) return [];

    const result = sources.filter((source) => {
        const candidates = [
            normalizeIdentifier(source.alias || ''),
            normalizeIdentifier(source.name || ''),
            normalizeIdentifier(source.schemaName ? `${source.schemaName}.${source.name}` : ''),
        ];
        return candidates.includes(norm);
    });

    if (result.length > 0) return result;

    const cte = ctes.get(norm);
    if (cte) return [cte];

    const catalogMatches = findCatalogMatches(schemas, identifier, undefined);
    return catalogMatches.map((entry) => ({
        kind: entry.kind,
        name: entry.name,
        schemaName: entry.schemaName,
        alias: entry.name,
    }));
}

async function resolveColumnsForSources(
    sources: SqlSourceRef[],
    analysis: SqlAnalysis,
    env: SqlCompletionEnv,
): Promise<Array<{ Name: string; DataType?: string; IsPrimaryKey?: boolean; detail?: string }>> {
    const unique = new Map<string, { Name: string; DataType?: string; IsPrimaryKey?: boolean; detail?: string }>();
    const targetSources = sources.slice(0, 8);

    for (const source of targetSources) {
        if (source.columns && source.columns.length > 0) {
            source.columns.forEach((column) => {
                const key = normalizeIdentifier(column);
                if (!unique.has(key)) {
                    unique.set(key, { Name: column, detail: source.alias || source.name });
                }
            });
            continue;
        }

        if (source.kind === 'cte' || source.kind === 'subquery') {
            continue;
        }

        const matches = findCatalogMatches(env.schemas, source.name, source.schemaName);
        for (const match of matches) {
            const columns = await env.fetchColumns(match.schemaName, match.name);
            columns.forEach((column) => {
                const key = normalizeIdentifier(column.Name);
                if (!unique.has(key)) {
                    unique.set(key, { ...column, detail: source.alias || source.name });
                }
            });
        }
    }

    if (unique.size === 0 && analysis.sources.length === 0) {
        return [];
    }

    return Array.from(unique.values()).sort((a, b) => a.Name.localeCompare(b.Name));
}

function buildSelectLikeSuggestions(
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

function normalizeInsertClause(analysis: SqlAnalysis): SqlClause | 'insertColumns' {
    if (analysis.clause === 'insert' && /\binsert\s+into\b[\s\S]*\(\s*$/i.test(analysis.statementText)) {
        return 'insertColumns';
    }
    return analysis.clause;
}

function makeSortText(priority: number, label: string): string {
    return `${String(Math.max(0, priority)).padStart(4, '0')}_${normalizeIdentifier(label)}`;
}

function finalizeSuggestions(suggestionMap: Map<string, SuggestionRecord>): languages.CompletionItem[] {
    return Array.from(suggestionMap.values())
        .sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority;
            const aLabel = String(a.item.label);
            const bLabel = String(b.item.label);
            return aLabel.localeCompare(bLabel);
        })
        .map((record) => record.item);
}

function getOffsetAtPosition(text: string, position: { lineNumber: number; column: number }): number {
    const lines = text.split(/\r?\n/);
    let offset = 0;
    for (let i = 0; i < Math.max(0, position.lineNumber - 1); i++) {
        offset += (lines[i]?.length ?? 0) + 1;
    }
    offset += Math.max(0, position.column - 1);
    return Math.min(offset, text.length);
}

export async function buildSqlCompletionItems(
    analysis: SqlAnalysis,
    currentWord: string,
    range: { startLineNumber: number; endLineNumber: number; startColumn: number; endColumn: number },
    env: SqlCompletionEnv,
): Promise<languages.CompletionItem[]> {
    if (analysis.isInCommentOrString) {
        return [];
    }

    const suggestionMap = new Map<string, SuggestionRecord>();
    const currentWordNorm = normalizeIdentifier(currentWord);
    const currentWordLower = currentWordNorm.toLowerCase();
    const resolvePrefixBoost = (label: string, kind?: CompletionKind): number => {
        const labelNorm = normalizeIdentifier(label).toLowerCase();
        const keywordKind = env.monaco.languages.CompletionItemKind.Keyword as CompletionKind;
        const functionKind = env.monaco.languages.CompletionItemKind.Function as CompletionKind;
        const fieldKind = env.monaco.languages.CompletionItemKind.Field as CompletionKind;
        const moduleKind = env.monaco.languages.CompletionItemKind.Module as CompletionKind;
        const classKind = env.monaco.languages.CompletionItemKind.Class as CompletionKind;
        const textKind = env.monaco.languages.CompletionItemKind.Text as CompletionKind;
        const snippetKind = env.monaco.languages.CompletionItemKind.Snippet as CompletionKind;
        const operatorKind = env.monaco.languages.CompletionItemKind.Operator as CompletionKind;

        const prefixMatch = Boolean(currentWordLower) && labelNorm.startsWith(currentWordLower);

        if (prefixMatch) {
            if (kind === moduleKind || kind === classKind) return -1100;
            if (kind === keywordKind) return -1000;
            if (kind === functionKind) return -900;
            if (kind === fieldKind) return -800;
            if (kind === operatorKind) return -600;
            if (kind === snippetKind) return -500;
            if (kind === textKind) return -400;
            return -300;
        }

        if (kind === textKind) return 250;
        if (kind === snippetKind) return 150;
        if (kind === operatorKind) return 120;
        if (kind === moduleKind || kind === classKind) return 60;
        if (kind === fieldKind) return 90;
        if (kind === functionKind) return 70;
        if (kind === keywordKind) return 60;
        return 100;
    };

    const addSuggestion = (label: string, item: languages.CompletionItem, priority: number) => {
        const key = normalizeIdentifier(label);
        const existing = suggestionMap.get(key);
        const resolvedPriority = priority + resolvePrefixBoost(label, item.kind as CompletionKind | undefined);
        if (!existing || resolvedPriority < existing.priority) {
            suggestionMap.set(key, { priority: resolvedPriority, item: { ...item, sortText: makeSortText(resolvedPriority, label) } });
        }
    };

    const addKeyword = (label: string, insertText = label, priority = 300) => {
        addSuggestion(label, {
            label,
            kind: env.monaco.languages.CompletionItemKind.Keyword as CompletionKind,
            insertText,
            range,
        }, priority);
    };

    const addFunction = (label: string, snippet = `${label}($1)`, priority = 200) => {
        addSuggestion(label, {
            label,
            kind: env.monaco.languages.CompletionItemKind.Function as CompletionKind,
            insertText: snippet,
            insertTextRules: env.monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
        }, priority);
    };

    const addOperator = (label: string, insertText = label, priority = 50) => {
        addSuggestion(label, {
            label,
            kind: env.monaco.languages.CompletionItemKind.Operator as CompletionKind,
            insertText,
            range,
        }, priority);
    };

    const addText = (label: string, insertText = label, priority = 500) => {
        addSuggestion(label, {
            label,
            kind: env.monaco.languages.CompletionItemKind.Text as CompletionKind,
            insertText,
            range,
        }, priority);
    };

    const addTemplates = () => {
        env.templates.forEach((template) => {
            addSuggestion(template.trigger, {
                label: template.trigger,
                kind: env.monaco.languages.CompletionItemKind.Snippet as CompletionKind,
                detail: template.name,
                documentation: template.content,
                insertText: template.content,
                insertTextRules: env.monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                range,
            }, 240);
        });
    };

    const buildTableItems = () => {
        const catalog = buildCatalogIndex(env.schemas);
        const items: Array<{ item: languages.CompletionItem; priority: number }> = [];

        for (const entry of catalog.entries) {
            const label = entry.duplicateCount > 1
                ? `${entry.schemaName}.${entry.name}`
                : entry.name;
            const detail = entry.kind === 'view' ? 'View' : 'Table';
            items.push({
                priority: 100,
                item: {
                    label,
                    kind: entry.kind === 'view'
                        ? env.monaco.languages.CompletionItemKind.Class as CompletionKind
                        : env.monaco.languages.CompletionItemKind.Module as CompletionKind,
                    detail,
                    insertText: label,
                    range,
                },
            });
        }

        return items;
    };

    const buildColumnItems = async (sources: SqlSourceRef[]) => {
        const resolvedColumns = await resolveColumnsForSources(sources, analysis, env);
        return resolvedColumns.map((column) => ({
            label: column.Name,
            kind: env.monaco.languages.CompletionItemKind.Field as CompletionKind,
            detail: column.detail,
            insertText: column.Name,
            range,
        }));
    };

    const clause = normalizeInsertClause(analysis);
    const baseClause = clause === 'insertColumns' ? 'select' : clause;

    if (analysis.afterDot) {
        const dotSources = resolveSourcesFromIdentifier(analysis.dotIdentifier, analysis.sources, analysis.ctes, env.schemas);
        const columns = await buildColumnItems(dotSources.length > 0 ? dotSources : analysis.sources);
        columns.forEach((item) => addSuggestion(item.label as string, item, 0));
        return finalizeSuggestions(suggestionMap);
    }

    if (COLUMN_LIKE_CLAUSES.has(baseClause)) {
        const columns = await buildColumnItems(analysis.sources);
        columns.forEach((item) => addSuggestion(item.label as string, item, 0));
    }

    if (SELECT_LIKE_CLAUSES.has(baseClause) || baseClause === 'with' || baseClause === 'unknown') {
        const columns = analysis.sources.length > 0 ? await buildColumnItems(analysis.sources) : [];
        columns.forEach((item) => addSuggestion(item.label as string, item, 0));
        addTemplates();
        buildSelectLikeSuggestions(addKeyword, addFunction, addText, addOperator);
        addText('*', '*', 10);
        addKeyword('DISTINCT', 'DISTINCT ', 15);
        addKeyword('FROM', 'FROM ', 20);
    }

    if (TABLE_LIKE_CLAUSES.has(baseClause)) {
        buildTableItems().forEach((record) => addSuggestion(record.item.label as string, record.item, record.priority));
        addKeyword('AS', 'AS ', 130);
        if (baseClause === 'insert') {
            addKeyword('VALUES', 'VALUES ', 120);
            addKeyword('DEFAULT VALUES', 'DEFAULT VALUES', 110);
        }
        if (baseClause === 'delete') {
            addKeyword('WHERE', 'WHERE ', 140);
        }
    }

    if (baseClause === 'where' || baseClause === 'having' || baseClause === 'on' || baseClause === 'set') {
        const columns = await buildColumnItems(analysis.sources);
        columns.forEach((item) => addSuggestion(item.label as string, item, 0));
        SQL_OPERATORS.forEach((op) => addOperator(op, `${op} `, 50));
        buildSelectLikeSuggestions(addKeyword, addFunction, addText, addOperator);
    }

    if (baseClause === 'groupBy' || baseClause === 'orderBy') {
        const columns = await buildColumnItems(analysis.sources);
        columns.forEach((item) => addSuggestion(item.label as string, item, 0));
        SQL_FUNCTIONS.forEach((fn) => addFunction(fn, `${fn}($1)`, 100));
        addKeyword('ASC', 'ASC ', 20);
        addKeyword('DESC', 'DESC ', 20);
    }

    if (baseClause === 'createTable' || baseClause === 'alterTable') {
        const types = getTypesForDriver(env.driver);
        types.forEach((type) => addSuggestion(type, {
            label: type,
            kind: env.monaco.languages.CompletionItemKind.Keyword as CompletionKind,
            insertText: type,
            range,
        }, 0));
        ['PRIMARY KEY', 'FOREIGN KEY', 'NOT NULL', 'DEFAULT', 'UNIQUE', 'CHECK', 'REFERENCES']
            .forEach((kw) => addKeyword(kw, kw, 100));
        if (baseClause === 'alterTable') {
            ['ADD COLUMN', 'DROP COLUMN', 'RENAME COLUMN', 'ALTER COLUMN'].forEach((kw) => addKeyword(kw, kw, 90));
        }
    }

    if (baseClause === 'values') {
        ['NULL', 'DEFAULT', 'CURRENT_TIMESTAMP'].forEach((kw) => addKeyword(kw, `${kw} `, 80));
        ['TRUE', 'FALSE'].forEach((kw) => addKeyword(kw, kw, 90));
        SQL_FUNCTIONS.forEach((fn) => addFunction(fn, `${fn}($1)`, 120));
    }

    if (baseClause === 'select' && analysis.sources.length === 0) {
        buildTableItems().forEach((record) => addSuggestion(record.item.label as string, record.item, record.priority + 40));
    }

    if (baseClause === 'unknown') {
        addTemplates();
    }

    return finalizeSuggestions(suggestionMap);
}

export function registerContextAwareSQLCompletion(monaco: any) {
    const disposables = (window as any)[DISPOSABLES_KEY] as any[];

    while (disposables.length > 0) {
        const d = disposables.pop();
        if (d && typeof d.dispose === 'function') {
            try {
                d.dispose();
            } catch (error) {
                console.error('Error disposing SQL completion provider:', error);
            }
        }
    }

    const provider = {
        triggerCharacters: ['.', ' ', ',', '('],
        provideCompletionItems: async (model: any, position: any) => {
            const fullText = model.getValue();
            const cursorOffset = typeof model.getOffsetAt === 'function'
                ? model.getOffsetAt(position)
                : getOffsetAtPosition(fullText, position);
            const analysis = analyzeSqlText(fullText, cursorOffset);
            if (analysis.isInCommentOrString) {
                return { suggestions: [] };
            }

            const word = model.getWordUntilPosition(position);
            const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn,
            };

            const profile = useConnectionStore.getState().activeProfile;
            const profileKey = profile?.name ?? '';
            const dbName = profile?.db_name ?? '';
            const schemas = profileKey
                ? Object.entries(useSchemaStore.getState().trees)
                    .filter(([key]) => key.startsWith(`${profileKey}:`))
                    .flatMap(([, nodes]) => nodes as SchemaNode[])
                : [];

            const fetchColumns = async (schemaName: string, tableName: string) => {
                return useSchemaStore.getState().checkAndFetchColumns(profileKey, dbName, schemaName, tableName);
            };

            const templates = useTemplateStore.getState().templates;
            const suggestions = await buildSqlCompletionItems(
                analysis,
                word.word || '',
                range,
                {
                    monaco,
                    schemas,
                    driver: profile?.driver || '',
                    fetchColumns,
                    templates,
                },
            );

            return { suggestions };
        },
    };

    const registration = monaco.languages.registerCompletionItemProvider('sql', provider);
    disposables.push(registration);
}
