import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditorStore } from './editorStore';
import { TAB_TYPE } from '../lib/constants';

describe('editorStore', () => {
    beforeEach(() => {
        vi.stubGlobal('crypto', {
            randomUUID: vi.fn()
                .mockReturnValueOnce('tab-1')
                .mockReturnValueOnce('group-2')
                .mockReturnValue('uuid'),
        });
        useEditorStore.setState({
            groups: [{ id: 'group-1', tabs: [], activeTabId: null }],
            activeGroupId: 'group-1',
        } as any);
    });

    it('adds and activates a tab', () => {
        const id = useEditorStore.getState().addTab({ name: 'Tab A' });
        const state = useEditorStore.getState();
        expect(id).toBe('tab-1');
        expect(state.groups[0].tabs).toHaveLength(1);
        expect(state.groups[0].activeTabId).toBe('tab-1');
    });

    it('moves tab to a split group', () => {
        const id = useEditorStore.getState().addTab({ name: 'Tab A' });
        useEditorStore.getState().splitGroup('group-1', id);

        const state = useEditorStore.getState();
        expect(state.groups).toHaveLength(2);
        expect(state.groups[1].tabs[0].id).toBe(id);
    });

    it('renames only query tabs', () => {
        const queryId = useEditorStore.getState().addTab({ name: 'Query A', type: TAB_TYPE.QUERY });
        const settingsId = useEditorStore.getState().addTab({ name: 'Settings', type: TAB_TYPE.SETTINGS });

        useEditorStore.getState().renameTab(queryId, 'Renamed Query');
        useEditorStore.getState().renameTab(settingsId, 'Should Not Rename');

        const tabs = useEditorStore.getState().groups.flatMap((group) => group.tabs);
        expect(tabs.find((tab) => tab.id === queryId)?.name).toBe('Renamed Query');
        expect(tabs.find((tab) => tab.id === settingsId)?.name).toBe('Settings');
    });
});
