import { create } from 'zustand';
import { FetchTableColumns, FetchTableRelationships } from '../services/schemaService';
import { models } from '../../wailsjs/go/models';

export interface SchemaNode {
    Name: string;
    Tables: string[];
    ForeignTables?: string[];
    Views: string[];
    MaterializedViews?: string[];
    Indexes?: string[];
    Functions?: string[];
    Sequences?: string[];
    DataTypes?: string[];
    AggregateFunctions?: string[];
}

export interface CachedColumnEntry {
    columns: models.ColumnDef[];
    fetchedAt: number;
}

export interface CachedRelationshipEntry {
    relationships: models.TableRelationship[];
    fetchedAt: number;
}

export const COLUMN_CACHE_TTL_MS = 5 * 60 * 1000;
export const RELATIONSHIP_CACHE_TTL_MS = 5 * 60 * 1000;

interface SchemaTreeState {
    // Keyed by "ProfileName:DBName"
    trees: Record<string, SchemaNode[]>;
    // Keyed by "ProfileName:DBName:Schema:Table"
    cachedColumns: Partial<Record<string, CachedColumnEntry>>;
    cachedRelationships: Partial<Record<string, CachedRelationshipEntry>>;
    pendingColumnRequests: Partial<Record<string, Promise<models.ColumnDef[]>>>;
    pendingRelationshipRequests: Partial<Record<string, Promise<models.TableRelationship[]>>>;
    loadingKeys: Set<string>;
    
    setTree: (profileName: string, dbName: string, schemas: SchemaNode[]) => void;
    setLoading: (profileName: string, dbName: string, loading: boolean) => void;
    checkAndFetchColumns: (profileName: string, dbName: string, schemaName: string, tableName: string) => Promise<models.ColumnDef[]>;
    checkAndFetchRelationships: (profileName: string, dbName: string, schemaName: string, tableName: string) => Promise<models.TableRelationship[]>;
    clearColumnCacheForDatabase: (profileName: string, dbName: string) => void;
}

function removeRecordKeysByPrefix<T>(source: Partial<Record<string, T>>, prefix: string): Partial<Record<string, T>> {
    const next: Partial<Record<string, T>> = {};
    Object.entries(source).forEach(([key, value]) => {
        if (!key.startsWith(prefix)) {
            next[key] = value;
        }
    });
    return next;
}

export const useSchemaStore = create<SchemaTreeState>((set, get) => ({
    trees: {},
    cachedColumns: {},
    cachedRelationships: {},
    pendingColumnRequests: {},
    pendingRelationshipRequests: {},
    loadingKeys: new Set(),

    setTree: (profileName, dbName, schemas) => set((state) => {
        const dbKey = `${profileName}:${dbName}`;
        const columnPrefix = `${dbKey}:`;
        return {
            trees: {
                ...state.trees,
                [dbKey]: schemas,
            },
            cachedColumns: removeRecordKeysByPrefix(state.cachedColumns, columnPrefix),
            cachedRelationships: removeRecordKeysByPrefix(state.cachedRelationships, columnPrefix),
            pendingColumnRequests: removeRecordKeysByPrefix(state.pendingColumnRequests, columnPrefix),
            pendingRelationshipRequests: removeRecordKeysByPrefix(state.pendingRelationshipRequests, columnPrefix),
            loadingKeys: new Set([...state.loadingKeys].filter(k => k !== dbKey)),
        };
    }),

    setLoading: (profileName, dbName, loading) => set((state) => {
        const key = `${profileName}:${dbName}`;
        const next = new Set(state.loadingKeys);
        if (loading) next.add(key); else next.delete(key);
        return { loadingKeys: next };
    }),

    clearColumnCacheForDatabase: (profileName, dbName) => set((state) => {
        const prefix = `${profileName}:${dbName}:`;
        return {
            cachedColumns: removeRecordKeysByPrefix(state.cachedColumns, prefix),
            cachedRelationships: removeRecordKeysByPrefix(state.cachedRelationships, prefix),
            pendingColumnRequests: removeRecordKeysByPrefix(state.pendingColumnRequests, prefix),
            pendingRelationshipRequests: removeRecordKeysByPrefix(state.pendingRelationshipRequests, prefix),
        };
    }),

    checkAndFetchColumns: async (profileName, dbName, schemaName, tableName) => {
        const state = get();
        const key = `${profileName}:${dbName}:${schemaName}:${tableName}`;
        const now = Date.now();

        const cached = state.cachedColumns[key];
        if (cached && now - cached.fetchedAt < COLUMN_CACHE_TTL_MS) {
            return cached.columns;
        }

        const pendingRequest = state.pendingColumnRequests[key];
        if (pendingRequest) {
            return pendingRequest;
        }

        const request = FetchTableColumns(schemaName, tableName)
            .then((columns) => {
                set((s) => {
                    const nextPending = { ...s.pendingColumnRequests };
                    delete nextPending[key];
                    return {
                        cachedColumns: {
                            ...s.cachedColumns,
                            [key]: {
                                columns,
                                fetchedAt: Date.now(),
                            },
                        },
                        pendingColumnRequests: nextPending,
                    };
                });
                return columns;
            })
            .catch((error) => {
                console.error(`Failed to fetch columns for ${tableName}:`, error);
                set((s) => {
                    const nextPending = { ...s.pendingColumnRequests };
                    delete nextPending[key];
                    return {
                        pendingColumnRequests: nextPending,
                    };
                });
                return [];
            });

        set((s) => ({
            pendingColumnRequests: {
                ...s.pendingColumnRequests,
                [key]: request,
            }
        }));

        return request;
    },

    checkAndFetchRelationships: async (profileName, dbName, schemaName, tableName) => {
        const state = get();
        const key = `${profileName}:${dbName}:${schemaName}:${tableName}`;
        const now = Date.now();

        const cached = state.cachedRelationships[key];
        if (cached && now - cached.fetchedAt < RELATIONSHIP_CACHE_TTL_MS) {
            return cached.relationships;
        }

        const pendingRequest = state.pendingRelationshipRequests[key];
        if (pendingRequest) {
            return pendingRequest;
        }

        const request = FetchTableRelationships(schemaName, tableName)
            .then((relationships) => {
                set((s) => {
                    const nextPending = { ...s.pendingRelationshipRequests };
                    delete nextPending[key];
                    return {
                        cachedRelationships: {
                            ...s.cachedRelationships,
                            [key]: {
                                relationships,
                                fetchedAt: Date.now(),
                            },
                        },
                        pendingRelationshipRequests: nextPending,
                    };
                });
                return relationships;
            })
            .catch((error) => {
                console.error(`Failed to fetch relationships for ${tableName}:`, error);
                set((s) => {
                    const nextPending = { ...s.pendingRelationshipRequests };
                    delete nextPending[key];
                    return {
                        pendingRelationshipRequests: nextPending,
                    };
                });
                return [];
            });

        set((s) => ({
            pendingRelationshipRequests: {
                ...s.pendingRelationshipRequests,
                [key]: request,
            }
        }));

        return request;
    }
}));

