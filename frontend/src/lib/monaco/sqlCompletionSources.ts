import { normalizeIdentifier, stripIdentifierQuotes } from './sqlCompletionIdentifiers';
import { extractProjectedColumns, findMatchingParenFrom, findTokenIndexAfterOffset } from './sqlCompletionProjection';
import { isClauseBoundary, isIdentifierLike } from './sqlCompletionTokenizer';
import { SqlSourceRef, SqlToken } from './sqlCompletionTypes';

export function extractCtes(statementText: string): Map<string, SqlSourceRef> {
    const ctes = new Map<string, SqlSourceRef>();
    const { tokens } = tokenizeForCte(statementText);
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

export function extractSources(statementText: string, tokens: SqlToken[], cursorDepth: number, ctes: Map<string, SqlSourceRef>): SqlSourceRef[] {
    const sources: SqlSourceRef[] = [];
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].depth !== cursorDepth) continue;
        const clauseInfo = getSourceClause(tokens, i);
        if (!clauseInfo) continue;
        const parsed = parseSourcesAfterClause(tokens, statementText, clauseInfo.nextIndex, cursorDepth, ctes);
        sources.push(...parsed.sources);
        i = Math.max(i, parsed.nextIndex - 1);
    }
    return dedupeSources(sources);
}

function tokenizeForCte(text: string): { tokens: SqlToken[] } {
    // Reuse the same token contract as main tokenizer with lighter implementation
    const tokens: SqlToken[] = [];
    let depth = 0;
    let i = 0;
    while (i < text.length) {
        const ch = text[i];
        if (/\s/.test(ch)) { i++; continue; }
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
        const start = i;
        i++;
        while (i < text.length && /[A-Za-z0-9_$]/.test(text[i])) i++;
        tokens.push({ value: text.slice(start, i), start, end: i, depth });
    }
    return { tokens };
}

function getSourceClause(tokens: SqlToken[], index: number): { nextIndex: number } | null {
    const word = normalizeIdentifier(tokens[index].value);
    const nextWord = normalizeIdentifier(tokens[index + 1]?.value || '');
    if (word === 'from') return { nextIndex: index + 1 };
    if (word === 'join') return { nextIndex: index + 1 };
    if (['inner', 'left', 'right', 'full', 'cross'].includes(word) && nextWord === 'join') return { nextIndex: index + 2 };
    return null;
}

function parseSourcesAfterClause(
    tokens: SqlToken[],
    statementText: string,
    startIndex: number,
    depth: number,
    ctes: Map<string, SqlSourceRef>,
): { sources: SqlSourceRef[]; nextIndex: number } {
    const sources: SqlSourceRef[] = [];
    let i = startIndex;
    while (i < tokens.length) {
        const token = tokens[i];
        if (token.depth !== depth) { i++; continue; }
        const word = normalizeIdentifier(token.value);
        if (token.value === ';' || isClauseBoundary(word)) break;
        if (token.value === ',') { i++; continue; }
        const parsed = parseSingleSource(tokens, statementText, i, depth, ctes);
        if (!parsed) break;
        sources.push(parsed.source);
        i = parsed.nextIndex;
    }
    return { sources, nextIndex: i };
}

function parseSingleSource(
    tokens: SqlToken[],
    statementText: string,
    startIndex: number,
    depth: number,
    ctes: Map<string, SqlSourceRef>,
): { source: SqlSourceRef; nextIndex: number } | null {
    const token = tokens[startIndex];
    if (!token || token.depth !== depth) return null;
    if (token.value === '(') {
        const closeOffset = findMatchingParenFrom(statementText, token.start);
        const bodyText = statementText.slice(token.end, closeOffset);
        const columns = extractProjectedColumns(bodyText);
        const nextIndex = findTokenIndexAfterOffset(tokens, closeOffset + 1);
        const alias = nextIndex >= 0 && isIdentifierLike(tokens[nextIndex]?.value || '') ? stripIdentifierQuotes(tokens[nextIndex].value) : 'subquery';
        return { source: { kind: 'subquery', name: alias, alias, columns }, nextIndex: nextIndex >= 0 ? nextIndex + 1 : tokens.length };
    }
    if (!isIdentifierLike(token.value)) return null;
    const first = stripIdentifierQuotes(token.value);
    let schemaName = '';
    let objectName = first;
    let i = startIndex + 1;
    if (tokens[i]?.depth === depth && tokens[i]?.value === '.' && isIdentifierLike(tokens[i + 1]?.value || '')) {
        schemaName = first;
        objectName = stripIdentifierQuotes(tokens[i + 1].value);
        i += 2;
    }
    let alias = objectName;
    if (tokens[i]?.depth === depth && normalizeIdentifier(tokens[i]?.value || '') === 'as' && isIdentifierLike(tokens[i + 1]?.value || '')) {
        alias = stripIdentifierQuotes(tokens[i + 1].value);
        i += 2;
    } else if (tokens[i]?.depth === depth && isIdentifierLike(tokens[i]?.value || '')) {
        alias = stripIdentifierQuotes(tokens[i].value);
        i += 1;
    }
    const cte = ctes.get(normalizeIdentifier(objectName));
    if (cte) return { source: { ...cte, alias }, nextIndex: i };
    return { source: { kind: 'table', name: objectName, schemaName: schemaName || undefined, alias }, nextIndex: i };
}

function dedupeSources(sources: SqlSourceRef[]): SqlSourceRef[] {
    const seen = new Set<string>();
    const result: SqlSourceRef[] = [];
    sources.forEach((source) => {
        const key = [normalizeIdentifier(source.kind), normalizeIdentifier(source.schemaName || ''), normalizeIdentifier(source.name), normalizeIdentifier(source.alias || '')].join(':');
        if (seen.has(key)) return;
        seen.add(key);
        result.push(source);
    });
    return result;
}
