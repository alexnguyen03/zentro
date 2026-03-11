import { create } from 'zustand';
import { FetchTableColumns } from '../../wailsjs/go/app/App';
import { models } from '../../wailsjs/go/models';

export interface SchemaNode {
    Name: string;
    Tables: string[];
    Views: string[];
}

interface SchemaTreeState {
    // Keyed by "ProfileName:DBName"
    trees: Record<string, SchemaNode[]>;
    // Keyed by "ProfileName:DBName:Schema:Table"
    cachedColumns: Record<string, models.ColumnDef[]>;
    loadingKeys: Set<string>;
    
    setTree: (profileName: string, dbName: string, schemas: SchemaNode[]) => void;
    setLoading: (profileName: string, dbName: string, loading: boolean) => void;
    checkAndFetchColumns: (profileName: string, dbName: string, schemaName: string, tableName: string) => Promise<models.ColumnDef[]>;
}

export const useSchemaStore = create<SchemaTreeState>((set, get) => ({
    trees: {},
    cachedColumns: {},
    loadingKeys: new Set(),

    setTree: (profileName, dbName, schemas) => set((state) => ({
        trees: {
            ...state.trees,
            [`${profileName}:${dbName}`]: schemas,
        },
        loadingKeys: new Set([...state.loadingKeys].filter(k => k !== `${profileName}:${dbName}`)),
    })),

    setLoading: (profileName, dbName, loading) => set((state) => {
        const key = `${profileName}:${dbName}`;
        const next = new Set(state.loadingKeys);
        if (loading) next.add(key); else next.delete(key);
        return { loadingKeys: next };
    }),

    checkAndFetchColumns: async (profileName, dbName, schemaName, tableName) => {
        const state = get();
        const key = `${profileName}:${dbName}:${schemaName}:${tableName}`;
        
        if (state.cachedColumns[key]) {
            return state.cachedColumns[key];
        }

        try {
            const columns = await FetchTableColumns(schemaName, tableName);
            set((s) => ({
                cachedColumns: {
                    ...s.cachedColumns,
                    [key]: columns,
                }
            }));
            return columns;
        } catch (error) {
            console.error(`Failed to fetch columns for ${tableName}:`, error);
            return [];
        }
    }
}));
