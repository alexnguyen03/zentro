import { StateCreator } from 'zustand';
import { EditorState } from './types';
import { createEmptySession, updateActiveSession } from './sessionUtils';

export interface GroupSlice {
    setActiveGroupId: (groupId: string) => void;
    splitGroup: (sourceGroupId: string, tabId: string) => void;
    splitGroupFromDrag: (sourceGroupId: string, tabId: string, targetGroupId: string, direction: 'left' | 'right') => void;
    closeGroup: (groupId: string) => void;
    moveTab: (tabId: string, sourceGroupId: string, targetGroupId: string, newIndex: number) => void;
}

export const createGroupSlice: StateCreator<EditorState, [], [], GroupSlice> = (set) => ({
    setActiveGroupId: (groupId) => set((state) => updateActiveSession(state, (session) => ({
        ...session,
        activeGroupId: groupId,
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
});
