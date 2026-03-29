import { extractCtes, extractSources } from './sqlCompletionSources';
import { normalizeIdentifier } from './sqlCompletionIdentifiers';
import { SqlAnalysis } from './sqlCompletionTypes';
import { detectClause, tokenizeSql } from './sqlCompletionTokenizer';

export function analyzeSqlText(fullText: string, cursorOffset: number): SqlAnalysis {
    const cursor = Math.max(0, Math.min(cursorOffset, fullText.length));
    const statementStartOffset = findStatementStartOffset(fullText, cursor);
    const statementEndOffset = findStatementEndOffset(fullText, cursor);
    const statementText = fullText.slice(statementStartOffset, cursor);
    const statementSpanText = fullText.slice(statementStartOffset, statementEndOffset);
    const tokenization = tokenizeSql(statementText);
    const statementSpanTokenization = tokenizeSql(statementSpanText);
    const cursorDepth = tokenization.finalDepth;
    const clause = detectClause(tokenization.tokens, cursorDepth);
    const isInCommentOrString = isInsideLineCommentOrString(statementText);
    const afterDotMatch = statementText.match(/([A-Za-z_][\w$]*|"[^"]+"|`[^`]+`|\[[^\]]+\])\.$/);
    const dotIdentifier = afterDotMatch ? normalizeIdentifier(afterDotMatch[1]) : '';
    // Use the whole statement span so aliases declared after cursor are still available.
    const ctes = extractCtes(statementSpanText);
    const sources = extractSources(statementSpanText, statementSpanTokenization.tokens, cursorDepth, ctes);

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

function findStatementEndOffset(text: string, cursorOffset: number): number {
    let depth = 0;
    let inSingle = false;
    let inLineComment = false;
    let inBlockComment = false;

    for (let i = cursorOffset; i < text.length; i++) {
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
        else if (ch === ')' && depth > 0) depth--;
        else if (ch === ';' && depth === 0) return i;
    }
    return text.length;
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
        if (inLineComment) { if (ch === '\n') inLineComment = false; continue; }
        if (inBlockComment) { if (ch === '*' && next === '/') { inBlockComment = false; i++; } continue; }
        if (inSingle) { if (ch === '\'' && next === '\'') { i++; continue; } if (ch === '\'') inSingle = false; continue; }
        if (ch === '-' && next === '-') { inLineComment = true; i++; continue; }
        if (ch === '/' && next === '*') { inBlockComment = true; i++; continue; }
        if (ch === '\'') { inSingle = true; continue; }
        if (ch === '(') depth++;
        else if (ch === ')' && depth > 0) depth--;
        else if (ch === ';' && depth === 0) start = i + 1;
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
        if (inLineComment) { if (ch === '\n') inLineComment = false; continue; }
        if (inBlockComment) { if (ch === '*' && next === '/') { inBlockComment = false; i++; } continue; }
        if (inSingle) { if (ch === '\'' && next === '\'') { i++; continue; } if (ch === '\'') inSingle = false; continue; }
        if (ch === '-' && next === '-') { inLineComment = true; i++; continue; }
        if (ch === '/' && next === '*') { inBlockComment = true; i++; continue; }
        if (ch === '\'') { inSingle = true; continue; }
    }
    return inSingle || inLineComment || inBlockComment;
}
