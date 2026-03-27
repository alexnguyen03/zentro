import { SchemaNode } from '../../stores/schemaStore';
import { resolveSqlDriverFacade } from './sqlDriverFacade';
export { normalizeDriverKey } from './sqlDriverFacade';

export function normalizeIdentifier(value: string): string {
    return stripIdentifierQuotes(value).trim().toLowerCase();
}

export function stripIdentifierQuotes(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return '';
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith('`') && trimmed.endsWith('`'))) {
        return trimmed.slice(1, -1);
    }
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
}

function shouldQuoteIdentifier(identifier: string): boolean {
    return /[^a-zA-Z0-9_]/.test(identifier) || /^[0-9]/.test(identifier);
}

export function quoteIdentifierForDriver(identifier: string, driver: string): string {
    const id = stripIdentifierQuotes(identifier);
    if (!id) return identifier;
    if (!shouldQuoteIdentifier(id)) return id;
    const facade = resolveSqlDriverFacade(driver);
    if (!facade) return `"${id}"`;
    return facade.quoteIdentifier(id);
}

export function generateAliasFromObjectName(objectName: string): string {
    const stripped = stripIdentifierQuotes(objectName).trim();
    if (!stripped) return 't';

    const normalized = stripped.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
    const words = normalized.match(/[A-Za-z0-9]+/g) || [];
    if (words.length === 0) return 't';

    const alias = words
        .map((word) => word[0]?.toLowerCase() || '')
        .join('')
        .replace(/[^a-z0-9_]/g, '');

    if (!alias) return 't';
    if (/^[0-9]/.test(alias)) return `t${alias}`;
    return alias;
}

export function getSchemasForActiveDatabase(
    trees: Record<string, SchemaNode[]>,
    profileName: string,
    dbName: string,
): SchemaNode[] {
    if (!profileName || !dbName) return [];
    const key = `${profileName}:${dbName}`;
    return trees[key] || [];
}
