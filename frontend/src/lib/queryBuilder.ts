/**
 * Detects the shape of a SQL SELECT query and merges a filter condition correctly.
 *
 * Patterns:
 *  1. Bare   — `SELECT … FROM table`             → `<query> AS _zentro_filter\nWHERE <filter>`
 *  2. HasWhere — `SELECT … FROM table WHERE …`   → `SELECT … FROM table WHERE (<existing>) AND (<filter>)`
 *  3. Complex — JOIN, subquery, GROUP BY, etc.   → `SELECT * FROM (\n<query>\n) AS _zentro_filter\nWHERE <filter>`
 */

type QueryShape = 'bare' | 'has-where' | 'complex';

const COMPLEX_KEYWORDS = /\bjoin\b|\bgroup\s+by\b|\bhaving\b|\border\s+by\b|\blimit\b|\bwith\b|\(select\b/i;

function getQueryShape(q: string): QueryShape {
    // Must be a single SELECT … FROM <identifier> statement
    const bare = /^select\s+.+?\s+from\s+[\w"[\].`]+\s*$/i;
    const hasWhere = /^select\s+.+?\s+from\s+[\w"[\].`]+\s+where\s+.+$/i;

    if (COMPLEX_KEYWORDS.test(q)) return 'complex';
    if (hasWhere.test(q)) return 'has-where';
    if (bare.test(q)) return 'bare';
    return 'complex';
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
    const { prefix, base } = splitLastQuery(rawQuery);
    const q = base.replace(/;\s*$/, '').trim();
    const shape = getQueryShape(q);
    
    let filtered: string;
    if (shape === 'bare') {
        filtered = `${q} AS _zentro_filter\nWHERE ${condition}`;
    } else if (shape === 'has-where') {
        // Extract the WHERE clause and wrap both conditions
        const whereIdx = q.search(/\bwhere\b/i);
        const beforeWhere = q.slice(0, whereIdx).trimEnd();
        const existingCondition = q.slice(whereIdx + 5).trim(); // skip 'where '
        filtered = `${beforeWhere} WHERE (${existingCondition}) AND (${condition})`;
    } else {
        // Complex: wrap in subquery
        filtered = `SELECT * FROM (\n${q}\n) AS _zentro_filter\nWHERE ${condition}`;
    }

    return prefix ? `${prefix}${filtered}` : filtered;
}

export { getQueryShape };
