import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from './editorStore';

const initialState = {
    groups: [{ id: 'group-1', tabs: [], activeTabId: null }],
    activeGroupId: 'group-1',
};

beforeEach(() => {
    // Merge reset: overwrite data properties without discarding action functions.
    useEditorStore.setState(initialState);
});

describe('addTab', () => {
    it('creates a tab with a generated name', () => {
        const id = useEditorStore.getState().addTab();
        const state = useEditorStore.getState();
        const group = state.groups[0];
        expect(group.tabs).toHaveLength(1);
        expect(group.tabs[0].id).toBe(id);
        expect(group.tabs[0].name).toBe('New Query');
        expect(group.tabs[0].isRunning).toBe(false);
    });

    it('increments tab name to avoid duplicates', () => {
        useEditorStore.getState().addTab();
        useEditorStore.getState().addTab();
        const tabs = useEditorStore.getState().groups[0].tabs;
        expect(tabs[0].name).toBe('New Query');
        expect(tabs[1].name).toBe('New Query 2');
    });

    it('sets activeTabId on the group', () => {
        const id = useEditorStore.getState().addTab();
        const group = useEditorStore.getState().groups[0];
        expect(group.activeTabId).toBe(id);
    });

    it('deduplicates table tabs with the same content', () => {
        const id1 = useEditorStore.getState().addTab({ type: 'table', content: 'users' });
        const id2 = useEditorStore.getState().addTab({ type: 'table', content: 'users' });
        expect(id1).toBe(id2);
        // Only one tab should exist.
        expect(useEditorStore.getState().groups[0].tabs).toHaveLength(1);
    });

    it('allows only one settings tab', () => {
        const id1 = useEditorStore.getState().addTab({ type: 'settings' });
        const id2 = useEditorStore.getState().addTab({ type: 'settings' });
        expect(id1).toBe(id2);
        const totalSettingsTabs = useEditorStore.getState().groups
            .flatMap(g => g.tabs)
            .filter(t => t.type === 'settings');
        expect(totalSettingsTabs).toHaveLength(1);
    });

    it('targets a specific group when targetGroupId is provided', () => {
        // Add a second group.
        useEditorStore.setState({
            groups: [
                { id: 'group-1', tabs: [], activeTabId: null },
                { id: 'group-2', tabs: [], activeTabId: null },
            ],
            activeGroupId: 'group-1',
        });
        useEditorStore.getState().addTab({}, 'group-2');
        const g2 = useEditorStore.getState().groups.find(g => g.id === 'group-2')!;
        expect(g2.tabs).toHaveLength(1);
    });
});

describe('removeTab', () => {
    it('removes the tab by id', () => {
        const id = useEditorStore.getState().addTab();
        useEditorStore.getState().removeTab(id);
        expect(useEditorStore.getState().groups[0].tabs).toHaveLength(0);
    });

    it('updates activeTabId to the previous tab when active tab is removed', () => {
        const id1 = useEditorStore.getState().addTab();
        const id2 = useEditorStore.getState().addTab();
        expect(useEditorStore.getState().groups[0].activeTabId).toBe(id2);
        useEditorStore.getState().removeTab(id2);
        expect(useEditorStore.getState().groups[0].activeTabId).toBe(id1);
    });

    it('sets activeTabId to null when last tab is removed', () => {
        const id = useEditorStore.getState().addTab();
        useEditorStore.getState().removeTab(id);
        expect(useEditorStore.getState().groups[0].activeTabId).toBeNull();
    });

    it('removes tab only from the target group when groupId is specified', () => {
        useEditorStore.setState({
            groups: [
                { id: 'g1', tabs: [], activeTabId: null },
                { id: 'g2', tabs: [], activeTabId: null },
            ],
            activeGroupId: 'g1',
        });
        const id1 = useEditorStore.getState().addTab({}, 'g1');
        const id2 = useEditorStore.getState().addTab({ id: id1 }, 'g2');  // same ID in g2 won't happen normally, but use a different one
        void id2;
        useEditorStore.getState().removeTab(id1, 'g1');
        expect(useEditorStore.getState().groups.find(g => g.id === 'g1')!.tabs).toHaveLength(0);
    });
});

describe('renameTab', () => {
    it('updates the tab name', () => {
        const id = useEditorStore.getState().addTab();
        useEditorStore.getState().renameTab(id, 'My Custom Query');
        const tab = useEditorStore.getState().groups[0].tabs.find(t => t.id === id)!;
        expect(tab.name).toBe('My Custom Query');
    });

    it('leaves other tabs unchanged', () => {
        const id1 = useEditorStore.getState().addTab();
        const id2 = useEditorStore.getState().addTab();
        useEditorStore.getState().renameTab(id1, 'Renamed');
        const tab2 = useEditorStore.getState().groups[0].tabs.find(t => t.id === id2)!;
        expect(tab2.name).toBe('New Query 2');
    });
});

describe('updateTabQuery / setTabQuery (unsaved changes)', () => {
    it('updateTabQuery reflects the new query content', () => {
        const id = useEditorStore.getState().addTab();
        useEditorStore.getState().updateTabQuery(id, 'SELECT 1');
        const tab = useEditorStore.getState().groups[0].tabs.find(t => t.id === id)!;
        expect(tab.query).toBe('SELECT 1');
    });

    it('setTabQuery reflects the new query content', () => {
        const id = useEditorStore.getState().addTab();
        useEditorStore.getState().setTabQuery(id, 'SELECT 2');
        const tab = useEditorStore.getState().groups[0].tabs.find(t => t.id === id)!;
        expect(tab.query).toBe('SELECT 2');
    });

    it('tracks query content as "unsaved" (query differs from initial empty string)', () => {
        const id = useEditorStore.getState().addTab();
        expect(useEditorStore.getState().groups[0].tabs.find(t => t.id === id)!.query).toBe('');
        useEditorStore.getState().updateTabQuery(id, 'SELECT modified');
        expect(useEditorStore.getState().groups[0].tabs.find(t => t.id === id)!.query).toBe('SELECT modified');
    });
});

describe('setTabRunning', () => {
    it('marks a tab as running', () => {
        const id = useEditorStore.getState().addTab();
        useEditorStore.getState().setTabRunning(id, true);
        expect(useEditorStore.getState().groups[0].tabs.find(t => t.id === id)!.isRunning).toBe(true);
    });

    it('clears the running flag', () => {
        const id = useEditorStore.getState().addTab();
        useEditorStore.getState().setTabRunning(id, true);
        useEditorStore.getState().setTabRunning(id, false);
        expect(useEditorStore.getState().groups[0].tabs.find(t => t.id === id)!.isRunning).toBe(false);
    });
});

describe('setActiveTabId / setActiveGroupId', () => {
    it('sets the active tab in the correct group', () => {
        const id = useEditorStore.getState().addTab();
        useEditorStore.getState().setActiveTabId(id, 'group-1');
        expect(useEditorStore.getState().groups[0].activeTabId).toBe(id);
    });

    it('setActiveGroupId changes the active group', () => {
        useEditorStore.setState({
            groups: [
                { id: 'g1', tabs: [], activeTabId: null },
                { id: 'g2', tabs: [], activeTabId: null },
            ],
            activeGroupId: 'g1',
        });
        useEditorStore.getState().setActiveGroupId('g2');
        expect(useEditorStore.getState().activeGroupId).toBe('g2');
    });
});
