import { languages } from 'monaco-editor';
import type { SchemaNode } from '../../stores/schemaStore';
import { analyzeSqlText } from './sqlCompletionAnalysis';
import { buildSqlCompletionItems } from './sqlCompletionBuilder';
import { normalizeIdentifier } from './sqlCompletionIdentifiers';
import { SqlCompletionRegisterMonacoApi, SqlColumnLike, DisposableLike } from './sqlCompletionTypes';

const RESULT_FILTER_MODEL_PATH_SEGMENT = '/result-filter/';
const VIRTUAL_SCHEMA_NAME = '__result_filter__';
const VIRTUAL_TABLE_NAME = '__result_filter_table__';
const FILTER_SQL_PREFIX = `SELECT * FROM ${VIRTUAL_SCHEMA_NAME}.${VIRTUAL_TABLE_NAME} WHERE `;

export interface ResultFilterCompletionParams {
    monaco: SqlCompletionRegisterMonacoApi;
    filterText: string;
    cursorOffset: number;
    currentWord: string;
    range: {
        startLineNumber: number;
        endLineNumber: number;
        startColumn: number;
        endColumn: number;
    };
    columns: string[];
    driver?: string;
    baseQuery?: string;
    schemas?: SchemaNode[];
    fetchColumns?: (schemaName: string, tableName: string) => Promise<SqlColumnLike[]>;
    currentSchema?: string;
}

export interface RegisterResultFilterCompletionParams {
    monaco: SqlCompletionRegisterMonacoApi;
    columns: string[];
    driver?: string;
    baseQuery?: string;
    schemas?: SchemaNode[];
    fetchColumns?: (schemaName: string, tableName: string) => Promise<SqlColumnLike[]>;
    currentSchema?: string;
}

function toColumnDefs(columns: string[]): SqlColumnLike[] {
    return columns
        .map((name) => name.trim())
        .filter((name) => name.length > 0)
        .map((Name) => ({ Name }));
}

function makeFilterUriMatcher(model: { uri?: { path?: string; toString?: () => string } }): boolean {
    const uriPath = model?.uri?.path || model?.uri?.toString?.() || '';
    return uriPath.includes(RESULT_FILTER_MODEL_PATH_SEGMENT);
}

export function createResultFilterModelPath(key: string): string {
    return `inmemory://model${RESULT_FILTER_MODEL_PATH_SEGMENT}${encodeURIComponent(key)}.sql`;
}

// Strip trailing ORDER BY / LIMIT / OFFSET so WHERE can be safely appended.
function stripTrailingOrderLimitOffset(sql: string): string {
    return sql
        .replace(/;\s*$/, '')
        .replace(/\s+(?:order\s+by|limit|offset)\b[\s\S]*$/i, '')
        .trim();
}

export async function buildResultFilterCompletionItems(params: ResultFilterCompletionParams): Promise<languages.CompletionItem[]> {
    // Real-schema branch: reconstruct the full query so alias resolution works correctly.
    if (params.baseQuery && params.schemas && params.schemas.length > 0 && params.fetchColumns) {
        const stripped = stripTrailingOrderLimitOffset(params.baseQuery);
        const hasWhere = /\bwhere\b/i.test(stripped);
        const connector = hasWhere ? ' AND ' : ' WHERE ';
        const prefix = `${stripped}${connector}`;
        const fullText = `${prefix}${params.filterText}`;
        const cursorOffset = prefix.length + Math.max(0, Math.min(params.cursorOffset, params.filterText.length));
        const analysis = analyzeSqlText(fullText, cursorOffset);
        if (analysis.isInCommentOrString) return [];
        return buildSqlCompletionItems(
            analysis,
            params.currentWord,
            params.range,
            {
                monaco: params.monaco,
                schemas: params.schemas,
                driver: params.driver || '',
                currentSchema: params.currentSchema || '',
                fetchColumns: params.fetchColumns,
                fetchRelationships: async () => [],
                templates: [],
            },
        );
    }

    // Fallback: virtual single-table approach (no base query or no schema loaded yet).
    const columnDefs = toColumnDefs(params.columns);
    const fullText = `${FILTER_SQL_PREFIX}${params.filterText}`;
    const cursorOffset = Math.max(0, Math.min(params.cursorOffset, params.filterText.length));
    const analysis = analyzeSqlText(fullText, FILTER_SQL_PREFIX.length + cursorOffset);
    if (analysis.isInCommentOrString) return [];

    const suggestions = await buildSqlCompletionItems(
        analysis,
        params.currentWord,
        params.range,
        {
            monaco: params.monaco,
            schemas: [{ Name: VIRTUAL_SCHEMA_NAME, Tables: [VIRTUAL_TABLE_NAME], Views: [] }],
            driver: params.driver || '',
            fetchColumns: async (schemaName: string, tableName: string) => {
                if (schemaName === VIRTUAL_SCHEMA_NAME && tableName === VIRTUAL_TABLE_NAME) {
                    return columnDefs;
                }
                return [];
            },
            fetchRelationships: async () => [],
            templates: [],
        },
    );

    if (columnDefs.length === 0) return suggestions;
    const columnNames = new Set(columnDefs.map((col) => normalizeIdentifier(col.Name)));

    const adjusted = suggestions.map((item) => {
        const label = normalizeIdentifier(String(item.label || ''));
        if (!columnNames.has(label)) return item;
        const baseSortText = item.sortText || String(item.label || '');
        return { ...item, sortText: `!${baseSortText}` };
    });

    adjusted.sort((a, b) => {
        const aIsColumn = columnNames.has(normalizeIdentifier(String(a.label || '')));
        const bIsColumn = columnNames.has(normalizeIdentifier(String(b.label || '')));
        if (aIsColumn !== bIsColumn) return aIsColumn ? -1 : 1;
        const aSort = a.sortText || String(a.label || '');
        const bSort = b.sortText || String(b.label || '');
        return aSort.localeCompare(bSort);
    });

    return adjusted;
}

export function registerResultFilterCompletion(params: RegisterResultFilterCompletionParams): DisposableLike {
    const provider: languages.CompletionItemProvider = {
        triggerCharacters: ['.', ',', '('],
        provideCompletionItems: async (model, position, _context, token) => {
            if (!makeFilterUriMatcher(model)) return { suggestions: [] };
            if (token?.isCancellationRequested) return { suggestions: [] };

            const filterText = model.getValue();
            const cursorOffset = typeof model.getOffsetAt === 'function'
                ? model.getOffsetAt(position)
                : filterText.length;
            const word = model.getWordUntilPosition(position);
            const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn,
            };

            const suggestions = await buildResultFilterCompletionItems({
                monaco: params.monaco,
                filterText,
                cursorOffset,
                currentWord: word.word || '',
                range,
                columns: params.columns,
                driver: params.driver,
                baseQuery: params.baseQuery,
                schemas: params.schemas,
                fetchColumns: params.fetchColumns,
                currentSchema: params.currentSchema,
            });
            if (token?.isCancellationRequested) return { suggestions: [] };
            return { suggestions };
        },
    };

    return params.monaco.languages.registerCompletionItemProvider('sql', provider);
}
