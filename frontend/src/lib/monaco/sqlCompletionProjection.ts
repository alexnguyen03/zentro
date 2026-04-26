import { isIdentifierLike } from './sqlCompletionTokenizer';
import { normalizeIdentifier, stripIdentifierQuotes } from './sqlCompletionIdentifiers';
import { SqlToken } from './sqlCompletionTypes';

export function extractProjectedColumns(bodyText: string): string[] {
    const tokenized = bodyText.trim();
    const selectMatch = tokenized.match(/^select\s+([\s\S]+?)\s+from\s+/i);
    if (!selectMatch) return [];
    const projection = selectMatch[1];
    const items = splitTopLevelItems(projection);
    const result: string[] = [];
    items.forEach((item) => {
        const inferred = inferProjectionName(item);
        if (inferred) result.push(inferred);
    });
    return result;
}

function splitTopLevelItems(text: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let inSingle = false;
    let start = 0;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const next = text[i + 1];
        if (inSingle) {
            if (ch === '\'' && next === '\'') { i++; continue; }
            if (ch === '\'') inSingle = false;
            continue;
        }
        if (ch === '\'') { inSingle = true; continue; }
        if (ch === '(') depth++;
        else if (ch === ')' && depth > 0) depth--;
        else if (ch === ',' && depth === 0) {
            parts.push(text.slice(start, i).trim());
            start = i + 1;
        }
    }
    const tail = text.slice(start).trim();
    if (tail) parts.push(tail);
    return parts;
}

function inferProjectionName(item: string): string | null {
    const asMatch = item.match(/\bas\s+([A-Za-z_][\w$]*|"[^"]+"|`[^`]+`|\[[^\]]+\])\s*$/i);
    if (asMatch) return stripIdentifierQuotes(asMatch[1]);
    const bareAliasMatch = item.match(/([A-Za-z_][\w$]*|"[^"]+"|`[^`]+`|\[[^\]]+\])\s*$/);
    if (!bareAliasMatch) return null;
    const candidate = bareAliasMatch[1];
    if (item.includes('.') && candidate === item.split('.').slice(-1)[0].trim()) return stripIdentifierQuotes(candidate);
    if (isIdentifierLike(candidate) && !/[\(\)\+\-\*\/]/.test(item.replace(candidate, ''))) return stripIdentifierQuotes(candidate);
    return null;
}

export function findMatchingParenFrom(text: string, openIndex: number): number {
    let depth = 0;
    let inSingle = false;
    let inLineComment = false;
    let inBlockComment = false;
    for (let i = openIndex; i < text.length; i++) {
        const ch = text[i];
        const next = text[i + 1];
        if (inLineComment) { if (ch === '\n') inLineComment = false; continue; }
        if (inBlockComment) { if (ch === '*' && next === '/') { inBlockComment = false; i++; } continue; }
        if (inSingle) { if (ch === '\'' && next === '\'') { i++; continue; } if (ch === '\'') inSingle = false; continue; }
        if (ch === '-' && next === '-') { inLineComment = true; i++; continue; }
        if (ch === '/' && next === '*') { inBlockComment = true; i++; continue; }
        if (ch === '\'') { inSingle = true; continue; }
        if (ch === '(') depth++;
        else if (ch === ')') {
            depth--;
            if (depth === 0) return i;
        }
    }
    return text.length;
}

export function findTokenIndexAfterOffset(tokens: SqlToken[], offset: number): number {
    return tokens.findIndex((token) => token.start >= offset);
}

export function hasIdentifierToken(tokens: SqlToken[], value: string): boolean {
    const norm = normalizeIdentifier(value);
    return tokens.some((token) => normalizeIdentifier(token.value) === norm);
}
