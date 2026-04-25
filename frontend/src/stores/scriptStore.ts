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
const WINDOWS_FORBIDDEN_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001F]/g;
const DUPLICATE_SCRIPT_NAME_ERROR = 'SCRIPT_NAME_ALREADY_EXISTS';
const INVALID_SCRIPT_NAME_ERROR = 'SCRIPT_NAME_INVALID';

export const isDuplicateScriptNameError = (error: unknown): boolean =>
    error instanceof Error && error.message.startsWith(DUPLICATE_SCRIPT_NAME_ERROR);

const baseScriptIdFromName = (name: string): string => {
    const trimmed = name.trim();
    if (!trimmed) return '';
    const withoutSqlSuffix = trimmed.replace(/\.sql$/i, '').trim();
    const sanitized = withoutSqlSuffix
        .replace(WINDOWS_FORBIDDEN_FILENAME_CHARS, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return sanitized;
};

const isSameScriptId = (left?: string, right?: string): boolean =>
    String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase();

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
        const id = baseScriptIdFromName(nextName);
        if (!id) {
            throw new Error(`${INVALID_SCRIPT_NAME_ERROR}:${name}`);
        }
        const existingScripts = await GetScripts(projectId, connectionName);
        const normalizedName = normalizeScriptName(nextName);
        const byID = scriptID
            ? (existingScripts || []).find((item) => item.id === scriptID)
            : undefined;
        const byTargetID = (existingScripts || []).find((item) => isSameScriptId(item.id, id));
        const owner = byTargetID || byID;

        if (byTargetID && byID && !isSameScriptId(byTargetID.id, byID.id)) {
            throw new Error(`${DUPLICATE_SCRIPT_NAME_ERROR}:${nextName}`);
        }
        const duplicateByName = (existingScripts || []).find((item) =>
            !isSameScriptId(item.id, id) && normalizeScriptName(item.name) === normalizedName);
        if (duplicateByName) {
            throw new Error(`${DUPLICATE_SCRIPT_NAME_ERROR}:${nextName}`);
        }
        const now = new Date().toISOString();
        const script = models.SavedScript.createFrom({
            id,
            project_id: projectId,
            connection_name: connectionName,
            name: nextName,
            created_at: String(owner?.created_at || now),
            updated_at: now,
        });
        await SaveScript(script, content);
        if (byID && !isSameScriptId(byID.id, id)) {
            await DeleteScript(projectId, connectionName, byID.id);
        }

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

