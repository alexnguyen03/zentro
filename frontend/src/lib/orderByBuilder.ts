export type OrderDirection = 'ASC' | 'DESC';

export interface OrderTerm {
    field: string;
    dir: OrderDirection;
}

const SIMPLE_IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_$]*$/;
const QUALIFIED_IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_$]*(\.[A-Za-z_][A-Za-z0-9_$]*)*$/;

const splitTerms = (expr: string): string[] => {
    const out: string[] = [];
    let current = '';
    let inQuote = false;

    for (let i = 0; i < expr.length; i += 1) {
        const ch = expr[i];
        const next = expr[i + 1];
        if (ch === '"') {
            current += ch;
            if (inQuote && next === '"') {
                current += next;
                i += 1;
            } else {
                inQuote = !inQuote;
            }
            continue;
        }
        if (ch === ',' && !inQuote) {
            out.push(current.trim());
            current = '';
            continue;
        }
        current += ch;
    }

    const tail = current.trim();
    if (tail) out.push(tail);
    return out;
};

const parseIdentifier = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
        return trimmed.slice(1, -1).replace(/""/g, '"');
    }
    if (!QUALIFIED_IDENTIFIER_RE.test(trimmed)) return null;
    return trimmed;
};

const quoteIdentifier = (identifier: string): string => {
    if (QUALIFIED_IDENTIFIER_RE.test(identifier)) return identifier;
    return `"${identifier.replace(/"/g, '""')}"`;
};

const findColumnMatch = (field: string, columns: string[]): string | null => {
    const exact = columns.find((column) => column === field);
    if (exact) return exact;
    const lower = field.toLowerCase();
    const caseInsensitive = columns.find((column) => column.toLowerCase() === lower);
    return caseInsensitive || null;
};

export function parseOrderByTerms(expr: string, columns: string[]): { terms: OrderTerm[]; isCustom: boolean } {
    const trimmed = expr.trim();
    if (!trimmed) return { terms: [], isCustom: false };

    const rawTerms = splitTerms(trimmed);
    if (rawTerms.length === 0) return { terms: [], isCustom: false };

    const terms: OrderTerm[] = [];
    for (const rawTerm of rawTerms) {
        const m = rawTerm.match(/^(.*?)(?:\s+(asc|desc))?$/i);
        if (!m) return { terms: [], isCustom: true };

        const parsedField = parseIdentifier((m[1] || '').trim());
        if (!parsedField) return { terms: [], isCustom: true };

        const matchedField = findColumnMatch(parsedField, columns);
        if (!matchedField) return { terms: [], isCustom: true };

        const dir = (m[2] || 'ASC').toUpperCase() as OrderDirection;
        if (dir !== 'ASC' && dir !== 'DESC') return { terms: [], isCustom: true };

        terms.push({ field: matchedField, dir });
    }

    return { terms, isCustom: false };
}

export function serializeOrderByTerms(terms: OrderTerm[]): string {
    return terms
        .map((term) => `${quoteIdentifier(term.field)} ${term.dir}`)
        .join(', ');
}
