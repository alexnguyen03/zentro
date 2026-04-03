import type { SchemaNode } from '../../stores/schemaStore';

export type CategoryKey =
    | 'tables'
    | 'foreign_tables'
    | 'views'
    | 'materialized_views'
    | 'indexes'
    | 'functions'
    | 'procedures'
    | 'sequences'
    | 'data_types'
    | 'aggregate_functions';

export type ConnectionTreeIcon =
    | 'table'
    | 'foreign_table'
    | 'view'
    | 'materialized_view'
    | 'index'
    | 'function'
    | 'procedure'
    | 'sequence'
    | 'data_type'
    | 'aggregate'
    | 'schema';

export interface DriverCategoryDefinition {
    key: CategoryKey;
    label: string;
    icon: ConnectionTreeIcon;
    itemIcon: ConnectionTreeIcon;
    getItems: (schema: SchemaNode) => string[];
    canOpenDefinition: boolean;
    allowCreateTable: boolean;
    dropObjectType: 'TABLE' | 'VIEW' | null;
}

export interface ObjectLeafNode {
    id: string;
    name: string;
    schemaName: string;
    categoryKey: CategoryKey;
    categoryLabel: string;
}

export interface SchemaBucketNode {
    id: string;
    schemaName: string;
    items: ObjectLeafNode[];
    totalCount: number;
}

export interface CategoryGroupNode {
    id: string;
    key: CategoryKey;
    label: string;
    icon: ConnectionTreeIcon;
    itemIcon: ConnectionTreeIcon;
    schemas: SchemaBucketNode[];
    totalCount: number;
    canOpenDefinition: boolean;
    allowCreateTable: boolean;
    dropObjectType: 'TABLE' | 'VIEW' | null;
}
