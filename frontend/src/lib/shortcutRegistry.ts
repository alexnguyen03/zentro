import { BeginTransaction, CommitTransaction, RollbackTransaction } from '../../wailsjs/go/app/App';
import { WindowReloadApp } from '../../wailsjs/runtime/runtime';
import { useConnectionStore } from '../stores/connectionStore';
import { useEditorStore } from '../stores/editorStore';
import { useLayoutStore } from '../stores/layoutStore';
import { DOM_EVENT, TAB_TYPE } from './constants';

export type CommandCategory = 'Editor' | 'Layout' | 'Connection' | 'View' | 'App';

export type CommandId =
  | 'editor.newTab'
  | 'editor.closeTab'
  | 'editor.runQuery'
  | 'editor.explain'
  | 'editor.explainAnalyze'
  | 'editor.formatQuery'
  | 'editor.toggleBookmark'
  | 'editor.nextBookmark'
  | 'editor.compareQueries'
  | 'view.openSettings'
  | 'view.openShortcuts'
  | 'view.commandPalette'
  | 'layout.toggleSidebar'
  | 'layout.toggleRightSidebar'
  | 'layout.toggleResultPanel'
  | 'connection.openWorkspaces'
  | 'connection.beginTx'
  | 'connection.commitTx'
  | 'connection.rollbackTx'
  | 'app.reload';

export interface ShortcutRegistryEntry {
  id: CommandId;
  label: string;
  category: CommandCategory;
  defaultBinding: string;
  action: () => void | Promise<void>;
}

export const shortcutRegistry: ShortcutRegistryEntry[] = [
  {
    id: 'editor.newTab',
    label: 'New Query Tab',
    category: 'Editor',
    defaultBinding: 'Ctrl+T',
    action: () => { useEditorStore.getState().addTab(); },
  },
  {
    id: 'editor.closeTab',
    label: 'Close Current Tab',
    category: 'Editor',
    defaultBinding: 'Ctrl+W',
    action: () => { window.dispatchEvent(new CustomEvent(DOM_EVENT.CLOSE_ACTIVE_TAB)); },
  },
  {
    id: 'editor.runQuery',
    label: 'Run Query',
    category: 'Editor',
    defaultBinding: 'Ctrl+Enter',
    action: () => {
      const state = useEditorStore.getState();
      const activeGroup = state.groups.find(g => g.id === state.activeGroupId);
      const activeTab = activeGroup?.tabs.find(t => t.id === activeGroup.activeTabId);
      if (activeTab) {
        window.dispatchEvent(new CustomEvent(DOM_EVENT.RUN_QUERY_ACTION, { detail: { tabId: activeTab.id } }));
      }
    },
  },
  {
    id: 'editor.explain',
    label: 'Explain Query',
    category: 'Editor',
    defaultBinding: 'Ctrl+Shift+E',
    action: () => {
      const state = useEditorStore.getState();
      const activeGroup = state.groups.find(g => g.id === state.activeGroupId);
      const activeTab = activeGroup?.tabs.find(t => t.id === activeGroup.activeTabId);
      if (activeTab) {
        window.dispatchEvent(new CustomEvent(DOM_EVENT.RUN_EXPLAIN_ACTION, { detail: { tabId: activeTab.id, analyze: false } }));
      }
    },
  },
  {
    id: 'editor.explainAnalyze',
    label: 'Explain Analyze',
    category: 'Editor',
    defaultBinding: 'Ctrl+Alt+E',
    action: () => {
      const state = useEditorStore.getState();
      const activeGroup = state.groups.find(g => g.id === state.activeGroupId);
      const activeTab = activeGroup?.tabs.find(t => t.id === activeGroup.activeTabId);
      if (activeTab) {
        window.dispatchEvent(new CustomEvent(DOM_EVENT.RUN_EXPLAIN_ACTION, { detail: { tabId: activeTab.id, analyze: true } }));
      }
    },
  },
  {
    id: 'editor.formatQuery',
    label: 'Format Query',
    category: 'Editor',
    defaultBinding: 'Ctrl+Shift+F',
    action: () => {
      const state = useEditorStore.getState();
      const activeGroup = state.groups.find(g => g.id === state.activeGroupId);
      const activeTab = activeGroup?.tabs.find(t => t.id === activeGroup.activeTabId);
      if (activeTab) {
        window.dispatchEvent(new CustomEvent(DOM_EVENT.FORMAT_QUERY_ACTION, { detail: { tabId: activeTab.id } }));
      }
    },
  },
  {
    id: 'editor.toggleBookmark',
    label: 'Toggle Bookmark',
    category: 'Editor',
    defaultBinding: 'Ctrl+F2',
    action: () => {
      const state = useEditorStore.getState();
      const activeGroup = state.groups.find(g => g.id === state.activeGroupId);
      const activeTab = activeGroup?.tabs.find(t => t.id === activeGroup.activeTabId);
      if (activeTab) {
        window.dispatchEvent(new CustomEvent(DOM_EVENT.TOGGLE_BOOKMARK_ACTION, { detail: { tabId: activeTab.id } }));
      }
    },
  },
  {
    id: 'editor.nextBookmark',
    label: 'Next Bookmark',
    category: 'Editor',
    defaultBinding: 'F2',
    action: () => {
      if (document.querySelector('.monaco-editor.focused')) {
        const state = useEditorStore.getState();
        const activeGroup = state.groups.find(g => g.id === state.activeGroupId);
        const activeTab = activeGroup?.tabs.find(t => t.id === activeGroup.activeTabId);
        if (activeTab) {
          window.dispatchEvent(new CustomEvent(DOM_EVENT.NEXT_BOOKMARK_ACTION, { detail: { tabId: activeTab.id } }));
        }
        return;
      }

      const state = useEditorStore.getState();
      const activeGroup = state.groups.find(g => g.id === state.activeGroupId);
      if (activeGroup?.activeTabId) {
        window.dispatchEvent(new CustomEvent(DOM_EVENT.RENAME_TAB, { detail: activeGroup.activeTabId }));
      }
    },
  },
  {
    id: 'editor.compareQueries',
    label: 'Compare Queries',
    category: 'Editor',
    defaultBinding: 'Ctrl+Shift+D',
    action: () => { window.dispatchEvent(new CustomEvent(DOM_EVENT.OPEN_QUERY_COMPARE)); },
  },
  {
    id: 'view.openSettings',
    label: 'Open Settings',
    category: 'View',
    defaultBinding: 'Ctrl+,',
    action: () => { useEditorStore.getState().addTab({ type: TAB_TYPE.SETTINGS, name: 'Settings' }); },
  },
  {
    id: 'view.openShortcuts',
    label: 'Open Keyboard Shortcuts',
    category: 'View',
    defaultBinding: 'Ctrl+K Ctrl+B',
    action: () => { useEditorStore.getState().addTab({ type: TAB_TYPE.SHORTCUTS, name: 'Keyboard Shortcuts' }); },
  },
  {
    id: 'view.commandPalette',
    label: 'Toggle Command Palette',
    category: 'View',
    defaultBinding: 'Ctrl+Shift+P',
    action: () => { useLayoutStore.getState().toggleCommandPalette(); },
  },
  {
    id: 'layout.toggleSidebar',
    label: 'Toggle Left Sidebar',
    category: 'Layout',
    defaultBinding: 'Ctrl+B',
    action: () => { useLayoutStore.getState().toggleSidebar(); },
  },
  {
    id: 'layout.toggleRightSidebar',
    label: 'Toggle Right Sidebar',
    category: 'Layout',
    defaultBinding: 'Ctrl+Alt+B',
    action: () => { useLayoutStore.getState().toggleRightSidebar(); },
  },
  {
    id: 'layout.toggleResultPanel',
    label: 'Toggle Result Panel',
    category: 'Layout',
    defaultBinding: 'Ctrl+J',
    action: () => {
      const state = useEditorStore.getState();
      const activeGroup = state.groups.find(g => g.id === state.activeGroupId);
      const activeTab = activeGroup?.tabs.find(t => t.id === activeGroup.activeTabId);
      if (activeTab?.type === TAB_TYPE.QUERY) {
        useLayoutStore.getState().toggleResultPanel();
      }
    },
  },
  {
    id: 'connection.openWorkspaces',
    label: 'Open Workspaces / Switch Connection',
    category: 'Connection',
    defaultBinding: 'Ctrl+Shift+C',
    action: () => { window.dispatchEvent(new CustomEvent(DOM_EVENT.OPEN_WORKSPACE_MODAL)); },
  },
  {
    id: 'connection.beginTx',
    label: 'Begin Transaction',
    category: 'Connection',
    defaultBinding: 'Ctrl+Shift+7',
    action: async () => {
      if (useConnectionStore.getState().isConnected) {
        await BeginTransaction();
      }
    },
  },
  {
    id: 'connection.commitTx',
    label: 'Commit Transaction',
    category: 'Connection',
    defaultBinding: 'Ctrl+Shift+8',
    action: async () => {
      if (useConnectionStore.getState().isConnected) {
        await CommitTransaction();
      }
    },
  },
  {
    id: 'connection.rollbackTx',
    label: 'Rollback Transaction',
    category: 'Connection',
    defaultBinding: 'Ctrl+Shift+9',
    action: async () => {
      if (useConnectionStore.getState().isConnected) {
        await RollbackTransaction();
      }
    },
  },
  {
    id: 'app.reload',
    label: 'Reload Application',
    category: 'App',
    defaultBinding: 'Ctrl+Shift+R',
    action: () => { WindowReloadApp(); },
  },
];

export const defaultShortcutMap: Record<CommandId, string> = shortcutRegistry.reduce((acc, item) => {
  acc[item.id] = item.defaultBinding;
  return acc;
}, {} as Record<CommandId, string>);

function normalizeKeyToken(key: string): string {
  const k = key.toLowerCase();
  if (k === 'control') return 'ctrl';
  if (k === 'command') return 'meta';
  return k;
}

export function normalizeBinding(binding: string): string {
  return binding
    .trim()
    .split(' ')
    .map(part =>
      part
        .split('+')
        .map(token => normalizeKeyToken(token))
        .sort()
        .join('+'),
    )
    .join(' ');
}

export function eventToKeyToken(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('ctrl');
  if (e.altKey) parts.push('alt');
  if (e.shiftKey) parts.push('shift');
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
  if (key !== 'control' && key !== 'shift' && key !== 'alt' && key !== 'meta') {
    parts.push(key);
  }
  return parts.sort().join('+');
}
