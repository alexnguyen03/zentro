import { create } from 'zustand';
import {
    GetScripts,
    GetScriptContent,
    SaveScript,
    DeleteScript,
} from '../services/scriptService';
import { models } from '../../wailsjs/go/models';

type SavedScript = models.SavedScript;

const normalizeScriptName = (value: string) => value.trim().toLowerCase();

const toMillis = (value: unknown) => {
    const parsed = Date.parse(String(value || ''));
    return Number.isFinite(parsed) ? parsed : 0;
};

interface ScriptStore {
    scripts: SavedScript[];
    activeProjectId: string | null;
    activeConnection: string | null;

    loadScripts: (projectId: string, connectionName: string) => Promise<void>;
    saveScript: (projectId: string, connectionName: string, name: string, content: string, scriptID?: string) => Promise<string>;
    deleteScript: (projectId: string, connectionName: string, scriptID: string) => Promise<void>;
    getContent: (projectId: string, connectionName: string, scriptID: string) => Promise<string>;
    clearScope: () => void;
}

export const useScriptStore = create<ScriptStore>((set) => ({
    scripts: [],
    activeProjectId: null,
    activeConnection: null,

    loadScripts: async (projectId, connectionName) => {
        try {
            const data = await GetScripts(projectId, connectionName);
            set({ scripts: data || [], activeProjectId: projectId, activeConnection: connectionName });
        } catch {
            set({ scripts: [], activeProjectId: projectId, activeConnection: connectionName });
        }
    },

    saveScript: async (projectId, connectionName, name, content, scriptID) => {
        const nextName = name.trim() || name;
        const existingScripts = await GetScripts(projectId, connectionName);
        const normalizedName = normalizeScriptName(nextName);
        const byID = scriptID
            ? (existingScripts || []).find((item) => item.id === scriptID)
            : undefined;
        const sameNameScripts = (existingScripts || [])
            .filter((item) => normalizeScriptName(item.name) === normalizedName)
            .sort((a, b) => {
                const bt = toMillis(b.updated_at ?? b.created_at);
                const at = toMillis(a.updated_at ?? a.created_at);
                return bt - at;
            });

        const primaryMatch = byID || sameNameScripts[0];
        const id = primaryMatch?.id || scriptID || crypto.randomUUID();
        const now = new Date().toISOString();
        const script = models.SavedScript.createFrom({
            id,
            project_id: projectId,
            connection_name: connectionName,
            name: nextName,
            created_at: String(primaryMatch?.created_at || now),
            updated_at: now,
        });
        await SaveScript(script, content);

        const duplicateIds = sameNameScripts
            .filter((item) => item.id !== id)
            .map((item) => item.id);
        await Promise.allSettled(duplicateIds.map((duplicateId) => DeleteScript(projectId, connectionName, duplicateId)));

        // Reload list
        const data = await GetScripts(projectId, connectionName);
        set({ scripts: data || [], activeProjectId: projectId, activeConnection: connectionName });

        return id;
    },

    deleteScript: async (projectId, connectionName, scriptID) => {
        await DeleteScript(projectId, connectionName, scriptID);
        const data = await GetScripts(projectId, connectionName);
        set({ scripts: data || [], activeProjectId: projectId, activeConnection: connectionName });
    },

    getContent: async (projectId, connectionName, scriptID) => {
        return GetScriptContent(projectId, connectionName, scriptID);
    },

    clearScope: () => set({ scripts: [], activeProjectId: null, activeConnection: null }),
}));

