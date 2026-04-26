import type { SchemaNode } from '../../stores/schemaStore';
import { normalizeIdentifier, stripIdentifierQuotes } from './sqlCompletionIdentifiers';

export interface SqlPositionLike {
    lineNumber: number;
    column: number;
}

export interface SqlModelLike {
    getValue(): string;
    getOffsetAt(position: SqlPositionLike): number;
}

export interface TableNavigationMatch {
    schemaName: string;
    tableName: string;
    qualifiedName: string;
    objectKind: SchemaObjectKind;
}

export type SchemaObjectKind = 'table' | 'view' | 'materialized_view' | 'foreign_table' | 'function';

export type TableNavigationResolution =
    | { kind: 'not_found'; lookup: string }
    | { kind: 'single_match'; lookup: string; match: TableNavigationMatch }
    | { kind: 'multiple_matches'; lookup: string; matches: TableNavigationMatch[] };

const IDENTIFIER_CHAR = /[A-Za-z0-9_$.[\]`"]/;

export type SqlObjectNavigationResolution =
    | { kind: 'not_found'; lookup: string }
    | { kind: 'single_match'; lookup: string; match: TableNavigationMatch }
    | { kind: 'multiple_matches'; lookup: string; matches: TableNavigationMatch[] };

export function resolveTableNavigationAtPosition(
    model: SqlModelLike,
    position: SqlPositionLike,
    schemas: SchemaNode[],
): TableNavigationResolution {
    const text = model.getValue();
    const offset = model.getOffsetAt(position);
    const chain = extractIdentifierChainAtOffset(text, offset);
    const lookup = chain?.raw ?? '';
    if (!chain || chain.segments.length === 0) {
        return { kind: 'not_found', lookup };
    }

    const matches = findTableMatches(schemas, chain.segments);
    if (matches.length === 0) return { kind: 'not_found', lookup };
    if (matches.length === 1) return { kind: 'single_match', lookup, match: matches[0] };
    return { kind: 'multiple_matches', lookup, matches };
}

export function resolveSqlObjectNavigationAtPosition(
    model: SqlModelLike,
    position: SqlPositionLike,
    schemas: SchemaNode[],
): SqlObjectNavigationResolution {
    const text = model.getValue();
    const offset = model.getOffsetAt(position);
    const chain = extractIdentifierChainAtOffset(text, offset);
    const lookup = chain?.raw ?? '';
    if (!chain || chain.segments.length === 0) {
        return { kind: 'not_found', lookup };
    }

    const matches = findSqlObjectMatches(schemas, chain.segments);
    if (matches.length === 0) return { kind: 'not_found', lookup };
    if (matches.length === 1) return { kind: 'single_match', lookup, match: matches[0] };
    return { kind: 'multiple_matches', lookup, matches };
}

export function findTableMatches(schemas: SchemaNode[], segments: string[]): TableNavigationMatch[] {
    return findMatchesByKinds(schemas, segments, new Set<SchemaObjectKind>(['table', 'view', 'materialized_view', 'foreign_table']));
}

export function findSqlObjectMatches(schemas: SchemaNode[], segments: string[]): TableNavigationMatch[] {
    return findMatchesByKinds(schemas, segments, new Set<SchemaObjectKind>(['table', 'view', 'materialized_view', 'foreign_table', 'function']));
}

function findMatchesByKinds(
    schemas: SchemaNode[],
    segments: string[],
    kinds: Set<SchemaObjectKind>,
): TableNavigationMatch[] {
    if (!segments.length) return [];

    const normalized = segments.map((segment) => normalizeIdentifier(segment));
    const objectName = normalized[normalized.length - 1];
    const schemaHint = normalized.length >= 2 ? normalized[normalized.length - 2] : '';
    if (!objectName) return [];

    const results: TableNavigationMatch[] = [];

    schemas.forEach((schemaNode) => {
        const schemaName = schemaNode.Name || '';
        if (!schemaName) return;
        if (schemaHint && normalizeIdentifier(schemaName) !== schemaHint) return;

        const objects = collectSchemaObjectNames(schemaNode, kinds);
        objects.forEach(({ name, kind }) => {
            if (normalizeIdentifier(name) !== objectName) return;
            results.push({
                schemaName,
                tableName: name,
                qualifiedName: `${schemaName}.${name}`,
                objectKind: kind,
            });
        });
    });

    const unique = new Map<string, TableNavigationMatch>();
    results.forEach((item) => {
        const key = `${normalizeIdentifier(item.schemaName)}:${normalizeIdentifier(item.tableName)}:${item.objectKind}`;
        if (!unique.has(key)) unique.set(key, item);
    });

    return [...unique.values()].sort((a, b) => a.qualifiedName.localeCompare(b.qualifiedName));
}

interface IdentifierChain {
    raw: string;
    segments: string[];
}

function extractIdentifierChainAtOffset(text: string, offset: number): IdentifierChain | null {
    if (!text) return null;
    const pivot = pickPivotIndex(text, offset);
    if (pivot < 0) return null;

    let start = pivot;
    let end = pivot + 1;

    while (start > 0 && IDENTIFIER_CHAR.test(text[start - 1])) start--;
    while (end < text.length && IDENTIFIER_CHAR.test(text[end])) end++;

    const raw = text.slice(start, end).trim();
    if (!raw) return null;

    const segments = parseQualifiedIdentifier(raw)
        .map((segment) => stripIdentifierQuotes(segment).trim())
        .filter(Boolean);

    if (segments.length > 2) {
        return { raw, segments: segments.slice(-2) };
    }

    return { raw, segments };
}

function pickPivotIndex(text: string, offset: number): number {
    const clamped = Math.max(0, Math.min(offset, text.length));
    if (clamped < text.length && IDENTIFIER_CHAR.test(text[clamped])) {
        return clamped;
    }
    if (clamped > 0 && IDENTIFIER_CHAR.test(text[clamped - 1])) {
        return clamped - 1;
    }
    return -1;
}

function parseQualifiedIdentifier(value: string): string[] {
    const segments: string[] = [];
    let i = 0;

    while (i < value.length) {
        while (i < value.length && value[i] === '.') i++;
        if (i >= value.length) break;
        const parsed = parseIdentifierSegment(value, i);
        if (!parsed) break;
        segments.push(parsed.segment);
        i = parsed.nextIndex;
        if (value[i] === '.') i++;
    }

    return segments;
}

function parseIdentifierSegment(value: string, startIndex: number): { segment: string; nextIndex: number } | null {
    const ch = value[startIndex];
    if (!ch) return null;

    if (ch === '"' || ch === '`') {
        const close = value.indexOf(ch, startIndex + 1);
        if (close === -1) return null;
        return { segment: value.slice(startIndex, close + 1), nextIndex: close + 1 };
    }

    if (ch === '[') {
        const close = value.indexOf(']', startIndex + 1);
        if (close === -1) return null;
        return { segment: value.slice(startIndex, close + 1), nextIndex: close + 1 };
    }

    if (!/[A-Za-z0-9_$]/.test(ch)) return null;
    let i = startIndex + 1;
    while (i < value.length && /[A-Za-z0-9_$]/.test(value[i])) i++;
    return { segment: value.slice(startIndex, i), nextIndex: i };
}

function collectSchemaObjectNames(
    schema: SchemaNode,
    kinds: Set<SchemaObjectKind>,
): Array<{ name: string; kind: SchemaObjectKind }> {
    const all: Array<{ kind: SchemaObjectKind; values: string[] | undefined }> = [
        { kind: 'table', values: schema.Tables },
        { kind: 'view', values: schema.Views },
        { kind: 'materialized_view', values: schema.MaterializedViews },
        { kind: 'foreign_table', values: schema.ForeignTables },
        { kind: 'function', values: schema.Functions },
    ];

    const items: Array<{ name: string; kind: SchemaObjectKind }> = [];
    all.forEach(({ kind, values }) => {
        if (!kinds.has(kind)) return;
        (values || []).forEach((name) => {
            if (name && name.trim()) {
                items.push({ name, kind });
            }
        });
    });
    return items;
}
