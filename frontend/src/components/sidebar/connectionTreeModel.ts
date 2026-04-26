import type { SchemaNode } from '../../stores/schemaStore';
import type {
    CategoryGroupNode,
    DriverCategoryDefinition,
    ObjectLeafNode,
    SchemaBucketNode,
} from './connectionTreeTypes';

interface BuildCategoryTreeArgs {
    schemas: SchemaNode[] | undefined;
    definitions: DriverCategoryDefinition[];
    filter: string;
    fuzzyMatch: boolean;
    includeEmptyCategories?: boolean;
}

function normalize(text: string): string {
    return text.trim().toLowerCase();
}

function isSubsequenceMatch(value: string, pattern: string): boolean {
    if (!pattern) return true;
    let index = 0;
    for (let i = 0; i < value.length && index < pattern.length; i += 1) {
        if (value[i] === pattern[index]) {
            index += 1;
        }
    }
    return index === pattern.length;
}

function matches(value: string, keyword: string, fuzzyMatch: boolean): boolean {
    const normalizedValue = normalize(value);
    if (!keyword) return true;
    if (normalizedValue.includes(keyword)) return true;
    if (!fuzzyMatch) return false;
    return isSubsequenceMatch(normalizedValue, keyword);
}

function buildSchemaBucket(
    definition: DriverCategoryDefinition,
    schema: SchemaNode,
    filter: string,
    fuzzyMatch: boolean,
): SchemaBucketNode | null {
    const allItems = definition.getItems(schema);
    if (allItems.length === 0 && !filter) return null;

    const categoryMatch = filter.length > 0 && matches(definition.label, filter, fuzzyMatch);
    const schemaName = schema.Name || '';
    const schemaMatch = filter.length > 0 && matches(schemaName, filter, fuzzyMatch);
    const filteredItems = allItems.filter((item) => {
        if (!filter) return true;
        if (categoryMatch || schemaMatch) return true;
        return matches(item, filter, fuzzyMatch);
    });

    if (filteredItems.length === 0) return null;

    const items: ObjectLeafNode[] = filteredItems.map((item) => ({
        id: `${definition.key}:${schemaName}:${item}`,
        name: item,
        schemaName,
        categoryKey: definition.key,
        categoryLabel: definition.label,
    }));

    return {
        id: `${definition.key}:${schemaName}`,
        schemaName,
        items,
        totalCount: items.length,
    };
}

export function buildCategoryTree({
    schemas,
    definitions,
    filter,
    fuzzyMatch,
    includeEmptyCategories = true,
}: BuildCategoryTreeArgs): CategoryGroupNode[] {
    const normalizedFilter = normalize(filter);
    const source = schemas || [];

    return definitions
        .map((definition) => {
            const buckets = source
                .map((schema) => buildSchemaBucket(definition, schema, normalizedFilter, fuzzyMatch))
                .filter((bucket): bucket is SchemaBucketNode => Boolean(bucket));

            if (buckets.length === 0 && !includeEmptyCategories) return null;

            return {
                id: definition.key,
                key: definition.key,
                label: definition.label,
                icon: definition.icon,
                itemIcon: definition.itemIcon,
                schemas: buckets,
                totalCount: buckets.reduce((sum, bucket) => sum + bucket.totalCount, 0),
                canOpenDefinition: definition.canOpenDefinition,
                allowCreateTable: definition.allowCreateTable,
                dropObjectType: definition.dropObjectType,
            } as CategoryGroupNode;
        })
        .filter((category): category is CategoryGroupNode => Boolean(category));
}

export function buildTreePersistKey(profileName: string, dbName: string, driver: string): string {
    return `${profileName}:${dbName}:${driver || 'unknown'}`;
}
