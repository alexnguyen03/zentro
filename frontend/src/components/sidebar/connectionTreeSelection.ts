import type { CategoryGroupNode } from './connectionTreeTypes';

export interface ConnectionTreeSelection {
    categoryKey: string;
    schemaName: string;
    objectName: string;
    selectedObjectKey: string;
    isPrimaryCategory: boolean;
}

function findObjectInCategory(category: CategoryGroupNode, schemaName: string, objectName: string) {
    const bucket = category.schemas.find((schema) => schema.schemaName === schemaName);
    if (!bucket) return null;
    const item = bucket.items.find((candidate) => candidate.name === objectName);
    if (!item) return null;
    return {
        categoryKey: category.key,
        schemaName,
        objectName: item.name,
        selectedObjectKey: `${category.key}:${schemaName}.${item.name}`,
        isPrimaryCategory: category.key === 'tables' || category.key === 'views',
    } satisfies ConnectionTreeSelection;
}

export function resolveConnectionTreeSelection(
    categories: CategoryGroupNode[],
    schemaName: string,
    objectName: string,
): ConnectionTreeSelection | null {
    if (!schemaName || !objectName) return null;

    const openableCategories = categories.filter((category) => category.canOpenDefinition);
    if (openableCategories.length === 0) return null;

    const tableCategory = openableCategories.find((category) => category.key === 'tables');
    if (tableCategory) {
        const selected = findObjectInCategory(tableCategory, schemaName, objectName);
        if (selected) return selected;
    }

    for (const category of openableCategories) {
        if (category.key === 'tables') continue;
        const selected = findObjectInCategory(category, schemaName, objectName);
        if (selected) return selected;
    }

    return null;
}
