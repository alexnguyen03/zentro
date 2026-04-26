import { languages } from 'monaco-editor';

export interface SqlSuggestionColumnLike {
    Name: string;
    DataType?: string;
    IsPrimaryKey?: boolean;
    IsNullable?: boolean;
    DefaultValue?: string;
}

export interface TableSuggestionMetadata {
    schemaName: string;
    tableName: string;
    objectKind: 'table' | 'view';
    profileKey: string;
    dbName: string;
    driver: string;
}

export type TableCompletionItem = languages.CompletionItem & {
    __zentroTableMeta?: TableSuggestionMetadata;
};

export function isTableCompletionItem(item: languages.CompletionItem): item is TableCompletionItem {
    return Boolean((item as TableCompletionItem).__zentroTableMeta);
}

export function formatTableSuggestionDocumentation(
    meta: TableSuggestionMetadata,
    columns: SqlSuggestionColumnLike[],
    options: { error?: boolean } = {},
): { value: string; isTrusted: boolean; supportHtml: boolean } {
    const objectLabel = meta.objectKind === 'view' ? 'View' : 'Table';
    const qualifiedName = `${meta.schemaName}.${meta.tableName}`;
    const escapeHtml = (value: string) =>
        value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

    const renderStatusTable = (status: string, message: string) =>
        `<div class="zentro-suggest-doc">` +
        `<div class="zentro-suggest-doc__title">${escapeHtml(objectLabel)} - ${escapeHtml(qualifiedName)}</div>` +
        `<table class="zentro-suggest-doc__table">` +
        `<thead><tr><th>Status</th><th>Message</th></tr></thead>` +
        `<tbody><tr><td>${escapeHtml(status)}</td><td>${escapeHtml(message)}</td></tr></tbody>` +
        `</table>` +
        `</div>`;

    if (options.error) {
        return {
            value: renderStatusTable('Error', 'Unable to load column metadata.'),
            isTrusted: true,
            supportHtml: true,
        };
    }
    if (!columns || columns.length === 0) {
        return {
            value: renderStatusTable('Info', 'No columns found.'),
            isTrusted: true,
            supportHtml: true,
        };
    }

    const rows = columns
        .map((column, index) => {
            const columnName = escapeHtml(column.Name || '(unnamed)');
            const dataType = escapeHtml((column.DataType || 'unknown').trim() || 'unknown');
            const key = column.IsPrimaryKey ? 'PK' : '';
            const nullable = column.IsNullable ? 'YES' : 'NO';
            const defaultValueRaw = (column.DefaultValue || '').trim();
            const defaultValue = escapeHtml(defaultValueRaw || 'NULL');
            return (
                '<tr>' +
                `<td>${index + 1}</td>` +
                `<td>${columnName}</td>` +
                `<td>${dataType}</td>` +
                `<td>${key}</td>` +
                `<td>${nullable}</td>` +
                `<td>${defaultValue}</td>` +
                '</tr>'
            );
        })
        .join('\n');

    return {
        value:
            `<div class="zentro-suggest-doc">` +
            `<div class="zentro-suggest-doc__title">${escapeHtml(objectLabel)} - ${escapeHtml(qualifiedName)}</div>` +
            '<table class="zentro-suggest-doc__table">' +
            '<thead><tr><th>#</th><th>Name</th><th>Data Type</th><th>PK</th><th>Null</th><th>Default</th></tr></thead>' +
            `<tbody>${rows}</tbody>` +
            '</table>' +
            '</div>',
        isTrusted: true,
        supportHtml: true,
    };
}

export async function resolveTableSuggestionItem(
    item: languages.CompletionItem,
    options: {
        shouldAbort: () => boolean;
        fetchColumns: (meta: TableSuggestionMetadata) => Promise<SqlSuggestionColumnLike[]>;
    },
): Promise<languages.CompletionItem> {
    if (!isTableCompletionItem(item)) {
        return item;
    }
    if (options.shouldAbort()) {
        return item;
    }
    const meta = item.__zentroTableMeta!;
    try {
        const columns = await options.fetchColumns(meta);
        if (options.shouldAbort()) {
            return item;
        }
        return {
            ...item,
            documentation: formatTableSuggestionDocumentation(meta, columns),
        };
    } catch {
        if (options.shouldAbort()) {
            return item;
        }
        return {
            ...item,
            documentation: formatTableSuggestionDocumentation(meta, [], { error: true }),
        };
    }
}
