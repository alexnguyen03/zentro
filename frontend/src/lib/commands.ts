import { WindowReloadApp } from '../../wailsjs/runtime/runtime';
import { useEditorStore } from '../stores/editorStore';
import { useLayoutStore } from '../stores/layoutStore';
import { DOM_EVENT, TAB_TYPE } from './constants';

export type CommandCategory = 'Editor' | 'Layout' | 'Connection' | 'View' | 'App';

export interface CommandItem {
    id: string;
    label: string;
    category: CommandCategory;
    keybinding?: string;
    action: () => void;
}

/**
 * Builds the full command list, closing over current store state.
 * Call this inside the CommandPalette component on each render.
 */
export function buildCommands(): CommandItem[] {
    const { addTab } = useEditorStore.getState();
    const layout = useLayoutStore.getState();

    return [
        // ── Editor ────────────────────────────────────────────────────────
        {
            id: 'editor.newTab',
            label: 'New Query Tab',
            category: 'Editor',
            keybinding: 'Ctrl+T',
            action: () => addTab(),
        },
        {
            id: 'editor.closeTab',
            label: 'Close Current Tab',
            category: 'Editor',
            keybinding: 'Ctrl+W',
            action: () => {
                // Dispatch close event — QueryTabs listens for this
                window.dispatchEvent(new CustomEvent(DOM_EVENT.CLOSE_ACTIVE_TAB));
            },
        },
        {
            id: 'editor.runQuery',
            label: 'Run Query',
            category: 'Editor',
            keybinding: 'Ctrl+Enter',
            action: () => {
                const state = useEditorStore.getState();
                const activeGroup = state.groups.find(g => g.id === state.activeGroupId);
                const activeTab = activeGroup?.tabs.find(t => t.id === activeGroup.activeTabId);
                if (activeTab) {
                    window.dispatchEvent(new CustomEvent(DOM_EVENT.RUN_QUERY_ACTION, { detail: { tabId: activeTab.id } }));
                }
            },
        },

        // ── View ──────────────────────────────────────────────────────────
        {
            id: 'view.openSettings',
            label: 'Open Settings',
            category: 'View',
            keybinding: 'Ctrl+,',
            action: () => addTab({ type: TAB_TYPE.SETTINGS, name: 'Settings' }),
        },
        {
            id: 'view.openShortcuts',
            label: 'Open Keyboard Shortcuts',
            category: 'View',
            keybinding: 'Ctrl+K Ctrl+B',
            action: () => addTab({ type: TAB_TYPE.SHORTCUTS, name: 'Keyboard Shortcuts' }),
        },
        {
            id: 'view.commandPalette',
            label: 'Toggle Command Palette',
            category: 'View',
            keybinding: 'Ctrl+Shift+P',
            action: () => layout.toggleCommandPalette(),
        },

        // ── Layout ────────────────────────────────────────────────────────
        {
            id: 'layout.toggleSidebar',
            label: 'Toggle Left Sidebar',
            category: 'Layout',
            keybinding: 'Ctrl+B',
            action: () => layout.toggleSidebar(),
        },
        {
            id: 'layout.toggleRightSidebar',
            label: 'Toggle Right Sidebar',
            category: 'Layout',
            keybinding: 'Ctrl+Alt+B',
            action: () => layout.toggleRightSidebar(),
        },
        {
            id: 'layout.toggleResultPanel',
            label: 'Toggle Result Panel',
            category: 'Layout',
            keybinding: 'Ctrl+J',
            action: () => layout.toggleResultPanel(),
        },

        // ── Connection ────────────────────────────────────────────────────
        {
            id: 'connection.openWorkspaces',
            label: 'Open Workspaces / Switch Connection',
            category: 'Connection',
            keybinding: 'Ctrl+Shift+C',
            action: () => {
                window.dispatchEvent(new CustomEvent(DOM_EVENT.OPEN_WORKSPACE_MODAL));
            },
        },

        // ── App ───────────────────────────────────────────────────────────
        {
            id: 'app.reload',
            label: 'Reload Application',
            category: 'App',
            keybinding: 'Ctrl+Shift+R',
            action: () => WindowReloadApp(),
        },
    ];
}
