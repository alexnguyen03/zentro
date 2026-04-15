type QueryShape = 'has-where' | 'no-where';

const LEGACY_FILTER_WRAPPER_RE = /^\s*select\s+\*\s+from\s*\(\s*([\s\S]+?)\s*\)\s+as\s+_zentro_filter(?:\s+where\s+[\s\S]+)?\s*$/i;
const LEGACY_FILTER_SUFFIX_RE = /^\s*([\s\S]+?)\s*\)\s+as\s+_zentro_filter(?:\s+where\s+[\s\S]+)?\s*$/i;
const LEGACY_ORDER_WRAPPER_RE = /^\s*select\s+\*\s+from\s*\(\s*([\s\S]+?)\s*\)\s+as\s+_zentro_order(?:\s+order\s+by\s+[\s\S]+)?\s*$/i;
const LEGACY_ORDER_SUFFIX_RE = /^\s*([\s\S]+?)\s*\)\s+as\s+_zentro_order(?:\s+order\s+by\s+[\s\S]+)?\s*$/i;
const TAIL_CLAUSES_FOR_FILTER: ClauseName[] = ['group by', 'having', 'order by', 'limit', 'offset', 'fetch', 'union', 'intersect', 'except'];
const TAIL_CLAUSES_FOR_ORDER: ClauseName[] = ['limit', 'offset', 'fetch'];

type ClauseName = 'where' | 'group by' | 'having' | 'order by' | 'limit' | 'offset' | 'fetch' | 'union' | 'intersect' | 'except';

function getQueryShape(q: string): QueryShape {
    return /\bwhere\b/i.test(q) ? 'has-where' : 'no-where';
}

function isIdentifierChar(char: string | undefined): boolean {
    if (!char) return false;
    return /[A-Za-z0-9_$]/.test(char);
}

function hasWordBoundary(sql: string, start: number, phraseLength: number): boolean {
    const before = start <= 0 ? '' : sql[start - 1];
    const after = start + phraseLength >= sql.length ? '' : sql[start + phraseLength];
    return !isIdentifierChar(before) && !isIdentifierChar(after);
}

function findTopLevelClauses(sql: string): Partial<Record<ClauseName, number>> {
    const hits: Partial<Record<ClauseName, number>> = {};
    const lower = sql.toLowerCase();
    let depth = 0;
    let inSingle = false;
    let inDouble = false;

    const orderedClauses: ClauseName[] = ['group by', 'order by', 'intersect', 'except', 'having', 'offset', 'where', 'limit', 'union', 'fetch'];

    for (let index = 0; index < sql.length; index += 1) {
        const ch = sql[index];
        const next = sql[index + 1];

        if (!inDouble && ch === '\'') {
            if (inSingle && next === '\'') {
                index += 1;
            } else {
                inSingle = !inSingle;
            }
            continue;
        }

        if (!inSingle && ch === '"') {
            if (inDouble && next === '"') {
                index += 1;
            } else {
                inDouble = !inDouble;
            }
            continue;
        }

        if (inSingle || inDouble) continue;

        if (ch === '(') {
            depth += 1;
            continue;
        }

        if (ch === ')' && depth > 0) {
            depth -= 1;
            continue;
        }

        if (depth !== 0) continue;

        for (const clause of orderedClauses) {
            if (hits[clause] !== undefined) continue;
            if (!lower.startsWith(clause, index)) continue;
            if (!hasWordBoundary(lower, index, clause.length)) continue;
            hits[clause] = index;
            break;
        }
    }

    return hits;
}

function findFirstClauseIndex(clauses: Partial<Record<ClauseName, number>>, names: ClauseName[], minIndex = -1): number | null {
    let result: number | null = null;
    names.forEach((name) => {
        const index = clauses[name];
        if (index === undefined || index <= minIndex) return;
        if (result === null || index < result) result = index;
    });
    return result;
}

function joinHeadTail(head: string, tail: string): string {
    const cleanHead = head.trimEnd();
    const cleanTail = tail.trimStart();
    if (!cleanTail) return cleanHead;
    if (!cleanHead) return cleanTail;
    return `${cleanHead} ${cleanTail}`;
}

function stripLegacyFilterWrapper(q: string): string {
    const trimmed = q.trim();
    const wrapped = LEGACY_FILTER_WRAPPER_RE.exec(trimmed);
    if (wrapped) {
        return (wrapped[1] || '').trim();
    }

    // splitLastQuery() can return "<inner-select> ) AS _zentro_filter WHERE ..."
    // when the legacy wrapper contains nested SELECT; unwrap that suffix too.
    const suffixWrapped = LEGACY_FILTER_SUFFIX_RE.exec(trimmed);
    if (suffixWrapped) {
        let candidate = (suffixWrapped[1] || '').trim();
        const legacyOuterPrefix = /^\s*select\s+\*\s+from\s*\(\s*([\s\S]+)$/i.exec(candidate);
        if (legacyOuterPrefix) {
            candidate = (legacyOuterPrefix[1] || '').trim();
        }
        if (/^select\b/i.test(candidate)) return candidate;
    }

    const orderWrapped = LEGACY_ORDER_WRAPPER_RE.exec(trimmed);
    if (orderWrapped) {
        return (orderWrapped[1] || '').trim();
    }

    const orderSuffixWrapped = LEGACY_ORDER_SUFFIX_RE.exec(trimmed);
    if (orderSuffixWrapped) {
        let candidate = (orderSuffixWrapped[1] || '').trim();
        const orderOuterPrefix = /^\s*select\s+\*\s+from\s*\(\s*([\s\S]+)$/i.exec(candidate);
        if (orderOuterPrefix) {
            candidate = (orderOuterPrefix[1] || '').trim();
        }
        if (/^select\b/i.test(candidate)) return candidate;
    }

    return q;
}

function normalizeBaseQuery(rawQuery: string): { prefix: string; base: string } {
    const normalizedRawQuery = stripLegacyFilterWrapper(rawQuery.trim().replace(/;\s*$/, ''));
    const { prefix, base } = splitLastQuery(normalizedRawQuery);
    return {
        prefix,
        base: stripLegacyFilterWrapper(base.replace(/;\s*$/, '').trim()),
    };
}

function applyFilterToSelectQuery(baseQuery: string, condition: string): string {
    const trimmedCondition = condition.trim();
    if (!trimmedCondition) return baseQuery;

    const clauses = findTopLevelClauses(baseQuery);
    const whereIndex = clauses.where;
    const tailIndex = findFirstClauseIndex(clauses, TAIL_CLAUSES_FOR_FILTER);

    if (whereIndex !== undefined && (tailIndex === null || whereIndex < tailIndex)) {
        const head = baseQuery.slice(0, whereIndex).trimEnd();
        const existingWhereExpr = baseQuery
            .slice(whereIndex + 'where'.length, tailIndex === null ? undefined : tailIndex)
            .trim();
        const suffix = tailIndex === null ? '' : baseQuery.slice(tailIndex);
        if (!existingWhereExpr) {
            return joinHeadTail(`${head} where ${trimmedCondition}`, suffix);
        }
        const mergedWhereExpr = /(?:\band\b|\bor\b|\bnot\b)\s*$/i.test(existingWhereExpr)
            ? `${existingWhereExpr} ${trimmedCondition}`
            : `(${existingWhereExpr}) AND (${trimmedCondition})`;
        return joinHeadTail(`${head} where ${mergedWhereExpr}`, suffix);
    }

    if (tailIndex !== null) {
        const head = baseQuery.slice(0, tailIndex).trimEnd();
        const tail = baseQuery.slice(tailIndex);
        return joinHeadTail(`${head} where ${trimmedCondition}`, tail);
    }

    return `${baseQuery.trimEnd()} where ${trimmedCondition}`;
}

function removeTopLevelOrderBy(baseQuery: string): string {
    const clauses = findTopLevelClauses(baseQuery);
    const orderIndex = clauses['order by'];
    if (orderIndex === undefined) return baseQuery;

    const afterOrderTailIndex = findFirstClauseIndex(clauses, TAIL_CLAUSES_FOR_ORDER, orderIndex);
    const head = baseQuery.slice(0, orderIndex);
    const tail = afterOrderTailIndex === null ? '' : baseQuery.slice(afterOrderTailIndex);
    return joinHeadTail(head, tail);
}

function appendOrderBy(baseQuery: string, orderByExpr: string): string {
    const trimmedOrder = orderByExpr.trim();
    if (!trimmedOrder) return baseQuery;

    const clauses = findTopLevelClauses(baseQuery);
    const tailIndex = findFirstClauseIndex(clauses, TAIL_CLAUSES_FOR_ORDER);
    if (tailIndex !== null) {
        const head = baseQuery.slice(0, tailIndex);
        const tail = baseQuery.slice(tailIndex);
        return joinHeadTail(`${head.trimEnd()} order by ${trimmedOrder}`, tail);
    }

    return `${baseQuery.trimEnd()} order by ${trimmedOrder}`;
}

export function splitLastQuery(rawQuery: string): { prefix: string, base: string } {
    // 1. Try splitting by semicolon first
    const parts = rawQuery.split(';');
    if (parts.length > 1) {
        let lastIdx = parts.length - 1;
        while (lastIdx >= 0 && parts[lastIdx].trim() === '') lastIdx--;
        if (lastIdx > 0) {
            const prefix = parts.slice(0, lastIdx).join(';') + ';';
            return { prefix, base: parts[lastIdx] };
        }
    }

    // 2. Fallback heuristic: find the last standalone "select" on a new line
    const regex = /(?:^|\n)[ \t]*select\b/gi;
    let match;
    let lastMatchIndex = -1;
    while ((match = regex.exec(rawQuery)) !== null) {
        lastMatchIndex = match.index;
    }

    if (lastMatchIndex > 0) {
        const selectRegex = /\bselect\b/i;
        const localMatch = selectRegex.exec(rawQuery.slice(lastMatchIndex));
        if (localMatch) {
            const offset = lastMatchIndex + localMatch.index;
            const prefix = rawQuery.slice(0, offset);
            const base = rawQuery.slice(offset);
            return { prefix, base };
        }
    }

    return { prefix: '', base: rawQuery };
}

export function buildFilterQuery(rawQuery: string, condition: string): string {
    const { prefix, base } = normalizeBaseQuery(rawQuery);
    const filtered = applyFilterToSelectQuery(base, condition);
    return prefix ? `${prefix}${filtered}` : filtered;
}

export function buildFilterOrderQuery(rawQuery: string, condition: string, orderByExpr: string): string {
    const withFilter = buildFilterQuery(rawQuery, condition);
    const { prefix, base } = normalizeBaseQuery(withFilter);
    const withoutOldOrder = removeTopLevelOrderBy(base);
    const trimmedOrder = orderByExpr.trim();
    if (!trimmedOrder) {
        return prefix ? `${prefix}${withoutOldOrder}` : withoutOldOrder;
    }
    const ordered = appendOrderBy(withoutOldOrder, trimmedOrder);
    return prefix ? `${prefix}${ordered}` : ordered;
}

export { getQueryShape };
