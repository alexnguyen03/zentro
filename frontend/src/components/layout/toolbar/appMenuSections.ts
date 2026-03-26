import {
    WindowMinimise,
    WindowToggleMaximise,
    Quit,
    WindowReload,
    WindowReloadApp,
    BrowserOpenURL,
} from '../../../../wailsjs/runtime/runtime';
import { DOM_EVENT, TAB_TYPE } from '../../../lib/constants';
import { emitCommand } from '../../../lib/commandBus';
import type { CommandId } from '../../../lib/shortcutRegistry';
import type { Tab } from '../../../stores/editorStore';

const REPO_URL = 'https://github.com/alexnguyen03/zentro';

export interface AppMenuItem {
    id: string;
    label: string;
    shortcut?: string;
    disabled?: boolean;
    danger?: boolean;
    hasBadge?: boolean;
    action: () => void | Promise<void>;
}

export interface AppMenuSection {
    id: string;
    title: string;
    items: AppMenuItem[];
}

interface BuildAppMenuSectionsParams {
    getShortcut: (commandId: CommandId) => string;
    addTab: (tabInit?: Partial<Tab>, targetGroupId?: string) => string;
    setShowCommandPalette: (show: boolean) => void;
    toggleSidebar: () => void;
    toggleResultPanel: () => void;
    toggleRightSidebar: () => void;
    isQueryTab: boolean;
    isChecking: boolean;
    hasUpdate: boolean;
    onCheckForUpdates: () => void | Promise<void>;
    onOpenAbout: () => void;
    onOpenLicense: () => void;
}

export function buildAppMenuSections({
    getShortcut,
    addTab,
    setShowCommandPalette,
    toggleSidebar,
    toggleResultPanel,
    toggleRightSidebar,
    isQueryTab,
    isChecking,
    hasUpdate,
    onCheckForUpdates,
    onOpenAbout,
    onOpenLicense,
}: BuildAppMenuSectionsParams): AppMenuSection[] {
    return [
        {
            id: 'file',
            title: 'File',
            items: [
                {
                    id: 'file.reload',
                    label: 'Reload Frontend',
                    shortcut: getShortcut('app.reload'),
                    action: () => WindowReloadApp(),
                },
                {
                    id: 'file.restart',
                    label: 'Restart App',
                    action: () => WindowReload(),
                },
                {
                    id: 'file.quit',
                    label: 'Quit',
                    danger: true,
                    action: () => Quit(),
                },
            ],
        },
        {
            id: 'edit',
            title: 'Edit',
            items: [
                {
                    id: 'edit.newTab',
                    label: 'New Query Tab',
                    shortcut: getShortcut('editor.newTab'),
                    action: () => addTab(),
                },
                {
                    id: 'edit.closeTab',
                    label: 'Close Current Tab',
                    shortcut: getShortcut('editor.closeTab'),
                    action: () => emitCommand(DOM_EVENT.CLOSE_ACTIVE_TAB),
                },
                {
                    id: 'edit.commandPalette',
                    label: 'Command Palette',
                    shortcut: getShortcut('view.commandPalette'),
                    action: () => setShowCommandPalette(true),
                },
                {
                    id: 'edit.formatQuery',
                    label: 'Format Query',
                    shortcut: getShortcut('editor.formatQuery'),
                    action: () => emitCommand(DOM_EVENT.FORMAT_QUERY_ACTION),
                },
            ],
        },
        {
            id: 'view',
            title: 'View',
            items: [
                {
                    id: 'view.settings',
                    label: 'Settings',
                    shortcut: getShortcut('view.openSettings'),
                    action: () => addTab({ type: TAB_TYPE.SETTINGS, name: 'Settings' }),
                },
                {
                    id: 'view.shortcuts',
                    label: 'Keyboard Shortcuts',
                    shortcut: getShortcut('view.openShortcuts'),
                    action: () => addTab({ type: TAB_TYPE.SHORTCUTS, name: 'Keyboard Shortcuts' }),
                },
                {
                    id: 'view.sidebar',
                    label: 'Toggle Sidebar',
                    shortcut: getShortcut('layout.toggleSidebar'),
                    action: () => toggleSidebar(),
                },
                {
                    id: 'view.resultPanel',
                    label: 'Toggle Result Panel',
                    shortcut: getShortcut('layout.toggleResultPanel'),
                    disabled: !isQueryTab,
                    action: () => toggleResultPanel(),
                },
                {
                    id: 'view.rightSidebar',
                    label: 'Toggle Right Sidebar',
                    shortcut: getShortcut('layout.toggleRightSidebar'),
                    action: () => toggleRightSidebar(),
                },
            ],
        },
        {
            id: 'window',
            title: 'Window',
            items: [
                {
                    id: 'window.minimize',
                    label: 'Minimize',
                    action: () => WindowMinimise(),
                },
                {
                    id: 'window.maximize',
                    label: 'Maximize / Restore',
                    action: () => WindowToggleMaximise(),
                },
            ],
        },
        {
            id: 'help',
            title: 'Help',
            items: [
                {
                    id: 'help.about',
                    label: 'About Zentro',
                    action: () => onOpenAbout(),
                },
                {
                    id: 'help.checkUpdates',
                    label: isChecking ? 'Checking for updates...' : 'Check for Updates',
                    disabled: isChecking,
                    hasBadge: hasUpdate,
                    action: () => onCheckForUpdates(),
                },
                {
                    id: 'help.license',
                    label: 'License',
                    action: () => onOpenLicense(),
                },
                {
                    id: 'help.releaseNotes',
                    label: 'Release Notes',
                    action: () => BrowserOpenURL(`${REPO_URL}/releases`),
                },
                {
                    id: 'help.reportIssue',
                    label: 'Report Issue',
                    action: () => BrowserOpenURL(`${REPO_URL}/issues`),
                },
            ],
        },
    ];
}
