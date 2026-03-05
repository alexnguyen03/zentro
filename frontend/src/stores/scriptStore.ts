import { create } from 'zustand';
import {
    GetScripts,
    GetScriptContent,
    SaveScript,
    DeleteScript,
} from '../../wailsjs/go/app/App';
import { models } from '../../wailsjs/go/models';

type SavedScript = models.SavedScript;

interface ScriptStore {
    scripts: SavedScript[];
    activeConnection: string | null;

    loadScripts: (connectionName: string) => Promise<void>;
    saveScript: (connectionName: string, name: string, content: string) => Promise<void>;
    deleteScript: (connectionName: string, scriptID: string) => Promise<void>;
    getContent: (connectionName: string, scriptID: string) => Promise<string>;
}

export const useScriptStore = create<ScriptStore>((set) => ({
    scripts: [],
    activeConnection: null,

    loadScripts: async (connectionName) => {
        try {
            const data = await GetScripts(connectionName);
            set({ scripts: data || [], activeConnection: connectionName });
        } catch {
            set({ scripts: [], activeConnection: connectionName });
        }
    },

    saveScript: async (connectionName, name, content) => {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const script = models.SavedScript.createFrom({
            id,
            connection_name: connectionName,
            name,
            created_at: now,
            updated_at: now,
        });
        await SaveScript(script, content);
        // Reload list
        const data = await GetScripts(connectionName);
        set({ scripts: data || [] });
    },

    deleteScript: async (connectionName, scriptID) => {
        await DeleteScript(connectionName, scriptID);
        const data = await GetScripts(connectionName);
        set({ scripts: data || [] });
    },

    getContent: async (connectionName, scriptID) => {
        return GetScriptContent(connectionName, scriptID);
    },
}));
