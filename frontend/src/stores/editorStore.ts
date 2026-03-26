import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STORAGE_KEY, TabType, TAB_TYPE } from '../lib/constants';
import { withStoreLogger } from './logger';

export interface Tab {
    id: string;
    name: string;
    query: string;
    isRunning: boolean;
    type?: TabType;
    content?: string;
    readOnly?: boolean;
    sourceTabId?: string;
    generatedKind?: 'result' | 'explain';
}

export interface TabGroup {
    id: string;
    tabs: Tab[];
    activeTabId: string | null;
}

interface ProjectEditorSession {
    groups: TabGroup[];
    activeGroupId: string | null;
}

interface LegacyEditorState {
    workspaceSessions?: Record<string, Partial<ProjectEditorSession> | null | undefined>;
    activeWorkspaceId?: string | null;
}

interface EditorState {
    projectSessions: Record<string, ProjectEditorSession>;
    activeProjectId: string | null;
    groups: TabGroup[];
    activeGroupId: string | null;

    switchProject: (projectId: string | null) => void;
    resetProject: (projectId?: string | null) => void;
    addTab: (tabInit?: Partial<Tab>, targetGroupId?: string) => string;
    removeTab: (id: string, groupId?: string) => void;
    setActiveTabId: (tabId: string, groupId: string) => void;
    setActiveGroupId: (groupId: string) => void;
    updateTabQuery: (id: string, query: string) => void;
    setTabRunning: (id: string, isRunning: boolean) => void;
    renameTab: (id: string, newName: string) => void;
    setTabQuery: (id: string, query: string) => void;
    splitGroup: (sourceGroupId: string, tabId: string) => void;
    splitGroupFromDrag: (sourceGroupId: string, tabId: string, targetGroupId: string, direction: 'left' | 'right') => void;
    closeGroup: (groupId: string) => void;
    moveTab: (tabId: string, sourceGroupId: string, targetGroupId: string, newIndex: number) => void;
}

const DEFAULT_WORKSPACE_ID = '__default__';

const createEmptySession = (): ProjectEditorSession => ({
    groups: [{ id: 'group-1', tabs: [], activeTabId: null }],
    activeGroupId: 'group-1',
});

const normalizeSession = (session?: Partial<ProjectEditorSession> | null): ProjectEditorSession => {
    const groups = session?.groups?.length
        ? session.groups.map((group, index) => ({
            id: group.id || `group-${index + 1}`,
            tabs: (group.tabs || []).map((tab) => ({
                ...tab,
                isRunning: false,
                type: tab.type || TAB_TYPE.QUERY,
            })),
            activeTabId: group.activeTabId || group.tabs?.[0]?.id || null,
        }))
        : createEmptySession().groups;

    return {
        groups,
        activeGroupId: session?.activeGroupId && groups.some((group) => group.id === session.activeGroupId)
            ? session.activeGroupId
            : groups[0]?.id || null,
    };
};

const getSessionProjectId = (projectId?: string | null) => projectId || DEFAULT_WORKSPACE_ID;

const getNextTabName = (groups: TabGroup[], baseName = 'New Query'): string => {
    let name = baseName;
    let count = 1;
    let checkName = name;

    while (groups.some((group) => group.tabs.some((tab) => tab.name === checkName))) {
        count += 1;
        checkName = `${name} ${count}`;
    }

    return checkName;
};

function getActiveSession(state: Pick<EditorState, 'projectSessions' | 'activeProjectId'>) {
    const projectId = getSessionProjectId(state.activeProjectId);
    return normalizeSession(state.projectSessions[projectId]);
}

function updateActiveSession(
    state: EditorState,
    updater: (session: ProjectEditorSession) => ProjectEditorSession
) {
    const projectId = getSessionProjectId(state.activeProjectId);
    const nextSession = normalizeSession(updater(getActiveSession(state)));
    return {
        projectSessions: {
            ...state.projectSessions,
            [projectId]: nextSession,
        },
        groups: nextSession.groups,
        activeGroupId: nextSession.activeGroupId,
    };
}

export const useEditorStore = create<EditorState>()(
    persist(
        withStoreLogger('editorStore', (set, get) => ({
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

            addTab: (tabInit, targetGroupId) => {
                let id = tabInit?.id || crypto.randomUUID();

                set((state) => updateActiveSession(state, (session) => {
                    const targetId = targetGroupId || session.activeGroupId || session.groups[0]?.id;
                    const groupIndex = session.groups.findIndex((group) => group.id === targetId);
                    if (groupIndex === -1 || !targetId) {
                        return session;
                    }

                    if (tabInit?.id) {
                        for (const group of session.groups) {
                            const existingTab = group.tabs.find((tab) => tab.id === tabInit.id);
                            if (existingTab) {
                                id = existingTab.id;
                                return {
                                    groups: session.groups.map((currentGroup) => (
                                        currentGroup.id !== group.id
                                            ? currentGroup
                                            : {
                                                ...currentGroup,
                                                activeTabId: existingTab.id,
                                                tabs: currentGroup.tabs.map((tab) => (
                                                    tab.id === existingTab.id
                                                        ? { ...tab, ...tabInit, id: existingTab.id }
                                                        : tab
                                                )),
                                            }
                                    )),
                                    activeGroupId: group.id,
                                };
                            }
                        }
                    }

                    if (tabInit?.type === TAB_TYPE.TABLE && tabInit.content) {
                        for (const group of session.groups) {
                            const existingTab = group.tabs.find((tab) => tab.type === 'table' && tab.content === tabInit.content);
                            if (existingTab) {
                                id = existingTab.id;
                                return {
                                    groups: session.groups.map((currentGroup) => (
                                        currentGroup.id === group.id
                                            ? { ...currentGroup, activeTabId: existingTab.id }
                                            : currentGroup
                                    )),
                                    activeGroupId: group.id,
                                };
                            }
                        }
                    }

                    if (tabInit?.type === 'settings' || tabInit?.type === 'shortcuts') {
                        for (const group of session.groups) {
                            const existingTab = group.tabs.find((tab) => tab.type === tabInit.type);
                            if (existingTab) {
                                id = existingTab.id;
                                return {
                                    groups: session.groups.map((currentGroup) => (
                                        currentGroup.id === group.id
                                            ? { ...currentGroup, activeTabId: existingTab.id }
                                            : currentGroup
                                    )),
                                    activeGroupId: group.id,
                                };
                            }
                        }
                    }

                    const name = tabInit?.name || (tabInit?.type === TAB_TYPE.TABLE
                        ? tabInit.content || 'Table'
                        : getNextTabName(session.groups));
                    const newTab: Tab = {
                        id,
                        name,
                        query: tabInit?.query || '',
                        isRunning: false,
                        type: tabInit?.type || TAB_TYPE.QUERY,
                        content: tabInit?.content,
                        ...tabInit,
                    };

                    return {
                        groups: session.groups.map((group) => (
                            group.id === targetId
                                ? {
                                    ...group,
                                    tabs: [...group.tabs, newTab],
                                    activeTabId: id,
                                }
                                : group
                        )),
                        activeGroupId: targetId,
                    };
                }));

                return id;
            },

            removeTab: (id, targetGroupId) => set((state) => updateActiveSession(state, (session) => ({
                ...session,
                groups: session.groups.map((group) => {
                    if (targetGroupId && group.id !== targetGroupId) return group;
                    if (!group.tabs.some((tab) => tab.id === id)) return group;

                    const tabs = group.tabs.filter((tab) => tab.id !== id);
                    const activeTabId = group.activeTabId === id
                        ? (tabs.length > 0 ? tabs[tabs.length - 1].id : null)
                        : group.activeTabId;

                    return { ...group, tabs, activeTabId };
                }),
            }))),

            setActiveTabId: (tabId, groupId) => set((state) => updateActiveSession(state, (session) => ({
                groups: session.groups.map((group) => (
                    group.id === groupId ? { ...group, activeTabId: tabId } : group
                )),
                activeGroupId: groupId,
            }))),

            setActiveGroupId: (groupId) => set((state) => updateActiveSession(state, (session) => ({
                ...session,
                activeGroupId: groupId,
            }))),

            updateTabQuery: (id, query) => set((state) => updateActiveSession(state, (session) => ({
                ...session,
                groups: session.groups.map((group) => ({
                    ...group,
                    tabs: group.tabs.map((tab) => (tab.id === id ? { ...tab, query } : tab)),
                })),
            }))),

            setTabRunning: (id, isRunning) => set((state) => updateActiveSession(state, (session) => ({
                ...session,
                groups: session.groups.map((group) => ({
                    ...group,
                    tabs: group.tabs.map((tab) => (tab.id === id ? { ...tab, isRunning } : tab)),
                })),
            }))),

            renameTab: (id, newName) => set((state) => updateActiveSession(state, (session) => ({
                ...session,
                groups: session.groups.map((group) => ({
                    ...group,
                    tabs: group.tabs.map((tab) => (tab.id === id ? { ...tab, name: newName } : tab)),
                })),
            }))),

            setTabQuery: (id, query) => set((state) => updateActiveSession(state, (session) => ({
                ...session,
                groups: session.groups.map((group) => ({
                    ...group,
                    tabs: group.tabs.map((tab) => (tab.id === id ? { ...tab, query } : tab)),
                })),
            }))),

            splitGroup: (sourceGroupId, tabId) => set((state) => updateActiveSession(state, (session) => {
                const sourceGroup = session.groups.find((group) => group.id === sourceGroupId);
                const tabToMove = sourceGroup?.tabs.find((tab) => tab.id === tabId);
                if (!sourceGroup || !tabToMove) return session;

                const tabs = sourceGroup.tabs.filter((tab) => tab.id !== tabId);
                const activeTabId = sourceGroup.activeTabId === tabId
                    ? (tabs.length > 0 ? tabs[tabs.length - 1].id : null)
                    : sourceGroup.activeTabId;

                const newGroupId = crypto.randomUUID();
                const nextGroups = session.groups.map((group) => (
                    group.id === sourceGroupId ? { ...group, tabs, activeTabId } : group
                ));
                const sourceIndex = nextGroups.findIndex((group) => group.id === sourceGroupId);
                nextGroups.splice(sourceIndex + 1, 0, {
                    id: newGroupId,
                    tabs: [tabToMove],
                    activeTabId: tabId,
                });

                return {
                    groups: nextGroups,
                    activeGroupId: newGroupId,
                };
            })),

            splitGroupFromDrag: (sourceGroupId, tabId, targetGroupId, direction) => set((state) => updateActiveSession(state, (session) => {
                const sourceGroup = session.groups.find((group) => group.id === sourceGroupId);
                const tabToMove = sourceGroup?.tabs.find((tab) => tab.id === tabId);
                if (!sourceGroup || !tabToMove) return session;

                const tabs = sourceGroup.tabs.filter((tab) => tab.id !== tabId);
                const activeTabId = sourceGroup.activeTabId === tabId
                    ? (tabs.length > 0 ? tabs[tabs.length - 1].id : null)
                    : sourceGroup.activeTabId;

                const newGroupId = crypto.randomUUID();
                const nextGroups = session.groups.map((group) => (
                    group.id === sourceGroupId ? { ...group, tabs, activeTabId } : group
                ));
                const targetIndex = nextGroups.findIndex((group) => group.id === targetGroupId);
                if (targetIndex === -1) return session;

                nextGroups.splice(direction === 'left' ? targetIndex : targetIndex + 1, 0, {
                    id: newGroupId,
                    tabs: [tabToMove],
                    activeTabId: tabId,
                });

                return {
                    groups: nextGroups,
                    activeGroupId: newGroupId,
                };
            })),

            closeGroup: (groupId) => set((state) => updateActiveSession(state, (session) => {
                let groups = session.groups.filter((group) => group.id !== groupId);
                if (groups.length === 0) {
                    groups = createEmptySession().groups;
                }

                const activeGroupId = session.activeGroupId === groupId
                    ? groups[0]?.id || null
                    : session.activeGroupId;

                return { groups, activeGroupId };
            })),

            moveTab: (tabId, sourceGroupId, targetGroupId, newIndex) => set((state) => updateActiveSession(state, (session) => {
                const sourceGroup = session.groups.find((group) => group.id === sourceGroupId);
                const targetGroup = session.groups.find((group) => group.id === targetGroupId);
                if (!sourceGroup || !targetGroup) return session;

                const tabIndexInSource = sourceGroup.tabs.findIndex((tab) => tab.id === tabId);
                if (tabIndexInSource === -1) return session;

                const tab = sourceGroup.tabs[tabIndexInSource];

                if (sourceGroupId === targetGroupId) {
                    const tabs = [...sourceGroup.tabs];
                    tabs.splice(tabIndexInSource, 1);
                    tabs.splice(newIndex, 0, tab);

                    return {
                        ...session,
                        groups: session.groups.map((group) => (
                            group.id === sourceGroupId ? { ...group, tabs } : group
                        )),
                    };
                }

                const sourceTabs = [...sourceGroup.tabs];
                sourceTabs.splice(tabIndexInSource, 1);
                const sourceActiveTabId = sourceGroup.activeTabId === tabId
                    ? (sourceTabs.length > 0 ? sourceTabs[sourceTabs.length - 1].id : null)
                    : sourceGroup.activeTabId;

                const targetTabs = [...targetGroup.tabs];
                targetTabs.splice(newIndex, 0, tab);

                return {
                    groups: session.groups.map((group) => {
                        if (group.id === sourceGroupId) {
                            return { ...group, tabs: sourceTabs, activeTabId: sourceActiveTabId };
                        }
                        if (group.id === targetGroupId) {
                            return { ...group, tabs: targetTabs, activeTabId: tabId };
                        }
                        return group;
                    }),
                    activeGroupId: targetGroupId,
                };
            })),
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

                const legacyState = state as EditorState & LegacyEditorState;
                const legacySessions = legacyState.workspaceSessions;
                const rawProjectSessions: Record<string, Partial<ProjectEditorSession> | null | undefined> | undefined =
                    state.projectSessions && Object.keys(state.projectSessions).length > 0
                    ? state.projectSessions
                    : legacySessions;

                const projectSessions = rawProjectSessions && Object.keys(rawProjectSessions).length > 0
                    ? Object.fromEntries(
                        Object.entries(rawProjectSessions).map(([projectId, session]) => [
                            projectId,
                            normalizeSession(session),
                        ])
                    )
                    : { [DEFAULT_WORKSPACE_ID]: createEmptySession() };

                const legacyActiveProjectId = legacyState.activeWorkspaceId;
                const rawActiveProjectId = state.activeProjectId || legacyActiveProjectId;
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
