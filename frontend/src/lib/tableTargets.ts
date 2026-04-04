export const NEW_TABLE_DRAFT_PREFIX = '__new_table__:';

export interface ParsedTableTarget {
    schema: string;
    table: string;
    qualifiedName: string;
    isCreateDraft: boolean;
}

export function buildNewTableDraftTarget(schema: string, table: string): string {
    const qualifiedName = schema ? `${schema}.${table}` : table;
    return `${NEW_TABLE_DRAFT_PREFIX}${qualifiedName}`;
}

export function parseTableTarget(target: string): ParsedTableTarget {
    const isCreateDraft = target.startsWith(NEW_TABLE_DRAFT_PREFIX);
    const normalized = isCreateDraft ? target.slice(NEW_TABLE_DRAFT_PREFIX.length) : target;
    const parts = normalized.split('.').filter(Boolean);
    const schema = parts.length > 1 ? parts[0] : '';
    const table = parts.length > 1 ? parts.slice(1).join('.') : (parts[0] || '');
    const qualifiedName = schema ? `${schema}.${table}` : table;

    return {
        schema,
        table,
        qualifiedName,
        isCreateDraft,
    };
}
