import { models } from '../../wailsjs/go/models';

export interface DraftRow {
    id: string;
    kind: 'new' | 'duplicate';
    values: string[];
    insertAfterRowIndex: number | null;
    sourceRowIndex?: number;
}

export interface DisplayRow {
    key: string;
    kind: 'persisted' | 'draft';
    values: string[];
    persistedIndex?: number;
    draft?: DraftRow;
}

const FROM_PATTERN = /\bFROM\s+([`"\[]?[A-Za-z0-9_]+[`"\]]?(?:\s*\.\s*[`"\[]?[A-Za-z0-9_]+[`"\]]?)?)/i;

export function parseTableReference(query?: string, fallbackTable?: string): { schema: string; table: string } {
    const rawTarget = query?.match(FROM_PATTERN)?.[1] || fallbackTable || '';
    const parts = rawTarget
        .split('.')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => part.replace(/^[`"\[]|[`"\]]$/g, ''));

    if (parts.length >= 2) {
        return {
            schema: parts[parts.length - 2],
            table: parts[parts.length - 1],
        };
    }

    return {
        schema: '',
        table: parts[0] || '',
    };
}

export function resolveQualifiedTableName(query?: string, fallbackTable?: string): string {
    const { schema, table } = parseTableReference(query, fallbackTable);
    if (!table) return '';
    if (schema) {
        return `"${schema}"."${table}"`;
    }
    return `"${table}"`;
}

export function getDraftDefaultValues(columns: string[], columnDefs: models.ColumnDef[]): string[] {
    const defsByName = new Map(columnDefs.map((column) => [column.Name, column]));
    return columns.map((columnName) => {
        const rawDefault = defsByName.get(columnName)?.DefaultValue?.trim() || '';
        if (!rawDefault) return '';
        return rawDefault.replace(/^'(.*)'$/, '$1');
    });
}

export function buildDisplayRows(rows: string[][], draftRows: DraftRow[]): DisplayRow[] {
    const displayRows: DisplayRow[] = [];
    const topDraftRows = draftRows.filter((draft) => draft.insertAfterRowIndex === null);
    const draftsByAnchor = new Map<number, DraftRow[]>();

    draftRows
        .filter((draft) => draft.insertAfterRowIndex !== null)
        .forEach((draft) => {
            const anchor = draft.insertAfterRowIndex as number;
            const existing = draftsByAnchor.get(anchor) || [];
            existing.push(draft);
            draftsByAnchor.set(anchor, existing);
        });

    topDraftRows.forEach((draft) => {
        displayRows.push({
            key: `d:${draft.id}`,
            kind: 'draft',
            values: draft.values,
            draft,
        });
    });

    rows.forEach((row, persistedIndex) => {
        displayRows.push({
            key: `p:${persistedIndex}`,
            kind: 'persisted',
            values: row,
            persistedIndex,
        });

        (draftsByAnchor.get(persistedIndex) || []).forEach((draft) => {
            displayRows.push({
                key: `d:${draft.id}`,
                kind: 'draft',
                values: draft.values,
                draft,
            });
        });
    });

    return displayRows;
}

export function escapeSqlString(value: string): string {
    return value.replace(/'/g, "''");
}

function isNumericLikeType(dataType: string): boolean {
    return /(int|decimal|numeric|float|real|double|money|smallmoney|serial)/i.test(dataType);
}

function isBooleanLikeType(dataType: string): boolean {
    return /\b(bool|boolean|bit)\b/i.test(dataType);
}

function isTemporalLikeType(dataType: string): boolean {
    return /(datetime|timestamp|timestamptz|datetime2|smalldatetime|datetimeoffset|\bdate\b|\btime\b)/i.test(dataType);
}

function isTimezoneAwareType(dataType: string): boolean {
    return /(timestamptz|datetimeoffset|timestamp with time zone|time with time zone)/i.test(dataType);
}

function normalizeTimezoneOffset(offset: string): string {
    const normalized = offset.trim().toUpperCase();
    if (normalized === 'Z') return '+00:00';
    if (/^[+-]\d{2}$/.test(normalized)) {
        return `${normalized}:00`;
    }
    if (/^[+-]\d{4}$/.test(normalized)) {
        return `${normalized.slice(0, 3)}:${normalized.slice(3)}`;
    }
    return normalized;
}

function normalizeTemporalValue(value: string, dataType: string): string {
    const trimmed = value.trim();
    if (!trimmed) return trimmed;

    const datetimeMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2}(?:\.\d+)?)(?:\s*(Z|[+-]\d{2}(?::?\d{2})?))?/i);
    if (datetimeMatch) {
        const [, datePart, timePart, offsetPart] = datetimeMatch;
        let normalized = `${datePart} ${timePart}`;
        if (offsetPart && isTimezoneAwareType(dataType)) {
            normalized += ` ${normalizeTimezoneOffset(offsetPart)}`;
        }
        return normalized;
    }

    const timeMatch = trimmed.match(/^(\d{2}:\d{2}:\d{2}(?:\.\d+)?)(?:\s*(Z|[+-]\d{2}(?::?\d{2})?))?/i);
    if (timeMatch) {
        const [, timePart, offsetPart] = timeMatch;
        let normalized = timePart;
        if (offsetPart && isTimezoneAwareType(dataType)) {
            normalized += ` ${normalizeTimezoneOffset(offsetPart)}`;
        }
        return normalized;
    }

    const dateMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
        return dateMatch[1];
    }

    return trimmed;
}

export function toSqlLiteral(value: string, columnDef?: models.ColumnDef): string {
    if (!columnDef) {
        return `'${escapeSqlString(value)}'`;
    }

    if (value.trim() === '' && columnDef.IsNullable) {
        return 'NULL';
    }

    if (isBooleanLikeType(columnDef.DataType)) {
        const normalized = value.trim().toLowerCase();
        if (['1', 'true', 't', 'yes'].includes(normalized)) return '1';
        if (['0', 'false', 'f', 'no'].includes(normalized)) return '0';
    }

    if (isNumericLikeType(columnDef.DataType) && /^-?\d+(\.\d+)?$/.test(value.trim())) {
        return value.trim();
    }

    if (isTemporalLikeType(columnDef.DataType)) {
        return `'${escapeSqlString(normalizeTemporalValue(value, columnDef.DataType))}'`;
    }

    return `'${escapeSqlString(value)}'`;
}

export function buildInsertScript(
    tableName: string,
    columns: string[],
    draftRows: DraftRow[],
    columnDefs: models.ColumnDef[],
    sourceQuery?: string,
): string {
    const qualifiedTable = resolveQualifiedTableName(sourceQuery, tableName);
    const defsByName = new Map(columnDefs.map((column) => [column.Name, column]));
    const columnList = columns.map((column) => `"${column}"`).join(', ');

    return draftRows
        .map((draftRow) => {
            const valuesSql = draftRow.values
                .map((value, index) => toSqlLiteral(value, defsByName.get(columns[index])))
                .join(', ');
            return `INSERT INTO ${qualifiedTable} (${columnList}) VALUES (${valuesSql});`;
        })
        .join('\n');
}
