import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { STORAGE_KEY } from '../lib/constants';
import { withStoreLogger } from './logger';
import { EditorState, ProjectEditorSession, Tab } from './editor/types';
import { 
    DEFAULT_WORKSPACE_ID, 
    createEmptySession, 
    getSessionProjectId, 
    normalizeSession 
} from './editor/sessionUtils';
import { createTabSlice } from './editor/tabSlice';
import { createGroupSlice } from './editor/groupSlice';

const MAX_PROJECT_SESSIONS = 12;
const MAX_GROUPS_PER_SESSION = 6;
const MAX_TABS_PER_GROUP = 30;
const MAX_QUERY_LENGTH = 20000;
const MAX_QUERY_LENGTH_FALLBACK = 3000;

function isQuotaExceededError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    return error.name === 'QuotaExceededError'
        || error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
        || /quota/i.test(error.message);
}

function trimTabForPersistence(tab: Tab, queryLimit: number): Tab {
    const nextQuery = typeof tab.query === 'string' ? tab.query.slice(0, queryLimit) : '';
    return {
        ...tab,
        query: nextQuery,
        isRunning: false,
        content: undefined,
        gitDiffBefore: undefined,
        gitDiffAfter: undefined,
    };
}

function trimSessionForPersistence(
    session: ProjectEditorSession,
    queryLimit: number,
    groupLimit = MAX_GROUPS_PER_SESSION,
    tabLimit = MAX_TABS_PER_GROUP,
): ProjectEditorSession {
    const groups = session.groups.slice(0, groupLimit).map((group) => {
        const tabs = group.tabs.slice(-tabLimit).map((tab) => trimTabForPersistence(tab, queryLimit));
        const activeTabId = tabs.some((tab) => tab.id === group.activeTabId)
            ? group.activeTabId
            : tabs[tabs.length - 1]?.id || null;
        return {
            ...group,
            tabs,
            activeTabId,
        };
    });

    return {
        groups,
        activeGroupId: groups.some((group) => group.id === session.activeGroupId) ? session.activeGroupId : groups[0]?.id || null,
    };
}

function buildPersistedProjectSessions(
    sessions: Record<string, ProjectEditorSession>,
    queryLimit: number,
    projectLimit = MAX_PROJECT_SESSIONS,
): Record<string, ProjectEditorSession> {
    const entries = Object.entries(sessions);
    const limited = entries.slice(-projectLimit);
    return Object.fromEntries(
        limited.map(([projectId, session]) => [
            projectId,
            trimSessionForPersistence(session, queryLimit),
        ]),
    );
}

const safeEditorSessionStorage: StateStorage = {
    getItem: (name) => localStorage.getItem(name),
    removeItem: (name) => localStorage.removeItem(name),
    setItem: (name, value) => {
        try {
            localStorage.setItem(name, value);
            return;
        } catch (error) {
            if (!isQuotaExceededError(error)) {
                throw error;
            }
        }

        // Quota overflow fallback:
        // 1) aggressively compact editor sessions
        // 2) if still failing, drop editor session key to keep app functional
        try {
            const parsed = JSON.parse(value) as {
                state?: { projectSessions?: Record<string, ProjectEditorSession> };
                version?: number;
            };
            const compactState = {
                ...(parsed.state || {}),
                projectSessions: buildPersistedProjectSessions(parsed.state?.projectSessions || {}, MAX_QUERY_LENGTH_FALLBACK, 2),
            };
            localStorage.setItem(name, JSON.stringify({ ...parsed, state: compactState }));
            return;
        } catch {
            // fall through
        }

        try {
            localStorage.removeItem(name);
        } catch {
            // ignore
        }
    },
};

export const useEditorStore = create<EditorState>()(
    persist(
        withStoreLogger('editorStore', (set, get, ...args) => ({
            projectSessions: {
                [DEFAULT_WORKSPACE_ID]: createEmptySession(),
            },
            activeProjectId: DEFAULT_WORKSPACE_ID,
            groups: createEmptySession().groups,
            activeGroupId: createEmptySession().activeGroupId,

            switchProject: (projectId) => set((state) => {
                const nextProjectId = getSessionProjectId(projectId);
                const nextSession = normalizeSession(state.projectSessions[nextProjectId]);

                return {
                    projectSessions: {
                        ...state.projectSessions,
                        [nextProjectId]: nextSession,
                    },
                    activeProjectId: nextProjectId,
                    groups: nextSession.groups,
                    activeGroupId: nextSession.activeGroupId,
                };
            }),

            hydrateProjectSession: (projectId, session, activate = false) => set((state) => {
                const nextProjectId = getSessionProjectId(projectId);
                const nextSession = normalizeSession(session);
                const shouldActivate = activate || nextProjectId === getSessionProjectId(state.activeProjectId);

                return {
                    projectSessions: {
                        ...state.projectSessions,
                        [nextProjectId]: nextSession,
                    },
                    ...(shouldActivate ? {
                        activeProjectId: nextProjectId,
                        groups: nextSession.groups,
                        activeGroupId: nextSession.activeGroupId,
                    } : {}),
                };
            }),

            resetProject: (projectId) => set((state) => {
                const nextProjectId = getSessionProjectId(projectId || state.activeProjectId);
                const nextSession = createEmptySession();
                const isActive = nextProjectId === getSessionProjectId(state.activeProjectId);

                return {
                    projectSessions: {
                        ...state.projectSessions,
                        [nextProjectId]: nextSession,
                    },
                    ...(isActive ? {
                        groups: nextSession.groups,
                        activeGroupId: nextSession.activeGroupId,
                    } : {}),
                };
            }),

            // Compose slices
            ...createTabSlice(set, get, ...args),
            ...createGroupSlice(set, get, ...args),
        })),
        {
            name: STORAGE_KEY.EDITOR_SESSION,
            storage: createJSONStorage(() => safeEditorSessionStorage),
            partialize: (state) => ({
                projectSessions: buildPersistedProjectSessions(state.projectSessions, MAX_QUERY_LENGTH),
            }),
            onRehydrateStorage: () => (state, error) => {
                if (error) {
                    console.error('Failed to hydrate editor session', error);
                    return;
                }

                if (!state) return;

                const rawProjectSessions: Record<string, Partial<ProjectEditorSession> | null | undefined> | undefined =
                    state.projectSessions && Object.keys(state.projectSessions).length > 0
                    ? state.projectSessions
                    : undefined;

                const projectSessions = rawProjectSessions && Object.keys(rawProjectSessions).length > 0
                    ? Object.fromEntries(
                        Object.entries(rawProjectSessions).map(([projectId, session]) => [
                            projectId,
                            normalizeSession(session),
                        ])
                    )
                    : { [DEFAULT_WORKSPACE_ID]: createEmptySession() };

                const rawActiveProjectId = state.activeProjectId;
                const activeProjectId = rawActiveProjectId && projectSessions[rawActiveProjectId]
                    ? rawActiveProjectId
                    : DEFAULT_WORKSPACE_ID;
                const activeSession = normalizeSession(projectSessions[activeProjectId]);

                state.projectSessions = projectSessions;
                state.activeProjectId = activeProjectId;
                state.groups = activeSession.groups;
                state.activeGroupId = activeSession.activeGroupId;
            },
        }
    )
);

export type { Tab, TabGroup, ProjectEditorSession } from './editor/types';
