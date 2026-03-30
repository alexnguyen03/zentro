import { BeginTransaction, CommitTransaction, RollbackTransaction } from '../services/queryService';
import { WindowReloadApp } from '../../wailsjs/runtime/runtime';
import { useConnectionStore } from '../stores/connectionStore';
import { useEditorStore } from '../stores/editorStore';
import { useLayoutStore } from '../stores/layoutStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useStatusStore } from '../stores/statusStore';
import { useEnvironmentStore } from '../stores/environmentStore';
import { useProjectStore } from '../stores/projectStore';
import { DOM_EVENT, ENVIRONMENT_KEY, TRANSACTION_STATUS, type EnvironmentKey, TAB_TYPE } from './constants';
import { emitCommand } from './commandBus';
import { utils } from '../../wailsjs/go/models';

export type CommandCategory = 'Editor' | 'Layout' | 'Connection' | 'View' | 'App';

export type BuiltInCommandId =
  | 'editor.newTab'
  | 'editor.saveTab'
  | 'editor.closeTab'
  | 'editor.contextSearch'
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
  | 'view.toggleViewMode'
  | 'layout.toggleSidebar'
  | 'layout.toggleRightSidebar'
  | 'layout.toggleResultPanel'
  | 'connection.openEnvironmentSwitcher'
  | 'connection.switchEnvLocal'
  | 'connection.switchEnvDevelopment'
  | 'connection.switchEnvTesting'
  | 'connection.switchEnvStaging'
  | 'connection.switchEnvProduction'
  | 'connection.beginTx'
  | 'connection.commitTx'
  | 'connection.rollbackTx'
  | 'app.reload';

export type CommandId = BuiltInCommandId | `ext.${string}`;

export interface CommandRegistryEntry {
  id: CommandId;
  label: string;
  category: CommandCategory;
  defaultBinding: string;
  action: () => void | Promise<void>;
  isEnabled?: () => boolean;
}

export type ShortcutRegistryEntry = CommandRegistryEntry;

async function switchProjectEnvironmentShortcut(environmentKey: EnvironmentKey) {
  const projectStore = useProjectStore.getState();
  const environmentStore = useEnvironmentStore.getState();
  const activeProject = projectStore.activeProject;
  if (!activeProject) return;

  if (environmentStore.activeEnvironmentKey !== environmentKey) {
    environmentStore.setActiveEnvironment(environmentKey);
  }

  await projectStore.setProjectEnvironment(environmentKey);
}

async function toggleViewModeShortcut() {
  const settings = useSettingsStore.getState();
  const next = !settings.viewMode;
  const transactionStatus = useStatusStore.getState().transactionStatus;

  if (next && transactionStatus === TRANSACTION_STATUS.ACTIVE) {
    return;
  }

  await settings.save(new utils.Preferences({ view_mode: next }));
}

function getBaseCommandRegistry(): CommandRegistryEntry[] {
  return [
  {
    id: 'editor.newTab',
    label: 'New Query Tab',
    category: 'Editor',
    defaultBinding: 'Ctrl+T',
    action: () => { useEditorStore.getState().addTab(); },
  },
  {
    id: 'editor.saveTab',
    label: 'Save Current Tab',
    category: 'Editor',
    defaultBinding: 'Ctrl+S',
    action: () => {
      const state = useEditorStore.getState();
      const activeGroup = state.groups.find(g => g.id === state.activeGroupId);
      if (activeGroup?.activeTabId) {
        emitCommand(DOM_EVENT.SAVE_TAB_ACTION, activeGroup.activeTabId);
      }
    },
  },
  {
    id: 'editor.closeTab',
    label: 'Close Current Tab',
    category: 'Editor',
    defaultBinding: 'Ctrl+W',
    action: () => { emitCommand(DOM_EVENT.CLOSE_ACTIVE_TAB); },
  },
  {
    id: 'editor.contextSearch',
    label: 'Open Context Search',
    category: 'Editor',
    defaultBinding: 'Ctrl+E',
    action: () => { emitCommand(DOM_EVENT.OPEN_CONTEXT_SEARCH); },
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
        emitCommand(DOM_EVENT.RUN_QUERY_ACTION, { tabId: activeTab.id });
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
        emitCommand(DOM_EVENT.RUN_EXPLAIN_ACTION, { tabId: activeTab.id, analyze: false });
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
        emitCommand(DOM_EVENT.RUN_EXPLAIN_ACTION, { tabId: activeTab.id, analyze: true });
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
        emitCommand(DOM_EVENT.FORMAT_QUERY_ACTION, { tabId: activeTab.id });
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
        emitCommand(DOM_EVENT.TOGGLE_BOOKMARK_ACTION, { tabId: activeTab.id });
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
          emitCommand(DOM_EVENT.NEXT_BOOKMARK_ACTION, { tabId: activeTab.id });
        }
        return;
      }

      const state = useEditorStore.getState();
      const activeGroup = state.groups.find(g => g.id === state.activeGroupId);
      if (activeGroup?.activeTabId) {
        emitCommand(DOM_EVENT.RENAME_TAB, activeGroup.activeTabId);
      }
    },
  },
  {
    id: 'editor.compareQueries',
    label: 'Compare Queries',
    category: 'Editor',
    defaultBinding: 'Ctrl+Shift+D',
    action: () => { emitCommand(DOM_EVENT.OPEN_QUERY_COMPARE); },
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
    id: 'view.toggleViewMode',
    label: 'Toggle View Mode',
    category: 'View',
    defaultBinding: 'Alt+Shift+V',
    action: async () => {
      await toggleViewModeShortcut();
    },
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
    isEnabled: () => {
      const state = useEditorStore.getState();
      const activeGroup = state.groups.find(g => g.id === state.activeGroupId);
      const activeTab = activeGroup?.tabs.find(t => t.id === activeGroup.activeTabId);
      return activeTab?.type === TAB_TYPE.QUERY;
    },
    action: () => {
      const state = useEditorStore.getState();
      const activeGroup = state.groups.find(g => g.id === state.activeGroupId);
      const activeTab = activeGroup?.tabs.find(t => t.id === activeGroup.activeTabId);
      if (activeTab?.type !== TAB_TYPE.QUERY) {
        return;
      }
      useLayoutStore.getState().toggleResultPanel();
    },
  },
  {
    id: 'connection.openEnvironmentSwitcher',
    label: 'Switch Environment / Connection',
    category: 'Connection',
    defaultBinding: 'Ctrl+Shift+C',
    action: () => { emitCommand(DOM_EVENT.OPEN_ENVIRONMENT_SWITCHER); },
  },
  {
    id: 'connection.switchEnvLocal',
    label: 'Switch Environment: Local',
    category: 'Connection',
    defaultBinding: 'Alt+Shift+L',
    action: async () => {
      await switchProjectEnvironmentShortcut(ENVIRONMENT_KEY.LOCAL);
    },
  },
  {
    id: 'connection.switchEnvDevelopment',
    label: 'Switch Environment: Development',
    category: 'Connection',
    defaultBinding: 'Alt+Shift+D',
    action: async () => {
      await switchProjectEnvironmentShortcut(ENVIRONMENT_KEY.DEVELOPMENT);
    },
  },
  {
    id: 'connection.switchEnvTesting',
    label: 'Switch Environment: Testing',
    category: 'Connection',
    defaultBinding: 'Alt+Shift+T',
    action: async () => {
      await switchProjectEnvironmentShortcut(ENVIRONMENT_KEY.TESTING);
    },
  },
  {
    id: 'connection.switchEnvStaging',
    label: 'Switch Environment: Staging',
    category: 'Connection',
    defaultBinding: 'Alt+Shift+G',
    action: async () => {
      await switchProjectEnvironmentShortcut(ENVIRONMENT_KEY.STAGING);
    },
  },
  {
    id: 'connection.switchEnvProduction',
    label: 'Switch Environment: Production',
    category: 'Connection',
    defaultBinding: 'Alt+Shift+P',
    action: async () => {
      await switchProjectEnvironmentShortcut(ENVIRONMENT_KEY.PRODUCTION);
    },
  },
  {
    id: 'connection.beginTx',
    label: 'Begin Transaction',
    category: 'Connection',
    defaultBinding: 'Ctrl+Shift+7',
    action: async () => {
      if (useConnectionStore.getState().isConnected && !useSettingsStore.getState().viewMode) {
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
      if (useConnectionStore.getState().isConnected && !useSettingsStore.getState().viewMode) {
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
      if (useConnectionStore.getState().isConnected && !useSettingsStore.getState().viewMode) {
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
}

function getContributionStore(): Map<CommandId, CommandRegistryEntry> {
  const storeHost = globalThis as typeof globalThis & {
    __zentroCommandContributions__?: Map<CommandId, CommandRegistryEntry>;
  };

  if (!storeHost.__zentroCommandContributions__) {
    storeHost.__zentroCommandContributions__ = new Map<CommandId, CommandRegistryEntry>();
  }

  return storeHost.__zentroCommandContributions__;
}

export function registerCommandContribution(entry: CommandRegistryEntry): () => void {
  const contributions = getContributionStore();
  contributions.set(entry.id, entry);
  return () => {
    contributions.delete(entry.id);
  };
}

export function getCommandRegistry(): CommandRegistryEntry[] {
  return [...getBaseCommandRegistry(), ...getContributionStore().values()];
}

export function getCommandById(id: CommandId): CommandRegistryEntry | undefined {
  const contributions = getContributionStore();
  if (contributions.has(id)) {
    return contributions.get(id);
  }
  return getBaseCommandRegistry().find((entry) => entry.id === id);
}

export function getDefaultShortcutMap(): Record<CommandId, string> {
  return getCommandRegistry().reduce((acc, item) => {
    acc[item.id] = item.defaultBinding;
    return acc;
  }, {} as Record<CommandId, string>);
}

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
