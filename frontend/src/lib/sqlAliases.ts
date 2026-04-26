const SIMPLE_IDENT_RE = /^[A-Za-z_][A-Za-z0-9_$]*$/;
const TABLE_ALIAS_RE = /(?:from|join)\s+((?:"[^"]+"|[A-Za-z_][A-Za-z0-9_$]*)(?:\.(?:"[^"]+"|[A-Za-z_][A-Za-z0-9_$]*))*)(?:\s+(?:as\s+)?("[^"]+"|[A-Za-z_][A-Za-z0-9_$]*))?/gi;
const RESERVED_ALIAS_WORDS = new Set([
    'on',
    'where',
    'group',
    'order',
    'limit',
    'offset',
    'fetch',
    'inner',
    'left',
    'right',
    'full',
    'cross',
    'join',
]);

const unquoteIdentifier = (value: string): string => {
    const trimmed = value.trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
        return trimmed.slice(1, -1).replace(/""/g, '"');
    }
    return trimmed;
};

const splitSelectItems = (source: string): string[] => {
    const items: string[] = [];
    let current = '';
    let depth = 0;
    let inSingle = false;
    let inDouble = false;

    for (let i = 0; i < source.length; i += 1) {
        const ch = source[i];
        const next = source[i + 1];

        if (!inDouble && ch === '\'') {
            current += ch;
            if (inSingle && next === '\'') {
                current += next;
                i += 1;
            } else {
                inSingle = !inSingle;
            }
            continue;
        }

        if (!inSingle && ch === '"') {
            current += ch;
            if (inDouble && next === '"') {
                current += next;
                i += 1;
            } else {
                inDouble = !inDouble;
            }
            continue;
        }

        if (!inSingle && !inDouble) {
            if (ch === '(') depth += 1;
            else if (ch === ')' && depth > 0) depth -= 1;
            else if (ch === ',' && depth === 0) {
                const item = current.trim();
                if (item) items.push(item);
                current = '';
                continue;
            }
        }

        current += ch;
    }

    const tail = current.trim();
    if (tail) items.push(tail);
    return items;
};

const isTopLevelWord = (sql: string, index: number, word: string): boolean => {
    const before = index === 0 ? ' ' : sql[index - 1];
    const after = sql[index + word.length] || ' ';
    return /\W/.test(before) && /\W/.test(after);
};

const findTopLevelSelectFromSpan = (query: string): { start: number; end: number } | null => {
    const sql = query.replace(/;\s*$/, '');
    let depth = 0;
    let inSingle = false;
    let inDouble = false;
    let selectAt = -1;

    for (let i = 0; i < sql.length; i += 1) {
        const ch = sql[i];
        const next = sql[i + 1];

        if (!inDouble && ch === '\'') {
            if (inSingle && next === '\'') {
                i += 1;
            } else {
                inSingle = !inSingle;
            }
            continue;
        }
        if (!inSingle && ch === '"') {
            if (inDouble && next === '"') {
                i += 1;
            } else {
                inDouble = !inDouble;
            }
            continue;
        }
        if (inSingle || inDouble) continue;

        if (ch === '(') { depth += 1; continue; }
        if (ch === ')' && depth > 0) { depth -= 1; continue; }
        if (depth !== 0) continue;

        const rest = sql.slice(i).toLowerCase();
        if (selectAt < 0 && rest.startsWith('select') && isTopLevelWord(sql, i, 'select')) {
            selectAt = i + 'select'.length;
            i += 'select'.length - 1;
            continue;
        }
        if (selectAt >= 0 && rest.startsWith('from') && isTopLevelWord(sql, i, 'from')) {
            return { start: selectAt, end: i };
        }
    }

    return null;
};

const parseAliasFromItem = (item: string): string | null => {
    const asAlias = item.match(/\s+as\s+("[^"]+"|[A-Za-z_][A-Za-z0-9_$]*)\s*$/i);
    if (asAlias) return unquoteIdentifier(asAlias[1]);

    const bareAlias = item.match(/\s+("[^"]+"|[A-Za-z_][A-Za-z0-9_$]*)\s*$/);
    if (bareAlias) {
        const alias = unquoteIdentifier(bareAlias[1]);
        const itemWithoutAlias = item.slice(0, item.length - bareAlias[0].length).trim();
        if (itemWithoutAlias && !SIMPLE_IDENT_RE.test(itemWithoutAlias)) return alias;
    }

    return null;
};

export function extractSelectAliases(query: string): string[] {
    const span = findTopLevelSelectFromSpan(query);
    if (!span) return [];
    const selectBody = query.slice(span.start, span.end).trim();
    if (!selectBody) return [];

    const aliases = splitSelectItems(selectBody)
        .map(parseAliasFromItem)
        .filter((value): value is string => Boolean(value));

    return Array.from(new Set(aliases));
}

export function extractTableAliases(query: string): string[] {
    const aliases: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = TABLE_ALIAS_RE.exec(query)) !== null) {
        const tableRef = (match[1] || '').trim();
        const explicitAlias = unquoteIdentifier(match[2] || '');
        const aliasCandidate = explicitAlias || tableRef.split('.').map(unquoteIdentifier).pop() || '';
        const normalizedAlias = aliasCandidate.trim();
        if (!normalizedAlias) continue;
        if (RESERVED_ALIAS_WORDS.has(normalizedAlias.toLowerCase())) continue;
        aliases.push(normalizedAlias);
    }
    return Array.from(new Set(aliases));
}
