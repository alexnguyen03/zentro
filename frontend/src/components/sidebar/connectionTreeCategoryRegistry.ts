import { DRIVER } from '../../lib/constants';
import type { SchemaNode } from '../../stores/schemaStore';
import type { CategoryKey, DriverCategoryDefinition } from './connectionTreeTypes';

const CATEGORY_DEFINITION_MAP: Record<CategoryKey, DriverCategoryDefinition> = {
    tables: {
        key: 'tables',
        label: 'Tables',
        icon: 'table',
        itemIcon: 'table',
        getItems: (schema) => schema.Tables || [],
        canOpenDefinition: true,
        allowCreateTable: true,
        dropObjectType: 'TABLE',
    },
    foreign_tables: {
        key: 'foreign_tables',
        label: 'Foreign Tables',
        icon: 'foreign_table',
        itemIcon: 'foreign_table',
        getItems: (schema) => schema.ForeignTables || [],
        canOpenDefinition: true,
        allowCreateTable: false,
        dropObjectType: null,
    },
    views: {
        key: 'views',
        label: 'Views',
        icon: 'view',
        itemIcon: 'view',
        getItems: (schema) => schema.Views || [],
        canOpenDefinition: true,
        allowCreateTable: false,
        dropObjectType: 'VIEW',
    },
    materialized_views: {
        key: 'materialized_views',
        label: 'Materialized Views',
        icon: 'materialized_view',
        itemIcon: 'materialized_view',
        getItems: (schema) => schema.MaterializedViews || [],
        canOpenDefinition: true,
        allowCreateTable: false,
        dropObjectType: 'VIEW',
    },
    indexes: {
        key: 'indexes',
        label: 'Indexes',
        icon: 'index',
        itemIcon: 'index',
        getItems: (schema) => schema.Indexes || [],
        canOpenDefinition: false,
        allowCreateTable: false,
        dropObjectType: null,
    },
    functions: {
        key: 'functions',
        label: 'Functions',
        icon: 'function',
        itemIcon: 'function',
        getItems: (schema) => schema.Functions || [],
        canOpenDefinition: false,
        allowCreateTable: false,
        dropObjectType: null,
    },
    sequences: {
        key: 'sequences',
        label: 'Sequences',
        icon: 'sequence',
        itemIcon: 'sequence',
        getItems: (schema) => schema.Sequences || [],
        canOpenDefinition: false,
        allowCreateTable: false,
        dropObjectType: null,
    },
    data_types: {
        key: 'data_types',
        label: 'Data types',
        icon: 'data_type',
        itemIcon: 'data_type',
        getItems: (schema) => schema.DataTypes || [],
        canOpenDefinition: false,
        allowCreateTable: false,
        dropObjectType: null,
    },
    aggregate_functions: {
        key: 'aggregate_functions',
        label: 'Aggregate functions',
        icon: 'aggregate',
        itemIcon: 'aggregate',
        getItems: (schema) => schema.AggregateFunctions || [],
        canOpenDefinition: false,
        allowCreateTable: false,
        dropObjectType: null,
    },
};

const DRIVER_CATEGORY_ORDER: Record<string, CategoryKey[]> = {
    [DRIVER.POSTGRES]: [
        'tables',
        'foreign_tables',
        'views',
        'materialized_views',
        'indexes',
        'functions',
        'sequences',
        'data_types',
        'aggregate_functions',
    ],
    [DRIVER.SQLSERVER]: [
        'tables',
        'views',
        'indexes',
        'functions',
        'data_types',
    ],
    [DRIVER.MYSQL]: [
        'tables',
        'views',
        'indexes',
        'functions',
    ],
    [DRIVER.SQLITE]: [
        'tables',
        'views',
        'indexes',
    ],
};

function toDefinitionList(keys: CategoryKey[]): DriverCategoryDefinition[] {
    return keys.map((key) => CATEGORY_DEFINITION_MAP[key]);
}

export function getDriverCategoryDefinitions(driver: string): DriverCategoryDefinition[] {
    const order = DRIVER_CATEGORY_ORDER[driver] || DRIVER_CATEGORY_ORDER[DRIVER.POSTGRES];
    return toDefinitionList(order);
}
