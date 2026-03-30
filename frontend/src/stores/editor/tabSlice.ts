import { StateCreator } from 'zustand';
import { TAB_TYPE } from '../../lib/constants';
import { EditorState, Tab, TabQueryContext } from './types';
import { getNextTabName, updateActiveSession } from './sessionUtils';
import { useScriptStore } from '../scriptStore';
import { useProjectStore } from '../projectStore';
import { useConnectionStore } from '../connectionStore';
import { useEnvironmentStore } from '../environmentStore';

export interface TabSlice {
    addTab: (tabInit?: Partial<Tab>, targetGroupId?: string) => string;
    removeTab: (id: string, groupId?: string) => void;
    setActiveTabId: (tabId: string, groupId: string) => void;
    updateTabQuery: (id: string, query: string) => void;
    updateTabContext: (id: string, patch: Partial<TabQueryContext>) => void;
    setTabRunning: (id: string, isRunning: boolean) => void;
    renameTab: (id: string, newName: string) => void;
    setTabQuery: (id: string, query: string) => void;
}

export const createTabSlice: StateCreator<EditorState, [], [], TabSlice> = (set) => ({
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

            const activeProjectId = useProjectStore.getState().activeProject?.id || null;
            const activeProject = useProjectStore.getState().activeProject;
            const activeEnvironmentKey = useEnvironmentStore.getState().activeEnvironmentKey
                || activeProject?.last_active_environment_key
                || activeProject?.default_environment_key;
            const boundConnection = activeProject?.connections?.find((item) => item.environment_key === activeEnvironmentKey);
            const boundConnectionName = boundConnection?.advanced_meta?.profile_name || boundConnection?.name || null;
            const activeConnectionName = useConnectionStore.getState().activeProfile?.name || boundConnectionName;
            const scriptState = useScriptStore.getState();
            const reservedScriptNames =
                scriptState.activeProjectId === activeProjectId &&
                    scriptState.activeConnection === activeConnectionName
                    ? scriptState.scripts.map((script) => script.name)
                    : [];

            const name = tabInit?.name || (tabInit?.type === TAB_TYPE.TABLE
                ? tabInit.content || 'Table'
                : getNextTabName(session.groups, 'New Query', reservedScriptNames));
            const nextTabType = tabInit?.type || TAB_TYPE.QUERY;
            const mergedContext: TabQueryContext | undefined = nextTabType === TAB_TYPE.QUERY
                ? {
                    scriptProjectId: activeProjectId || undefined,
                    scriptConnectionName: activeConnectionName || undefined,
                    ...(tabInit?.context || {}),
                }
                : tabInit?.context;
            const newTab: Tab = {
                id,
                name,
                query: tabInit?.query || '',
                isRunning: false,
                type: nextTabType,
                content: tabInit?.content,
                context: mergedContext,
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

    updateTabQuery: (id, query) => set((state) => updateActiveSession(state, (session) => ({
        ...session,
        groups: session.groups.map((group) => ({
            ...group,
            tabs: group.tabs.map((tab) => (tab.id === id ? { ...tab, query } : tab)),
        })),
    }))),

    updateTabContext: (id, patch) => set((state) => updateActiveSession(state, (session) => ({
        ...session,
        groups: session.groups.map((group) => ({
            ...group,
            tabs: group.tabs.map((tab) => (
                tab.id === id
                    ? { ...tab, context: { ...(tab.context || {}), ...patch } }
                    : tab
            )),
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
            tabs: group.tabs.map((tab) => (
                tab.id === id && tab.type === TAB_TYPE.QUERY
                    ? { ...tab, name: newName }
                    : tab
            )),
        })),
    }))),

    setTabQuery: (id, query) => set((state) => updateActiveSession(state, (session) => ({
        ...session,
        groups: session.groups.map((group) => ({
            ...group,
            tabs: group.tabs.map((tab) => (tab.id === id ? { ...tab, query } : tab)),
        })),
    }))),
});
