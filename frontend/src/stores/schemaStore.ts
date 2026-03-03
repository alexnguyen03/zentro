import { create } from 'zustand';
import { models } from '../../wailsjs/go/models';

export interface SchemaNode {
    Name: string;
    Tables: string[];
    Views: string[];
}

type SchemaTreeState = {
    // Keyed by "ProfileName:DBName"
    trees: Record<string, SchemaNode[]>;
    setTree: (profileName: string, dbName: string, schemas: SchemaNode[]) => void;
};
export const useSchemaStore = create<SchemaTreeState>((set) => ({
    trees: {},
    setTree: (profileName, dbName, schemas) => set((state) => ({
        trees: {
            ...state.trees,
            [`${profileName}:${dbName}`]: schemas
        }
    }))
}));
