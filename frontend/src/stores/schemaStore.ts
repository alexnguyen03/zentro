import { create } from 'zustand';

export interface SchemaNode {
    Name: string;
    Tables: string[];
    Views: string[];
}

interface SchemaTreeState {
    // Keyed by "ProfileName:DBName"
    trees: Record<string, SchemaNode[]>;
    loadingKeys: Set<string>;
    setTree: (profileName: string, dbName: string, schemas: SchemaNode[]) => void;
    setLoading: (profileName: string, dbName: string, loading: boolean) => void;
}

export const useSchemaStore = create<SchemaTreeState>((set) => ({
    trees: {},
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
}));
