type QueryShape = 'has-where' | 'no-where';

const TAIL_CLAUSE_RE = /\b(group\s+by|having|order\s+by|limit|offset|fetch|union|intersect|except)\b/i;
const LEGACY_FILTER_WRAPPER_RE = /^\s*select\s+\*\s+from\s*\(\s*([\s\S]+?)\s*\)\s+as\s+_zentro_filter(?:\s+where\s+[\s\S]+)?\s*$/i;
const LEGACY_FILTER_SUFFIX_RE = /^\s*([\s\S]+?)\s*\)\s+as\s+_zentro_filter(?:\s+where\s+[\s\S]+)?\s*$/i;

function getQueryShape(q: string): QueryShape {
    return /\bwhere\b/i.test(q) ? 'has-where' : 'no-where';
}

function splitFilterTail(q: string): { head: string; tail: string } {
    const match = TAIL_CLAUSE_RE.exec(q);
    if (!match || match.index < 0) return { head: q.trim(), tail: '' };
    return {
        head: q.slice(0, match.index).trimEnd(),
        tail: q.slice(match.index).trim(),
    };
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

    return q;
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
    const normalizedRawQuery = stripLegacyFilterWrapper(rawQuery.trim().replace(/;\s*$/, ''));
    const { prefix, base } = splitLastQuery(normalizedRawQuery);
    const q = stripLegacyFilterWrapper(base.replace(/;\s*$/, '').trim());
    const trimmedCondition = condition.trim();
    if (!trimmedCondition) {
        return prefix ? `${prefix}${q}` : q;
    }

    const { head, tail } = splitFilterTail(q);
    const whereMatch = /\bwhere\b/i.exec(head);
    let main: string;

    if (!whereMatch || whereMatch.index < 0) {
        main = `${head} where ${trimmedCondition}`;
    } else {
        const beforeWhere = head.slice(0, whereMatch.index).trimEnd();
        const existingWhere = head.slice(whereMatch.index + whereMatch[0].length).trim();
        const endsWithLogical = /\b(and|or)\s*$/i.test(existingWhere);

        const mergedWhere = !existingWhere
            ? trimmedCondition
            : endsWithLogical
                ? `${existingWhere} (${trimmedCondition})`
                : `${existingWhere} AND (${trimmedCondition})`;

        main = `${beforeWhere} where ${mergedWhere}`;
    }

    const filtered = tail ? `${main} ${tail}` : main;

    return prefix ? `${prefix}${filtered}` : filtered;
}

export function buildFilterOrderQuery(rawQuery: string, condition: string, orderByExpr: string): string {
    const withFilter = buildFilterQuery(rawQuery, condition);
    const trimmedOrder = orderByExpr.trim();
    if (!trimmedOrder) return withFilter;

    const normalized = stripLegacyFilterWrapper(withFilter.trim().replace(/;\s*$/, ''));
    const { prefix, base } = splitLastQuery(normalized);
    const inner = stripLegacyFilterWrapper(base.replace(/;\s*$/, '').trim());
    const ordered = `select * from (${inner}) as _zentro_order order by ${trimmedOrder}`;
    return prefix ? `${prefix}${ordered}` : ordered;
}

export { getQueryShape };
