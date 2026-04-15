import { useConnectionStore } from '../../stores/connectionStore';
import { useEditorStore, type Tab } from '../../stores/editorStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { useProjectStore } from '../../stores/projectStore';
import { useScriptStore } from '../../stores/scriptStore';
import { TAB_TYPE } from '../../lib/constants';

export const QUERY_AUTOSAVE_DEBOUNCE_MS = 2000;
export const QUERY_AUTOSAVE_INTERVAL_MS = 15000;

const lastSavedQueryByTabId = new Map<string, string>();
const inFlightSaveByTabId = new Map<string, Promise<boolean>>();

function getQueryTab(tabId: string): Tab | null {
    const state = useEditorStore.getState();
    for (const group of state.groups) {
        const candidate = group.tabs.find((tab) => tab.id === tabId);
        if (candidate?.type === TAB_TYPE.QUERY) {
            return candidate;
        }
    }
    return null;
}

function resolveScopeForTab(tab: Tab): { projectId: string | null; profileName: string | null } {
    const activeProject = useProjectStore.getState().activeProject;
    const activeEnvironmentKey = useEnvironmentStore.getState().activeEnvironmentKey
        || activeProject?.last_active_environment_key
        || activeProject?.default_environment_key;
    const envConnection = activeProject?.connections?.find((item) => item.environment_key === activeEnvironmentKey);
    const envConnectionName = envConnection?.advanced_meta?.profile_name || envConnection?.name || null;

    const projectId =
        activeProject?.id ||
        tab.context?.scriptProjectId ||
        null;
    const profileName =
        useConnectionStore.getState().activeProfile?.name ||
        tab.context?.scriptConnectionName ||
        envConnectionName ||
        null;

    return { projectId, profileName };
}

export function ensureAutosaveBaseline(tabId: string, query: string): void {
    if (!lastSavedQueryByTabId.has(tabId)) {
        lastSavedQueryByTabId.set(tabId, query);
    }
}

export function clearAutosaveStateForMissingTabs(liveTabIds: Set<string>): void {
    for (const key of Array.from(lastSavedQueryByTabId.keys())) {
        if (!liveTabIds.has(key)) {
            lastSavedQueryByTabId.delete(key);
        }
    }
}

export function isAutosaveEligible(tab: Tab): boolean {
    if (tab.type !== TAB_TYPE.QUERY) return false;
    if (tab.context?.sourceControlFile) return false;
    if (!tab.query?.trim()) return false;
    const { projectId, profileName } = resolveScopeForTab(tab);
    return Boolean(projectId && profileName);
}

export function isTabDirtyForAutosave(tab: Tab): boolean {
    if (tab.type !== TAB_TYPE.QUERY) return false;
    const baseline = lastSavedQueryByTabId.get(tab.id);
    if (baseline === undefined) {
        return false;
    }
    return baseline !== tab.query;
}

export async function saveQueryTabById(tabId: string): Promise<boolean> {
    const existing = inFlightSaveByTabId.get(tabId);
    if (existing) {
        return existing;
    }

    const task = (async () => {
        const tab = getQueryTab(tabId);
        if (!tab || !tab.query?.trim()) return false;
        if (tab.context?.sourceControlFile) return false;

        const { projectId, profileName } = resolveScopeForTab(tab);
        if (!projectId || !profileName) return false;

        const savedScriptId = await useScriptStore.getState().saveScript(
            projectId,
            profileName,
            tab.name,
            tab.query,
            tab.context?.savedScriptId,
        );

        useEditorStore.getState().updateTabContext(tabId, {
            savedScriptId,
            scriptProjectId: projectId,
            scriptConnectionName: profileName,
        });

        lastSavedQueryByTabId.set(tabId, tab.query);
        return true;
    })();

    inFlightSaveByTabId.set(tabId, task);
    try {
        return await task;
    } finally {
        inFlightSaveByTabId.delete(tabId);
    }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`save timeout (${timeoutMs}ms)`)), timeoutMs);
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (err) => {
                clearTimeout(timer);
                reject(err);
            },
        );
    });
}

export async function saveAllOpenQueryTabs(options?: { timeoutMs?: number; concurrency?: number }): Promise<void> {
    const timeoutMs = Math.max(1000, options?.timeoutMs ?? 8000);
    const concurrency = Math.max(1, options?.concurrency ?? 4);

    const groups = useEditorStore.getState().groups;
    const tabIds = groups
        .flatMap((group) => group.tabs)
        .filter((tab) => tab.type === TAB_TYPE.QUERY && Boolean(tab.query?.trim()))
        .map((tab) => tab.id);

    if (tabIds.length === 0) return;

    let index = 0;
    const workers = Array.from({ length: Math.min(concurrency, tabIds.length) }, () => (async () => {
        while (index < tabIds.length) {
            const current = tabIds[index];
            index += 1;
            try {
                await withTimeout(saveQueryTabById(current), timeoutMs);
            } catch {
                // best effort on app close
            }
        }
    })());

    await Promise.race([
        Promise.all(workers),
        new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
}
