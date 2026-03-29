import { SchemaNode } from '../../stores/schemaStore';
import { normalizeIdentifier } from './sqlCompletionIdentifiers';
import { SqlAnalysis, SqlColumnLike, SqlCompletionEnv, SqlSourceRef } from './sqlCompletionTypes';

export function buildCatalogIndex(schemas: SchemaNode[]) {
    const entries: Array<{ schemaName: string; name: string; kind: 'table' | 'view'; duplicateCount: number }> = [];
    const counts = new Map<string, number>();
    schemas.forEach((schema) => {
        (schema.Tables || []).forEach((name) => {
            const key = normalizeIdentifier(name);
            counts.set(key, (counts.get(key) || 0) + 1);
            entries.push({ schemaName: schema.Name, name, kind: 'table', duplicateCount: 0 });
        });
        (schema.Views || []).forEach((name) => {
            const key = normalizeIdentifier(name);
            counts.set(key, (counts.get(key) || 0) + 1);
            entries.push({ schemaName: schema.Name, name, kind: 'view', duplicateCount: 0 });
        });
    });
    return {
        entries: entries.map((entry) => ({ ...entry, duplicateCount: counts.get(normalizeIdentifier(entry.name)) || 0 })),
    };
}

export function findCatalogMatches(schemas: SchemaNode[], objectName: string, schemaName?: string) {
    const normObject = normalizeIdentifier(objectName);
    const normSchema = schemaName ? normalizeIdentifier(schemaName) : '';
    const matches: Array<{ schemaName: string; name: string; kind: 'table' | 'view' }> = [];
    schemas.forEach((schema) => {
        if (normSchema && normalizeIdentifier(schema.Name) !== normSchema) return;
        (schema.Tables || []).forEach((name) => { if (normalizeIdentifier(name) === normObject) matches.push({ schemaName: schema.Name, name, kind: 'table' }); });
        (schema.Views || []).forEach((name) => { if (normalizeIdentifier(name) === normObject) matches.push({ schemaName: schema.Name, name, kind: 'view' }); });
    });
    return matches;
}

export function findPreferredCatalogMatches(
    schemas: SchemaNode[],
    objectName: string,
    schemaName?: string,
    currentSchema?: string,
) {
    const directMatches = findCatalogMatches(schemas, objectName, schemaName);
    if (schemaName) return directMatches;

    const preferredSchema = normalizeIdentifier(currentSchema || '');
    if (!preferredSchema) return directMatches;

    const preferred = directMatches.filter(
        (match) => normalizeIdentifier(match.schemaName) === preferredSchema,
    );
    return preferred.length > 0 ? preferred : directMatches;
}

export function resolveSourcesFromIdentifier(
    identifier: string,
    sources: SqlSourceRef[],
    ctes: Map<string, SqlSourceRef>,
    schemas: SchemaNode[],
): SqlSourceRef[] {
    const norm = normalizeIdentifier(identifier);
    if (!norm) return [];
    const result = sources.filter((source) => {
        const candidates = [
            normalizeIdentifier(source.alias || ''),
            normalizeIdentifier(source.name || ''),
            normalizeIdentifier(source.schemaName ? `${source.schemaName}.${source.name}` : ''),
        ];
        return candidates.includes(norm);
    });
    if (result.length > 0) return result;
    const cte = ctes.get(norm);
    if (cte) return [cte];
    const catalogMatches = findCatalogMatches(schemas, identifier, undefined);
    return catalogMatches.map((entry) => ({ kind: entry.kind, name: entry.name, schemaName: entry.schemaName, alias: entry.name }));
}

export async function resolveColumnsForSources(
    sources: SqlSourceRef[],
    analysis: SqlAnalysis,
    env: SqlCompletionEnv,
    shouldAbort: () => boolean,
): Promise<Array<SqlColumnLike & { detail?: string }>> {
    if (shouldAbort()) return [];
    const unique = new Map<string, SqlColumnLike & { detail?: string }>();
    const targetSources = sources.slice(0, 8);
    for (const source of targetSources) {
        if (shouldAbort()) return [];
        if (source.columns && source.columns.length > 0) {
            source.columns.forEach((column) => {
                const key = normalizeIdentifier(column);
                if (!unique.has(key)) unique.set(key, { Name: column, detail: source.alias || source.name });
            });
            continue;
        }
        if (source.kind === 'cte' || source.kind === 'subquery') continue;
        const matches = findPreferredCatalogMatches(
            env.schemas,
            source.name,
            source.schemaName,
            env.currentSchema,
        );
        for (const match of matches) {
            if (shouldAbort()) return [];
            const columns = await env.fetchColumns(match.schemaName, match.name);
            if (shouldAbort()) return [];
            columns.forEach((column) => {
                const key = normalizeIdentifier(column.Name);
                if (!unique.has(key)) unique.set(key, { ...column, detail: source.alias || source.name });
            });
        }
    }
    if (unique.size === 0 && analysis.sources.length === 0) return [];
    return Array.from(unique.values()).sort((a, b) => a.Name.localeCompare(b.Name));
}
