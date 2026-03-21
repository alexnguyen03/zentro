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
    content?: string; // used for table name if type === 'table'
    readOnly?: boolean;
    sourceTabId?: string;
    generatedKind?: 'result' | 'explain';
}

export interface TabGroup {
    id: string;
    tabs: Tab[];
    activeTabId: string | null;
}

interface EditorState {
    groups: TabGroup[];
    activeGroupId: string | null;

    addTab: (tabInit?: Partial<Tab>, targetGroupId?: string) => string;
    removeTab: (id: string, groupId?: string) => void;
    setActiveTabId: (tabId: string, groupId: string) => void;
    setActiveGroupId: (groupId: string) => void;
    updateTabQuery: (id: string, query: string) => void;
    setTabRunning: (id: string, isRunning: boolean) => void;
    renameTab: (id: string, newName: string) => void;
    setTabQuery: (id: string, query: string) => void;

    // Split View Actions
    splitGroup: (sourceGroupId: string, tabId: string) => void;
    splitGroupFromDrag: (sourceGroupId: string, tabId: string, targetGroupId: string, direction: 'left' | 'right') => void;
    closeGroup: (groupId: string) => void;

    // DnD Actions
    moveTab: (tabId: string, sourceGroupId: string, targetGroupId: string, newIndex: number) => void;
}

// Helper to generate a unique query name
const getNextTabName = (groups: TabGroup[], baseName: string = 'New Query'): string => {
    let name = baseName;
    let count = 1;
    let checkName = name;

    // Check across all groups
    while (groups.some(g => g.tabs.some(t => t.name === checkName))) {
        count++;
        checkName = `${name} ${count}`;
    }
    return checkName;
};

export const useEditorStore = create<EditorState>()(
    persist(
        withStoreLogger('editorStore', (set, get) => ({
            groups: [{ id: 'group-1', tabs: [], activeTabId: null }],
            activeGroupId: 'group-1',

            addTab: (tabInit, targetGroupId) => {
                let id = tabInit?.id || crypto.randomUUID();

                set((state) => {
                    const targetId = targetGroupId || state.activeGroupId || state.groups[0].id;
                    const groupIndex = state.groups.findIndex(g => g.id === targetId);
                    if (groupIndex === -1) return state;

                    if (tabInit?.id) {
                        for (const g of state.groups) {
                            const existingTab = g.tabs.find(t => t.id === tabInit.id);
                            if (existingTab) {
                                id = existingTab.id;
                                return {
                                    groups: state.groups.map(grp => {
                                        if (grp.id !== g.id) return grp;
                                        return {
                                            ...grp,
                                            activeTabId: existingTab.id,
                                            tabs: grp.tabs.map(tab => tab.id === existingTab.id ? { ...tab, ...tabInit, id: existingTab.id } : tab),
                                        };
                                    }),
                                    activeGroupId: g.id,
                                };
                            }
                        }
                    }

                    // If it's a table tab, verify if one already exists with the same content
                    if (tabInit?.type === 'table' && tabInit.content) {
                        for (const g of state.groups) {
                            const existingTab = g.tabs.find(t => t.type === 'table' && t.content === tabInit.content);
                            if (existingTab) {
                                id = existingTab.id;
                                return {
                                    groups: state.groups.map(grp => grp.id === g.id ? { ...grp, activeTabId: existingTab.id } : grp),
                                    activeGroupId: g.id,
                                };
                            }
                        }
                    }

                    // If it's a settings or shortcuts tab, only allow one
                    if (tabInit?.type === 'settings' || tabInit?.type === 'shortcuts') {
                        for (const g of state.groups) {
                            const existingTab = g.tabs.find(t => t.type === tabInit.type);
                            if (existingTab) {
                                id = existingTab.id;
                                return {
                                    groups: state.groups.map(grp => grp.id === g.id ? { ...grp, activeTabId: existingTab.id } : grp),
                                    activeGroupId: g.id,
                                };
                            }
                        }
                    }

                    const name = tabInit?.name || (tabInit?.type === TAB_TYPE.TABLE ? tabInit.content! : getNextTabName(state.groups));
                    const newTab: Tab = {
                        id,
                        name,
                        query: tabInit?.query || '',
                        isRunning: false,
                        type: tabInit?.type || TAB_TYPE.QUERY,
                        content: tabInit?.content,
                        ...tabInit
                    };

                    const newGroups = state.groups.map(g => {
                        if (g.id === targetId) {
                            return {
                                ...g,
                                tabs: [...g.tabs, newTab],
                                activeTabId: id,
                            };
                        }
                        return g;
                    });

                    return {
                        groups: newGroups,
                        activeGroupId: targetId,
                    };
                });
                return id;
            },

            removeTab: (id, targetGroupId) => set((state) => {
                const newGroups = state.groups.map(g => {
                    if (targetGroupId && g.id !== targetGroupId) return g;

                    if (!g.tabs.some(t => t.id === id)) return g;

                    const newTabs = g.tabs.filter(t => t.id !== id);
                    let newActiveId = g.activeTabId;
                    if (newActiveId === id) {
                        newActiveId = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null;
                    }
                    return { ...g, tabs: newTabs, activeTabId: newActiveId };
                });
                return { groups: newGroups };
            }),

            setActiveTabId: (tabId, groupId) => set((state) => {
                return {
                    groups: state.groups.map(g => g.id === groupId ? { ...g, activeTabId: tabId } : g),
                    activeGroupId: groupId, // Also focus the group
                };
            }),

            setActiveGroupId: (groupId) => set({ activeGroupId: groupId }),

            updateTabQuery: (id, query) => set((state) => ({
                groups: state.groups.map(g => ({
                    ...g,
                    tabs: g.tabs.map(t => t.id === id ? { ...t, query } : t)
                }))
            })),

            setTabRunning: (id, isRunning) => set((state) => ({
                groups: state.groups.map(g => ({
                    ...g,
                    tabs: g.tabs.map(t => t.id === id ? { ...t, isRunning } : t)
                }))
            })),

            renameTab: (id, newName) => set((state) => ({
                groups: state.groups.map(g => ({
                    ...g,
                    tabs: g.tabs.map(t => t.id === id ? { ...t, name: newName } : t)
                }))
            })),

            setTabQuery: (id, query) => set((state) => ({
                groups: state.groups.map(g => ({
                    ...g,
                    tabs: g.tabs.map(t => t.id === id ? { ...t, query } : t)
                }))
            })),

            splitGroup: (sourceGroupId, tabId) => set((state) => {
                const sourceGroup = state.groups.find(g => g.id === sourceGroupId);
                if (!sourceGroup) return state;

                const tabToMove = sourceGroup.tabs.find(t => t.id === tabId);
                if (!tabToMove) return state;

                // Move tab out of source group
                const newSourceTabs = sourceGroup.tabs.filter(t => t.id !== tabId);
                let newSourceActiveId = sourceGroup.activeTabId;
                if (newSourceActiveId === tabId) {
                    newSourceActiveId = newSourceTabs.length > 0 ? newSourceTabs[newSourceTabs.length - 1].id : null;
                }

                const newGroupId = crypto.randomUUID();
                const newGroup: TabGroup = {
                    id: newGroupId,
                    tabs: [tabToMove],
                    activeTabId: tabId,
                };

                const newGroups = state.groups.map(g =>
                    g.id === sourceGroupId
                        ? { ...g, tabs: newSourceTabs, activeTabId: newSourceActiveId }
                        : g
                );

                // Insert the new group immediately after the source group
                const sourceIndex = newGroups.findIndex(g => g.id === sourceGroupId);
                newGroups.splice(sourceIndex + 1, 0, newGroup);

                return {
                    groups: newGroups,
                    activeGroupId: newGroupId
                };
            }),

            splitGroupFromDrag: (sourceGroupId, tabId, targetGroupId, direction) => set((state) => {
                const sourceGroup = state.groups.find(g => g.id === sourceGroupId);
                if (!sourceGroup) return state;

                const tabToMove = sourceGroup.tabs.find(t => t.id === tabId);
                if (!tabToMove) return state;

                // Move tab out of source group
                const newSourceTabs = sourceGroup.tabs.filter(t => t.id !== tabId);
                let newSourceActiveId = sourceGroup.activeTabId;
                if (newSourceActiveId === tabId) {
                    newSourceActiveId = newSourceTabs.length > 0 ? newSourceTabs[newSourceTabs.length - 1].id : null;
                }

                const newGroupId = crypto.randomUUID();
                const newGroup: TabGroup = {
                    id: newGroupId,
                    tabs: [tabToMove],
                    activeTabId: tabId,
                };

                const intermediateGroups = state.groups.map(g =>
                    g.id === sourceGroupId
                        ? { ...g, tabs: newSourceTabs, activeTabId: newSourceActiveId }
                        : g
                );

                const targetIndex = intermediateGroups.findIndex(g => g.id === targetGroupId);
                if (targetIndex === -1) return state;

                const insertIndex = direction === 'left' ? targetIndex : targetIndex + 1;
                intermediateGroups.splice(insertIndex, 0, newGroup);

                return {
                    groups: intermediateGroups,
                    activeGroupId: newGroupId
                };
            }),

            closeGroup: (groupId) => set((state) => {
                let newGroups = state.groups.filter(g => g.id !== groupId);

                // Fallback to a default group if we closed the last one
                if (newGroups.length === 0) {
                    newGroups = [{ id: 'group-1', tabs: [], activeTabId: null }];
                }

                let newActiveGrpId = state.activeGroupId;
                if (newActiveGrpId === groupId) {
                    newActiveGrpId = newGroups[0].id;
                }

                return {
                    groups: newGroups,
                    activeGroupId: newActiveGrpId
                };
            }),

            moveTab: (tabId, sourceGroupId, targetGroupId, newIndex) => set((state) => {
                const sourceGroup = state.groups.find(g => g.id === sourceGroupId);
                const targetGroup = state.groups.find(g => g.id === targetGroupId);
                if (!sourceGroup || !targetGroup) return state;

                const tabIndexInSource = sourceGroup.tabs.findIndex(t => t.id === tabId);
                if (tabIndexInSource === -1) return state;

                const tab = sourceGroup.tabs[tabIndexInSource];

                let newGroups = [...state.groups];

                if (sourceGroupId === targetGroupId) {
                    // Reorder within the same group
                    const newTabs = [...sourceGroup.tabs];
                    newTabs.splice(tabIndexInSource, 1);
                    newTabs.splice(newIndex, 0, tab);

                    newGroups = newGroups.map(g => g.id === sourceGroupId ? { ...g, tabs: newTabs } : g);
                } else {
                    // Move to a different group
                    const newSourceTabs = [...sourceGroup.tabs];
                    newSourceTabs.splice(tabIndexInSource, 1);

                    let newSourceActiveId = sourceGroup.activeTabId;
                    if (newSourceActiveId === tabId) {
                        newSourceActiveId = newSourceTabs.length > 0 ? newSourceTabs[newSourceTabs.length - 1].id : null;
                    }

                    const newTargetTabs = [...targetGroup.tabs];
                    newTargetTabs.splice(newIndex, 0, tab);

                    newGroups = newGroups.map(g => {
                        if (g.id === sourceGroupId) {
                            return { ...g, tabs: newSourceTabs, activeTabId: newSourceActiveId };
                        }
                        if (g.id === targetGroupId) {
                            return { ...g, tabs: newTargetTabs, activeTabId: tabId }; // activate moved tab
                        }
                        return g;
                    });
                }

                return {
                    groups: newGroups,
                    activeGroupId: targetGroupId,
                };
            })
        })),
        {
            name: STORAGE_KEY.EDITOR_SESSION, // Change name to drop old state because schema changed
            partialize: (state) => ({
                groups: state.groups.map(g => ({
                    ...g,
                    tabs: g.tabs.map(t => ({ ...t, isRunning: false }))
                })),
                activeGroupId: state.activeGroupId,
            }),
            onRehydrateStorage: () => (state, error) => {
                if (error) {
                    console.error('Failed to hydrate editor session', error);
                } else if (state) {
                    // Fix: Ensure all tabs have a type (migration for older sessions)
                    state.groups?.forEach(g => {
                        g.tabs?.forEach(t => {
                            if (!t.type) t.type = TAB_TYPE.QUERY;
                        });
                    });

                    if (!state.groups || state.groups.length === 0) {
                        const newId = crypto.randomUUID();
                        const newTab: Tab = { id: newId, name: 'New Query', query: '', isRunning: false, type: TAB_TYPE.QUERY };
                        state.groups = [{ id: 'group-1', tabs: [newTab], activeTabId: newId }];
                        state.activeGroupId = 'group-1';
                    } else if (state.groups.every(g => g.tabs.length === 0)) {
                        const g = state.groups[0];
                        const newId = crypto.randomUUID();
                        const newTab: Tab = { id: newId, name: 'New Query', query: '', isRunning: false, type: TAB_TYPE.QUERY };
                        g.tabs.push(newTab);
                        g.activeTabId = newId;
                    }
                }
            }
        }
    )
);
