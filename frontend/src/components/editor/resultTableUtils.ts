export function normalizeDataTypeLabel(dataType: string | undefined): string {
    const raw = (dataType || '').trim().toLowerCase();
    if (!raw) return 'unknown';

    const compacted = raw
        .replace(/\s+/g, ' ')
        .replace(/\bwithout time zone\b/g, '')
        .replace(/\bwith time zone\b/g, 'tz')
        .trim();

    const aliasMap: Record<string, string> = {
        'character varying': 'varchar',
        'timestamp tz': 'timestamptz',
        'timestamp with tz': 'timestamptz',
        'timestamp': 'timestamp',
        'double precision': 'float8',
        'real': 'float4',
        'integer': 'int4',
        'bigint': 'int8',
        'smallint': 'int2',
        'boolean': 'bool',
    };

    return aliasMap[compacted] || compacted;
}

export function reorderDataColumnIds(ids: string[], activeId: string, overId: string): string[] {
    if (activeId === overId) return ids;
    const from = ids.indexOf(activeId);
    const to = ids.indexOf(overId);
    if (from < 0 || to < 0) return ids;

    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
}

function escapeSqlLikeLiteral(value: string): string {
    return value
        .replace(/~/g, '~~')
        .replace(/'/g, "''")
        .replace(/%/g, '~%')
        .replace(/_/g, '~_');
}

function quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
}

export function buildHeaderColumnFilterExpr(
    filters: Record<string, string>,
    driver: string | undefined,
): string {
    const likeOp = (driver || '').toLowerCase().includes('postgres') ? 'ILIKE' : 'LIKE';
    const clauses = Object.entries(filters)
        .map(([column, value]) => ({
            column,
            value: value.trim(),
        }))
        .filter((entry) => entry.value.length > 0)
        .map((entry) => {
            const escaped = escapeSqlLikeLiteral(entry.value);
            return `CAST(${quoteIdentifier(entry.column)} AS TEXT) ${likeOp} '%${escaped}%' ESCAPE '~'`;
        });

    return clauses.join(' AND ');
}

export function computeAutoFitWidth(
    texts: string[],
    options?: { min?: number; max?: number; charWidth?: number; padding?: number },
): number {
    const min = options?.min ?? 72;
    const max = options?.max ?? 720;
    const charWidth = options?.charWidth ?? 7.4;
    const padding = options?.padding ?? 26;

    const longest = texts.reduce((acc, value) => Math.max(acc, (value || '').length), 0);
    const raw = Math.ceil(longest * charWidth + padding);
    return Math.max(min, Math.min(max, raw));
}
