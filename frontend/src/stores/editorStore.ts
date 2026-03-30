import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STORAGE_KEY } from '../lib/constants';
import { withStoreLogger } from './logger';
import { EditorState, ProjectEditorSession } from './editor/types';
import { 
    DEFAULT_WORKSPACE_ID, 
    createEmptySession, 
    getSessionProjectId, 
    normalizeSession 
} from './editor/sessionUtils';
import { createTabSlice } from './editor/tabSlice';
import { createGroupSlice } from './editor/groupSlice';

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
            partialize: (state) => ({
                projectSessions: Object.fromEntries(
                    Object.entries(state.projectSessions).map(([projectId, session]) => [
                        projectId,
                        {
                            groups: session.groups.map((group) => ({
                                ...group,
                                tabs: group.tabs.map((tab) => ({ ...tab, isRunning: false })),
                            })),
                            activeGroupId: session.activeGroupId,
                        },
                    ])
                ),
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
