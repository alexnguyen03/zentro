import { useEffect, useMemo } from 'react';
import { FetchDatabaseSchema } from '../../services/schemaService';
import { type SchemaNode, useSchemaStore } from '../../stores/schemaStore';
import { useConnectionTreeUiStore } from '../../stores/connectionTreeUiStore';
import { onSchemaLoaded } from '../../lib/events';
import { getDriverCategoryDefinitions } from './connectionTreeCategoryRegistry';
import { buildCategoryTree, buildTreePersistKey } from './connectionTreeModel';
import type { CategoryGroupNode } from './connectionTreeTypes';

interface UseConnectionTreeModelArgs {
    profileName: string;
    dbName: string;
    driver: string;
    filter: string;
    fuzzyMatch: boolean;
}

interface UseConnectionTreeModelResult {
    schemaKey: string;
    treePersistKey: string;
    categories: CategoryGroupNode[];
    isLoading: boolean;
    hasLoadedSchemas: boolean;
    isFiltering: boolean;
    isCategoryExpanded: (categoryKey: string) => boolean;
    isSchemaExpanded: (categoryKey: string, schemaName: string) => boolean;
    toggleCategory: (categoryKey: string) => void;
    toggleSchema: (categoryKey: string, schemaName: string) => void;
}

export function useConnectionTreeModel({
    profileName,
    dbName,
    driver,
    filter,
    fuzzyMatch,
}: UseConnectionTreeModelArgs): UseConnectionTreeModelResult {
    const schemaKey = `${profileName}:${dbName}`;
    const treePersistKey = buildTreePersistKey(profileName, dbName, driver);
    const schemas = useSchemaStore((state) => state.trees[schemaKey]);
    const isLoading = useSchemaStore((state) => state.loadingKeys.has(schemaKey));
    const setTree = useSchemaStore((state) => state.setTree);
    const setLoading = useSchemaStore((state) => state.setLoading);
    const ensureDefaults = useConnectionTreeUiStore((state) => state.ensureDefaults);
    const toggleCategoryState = useConnectionTreeUiStore((state) => state.toggleCategory);
    const toggleSchemaState = useConnectionTreeUiStore((state) => state.toggleSchema);
    const treeState = useConnectionTreeUiStore((state) => state.treeStateByKey[treePersistKey]);

    const definitions = useMemo(() => getDriverCategoryDefinitions(driver), [driver]);
    const categories = useMemo(
        () => buildCategoryTree({
            schemas: schemas as SchemaNode[] | undefined,
            definitions,
            filter,
            fuzzyMatch,
            includeEmptyCategories: true,
        }),
        [schemas, definitions, filter, fuzzyMatch],
    );
    const isFiltering = filter.trim().length > 0;

    useEffect(() => {
        ensureDefaults(treePersistKey, 'tables');
    }, [ensureDefaults, treePersistKey]);

    useEffect(() => {
        const unsub = onSchemaLoaded((payload) => {
            if (payload.profileName === profileName && payload.dbName === dbName) {
                setTree(profileName, dbName, payload.schemas);
            }
        });
        return () => unsub();
    }, [dbName, profileName, setTree]);

    useEffect(() => {
        if (schemas || isLoading) return;
        setLoading(profileName, dbName, true);
        FetchDatabaseSchema(profileName, dbName).catch(() => {
            setLoading(profileName, dbName, false);
        });
    }, [dbName, isLoading, profileName, schemas, setLoading]);

    const isCategoryExpanded = (categoryKey: string) => {
        if (isFiltering) return true;
        return Boolean(treeState?.expandedCategories.includes(categoryKey));
    };

    const isSchemaExpanded = (categoryKey: string, schemaName: string) => {
        if (isFiltering) return true;
        const expandedSchemas = treeState?.expandedSchemasByCategory[categoryKey] || [];
        return expandedSchemas.includes(schemaName);
    };

    const toggleCategory = (categoryKey: string) => {
        toggleCategoryState(treePersistKey, categoryKey);
    };

    const toggleSchema = (categoryKey: string, schemaName: string) => {
        toggleSchemaState(treePersistKey, categoryKey, schemaName);
    };

    return {
        schemaKey,
        treePersistKey,
        categories,
        isLoading,
        hasLoadedSchemas: Boolean(schemas),
        isFiltering,
        isCategoryExpanded,
        isSchemaExpanded,
        toggleCategory,
        toggleSchema,
    };
}
