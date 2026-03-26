import {
    WindowMinimise,
    WindowToggleMaximise,
    Quit,
    WindowReload,
    WindowReloadApp,
    BrowserOpenURL,
} from '../../../../wailsjs/runtime/runtime';
import { shortcutRegistry, type CommandId } from '../../../lib/shortcutRegistry';

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
    isQueryTab: boolean;
    isChecking: boolean;
    hasUpdate: boolean;
    onCheckForUpdates: () => void | Promise<void>;
    onOpenAbout: () => void;
    onOpenLicense: () => void;
}

function getCommand(commandId: CommandId) {
    return shortcutRegistry.find((entry) => entry.id === commandId);
}

export function buildAppMenuSections({
    getShortcut,
    isQueryTab,
    isChecking,
    hasUpdate,
    onCheckForUpdates,
    onOpenAbout,
    onOpenLicense,
}: BuildAppMenuSectionsParams): AppMenuSection[] {
    const reloadCommand = getCommand('app.reload');
    const newTabCommand = getCommand('editor.newTab');
    const closeTabCommand = getCommand('editor.closeTab');
    const commandPaletteCommand = getCommand('view.commandPalette');
    const formatQueryCommand = getCommand('editor.formatQuery');
    const openSettingsCommand = getCommand('view.openSettings');
    const openShortcutsCommand = getCommand('view.openShortcuts');
    const toggleSidebarCommand = getCommand('layout.toggleSidebar');
    const toggleResultPanelCommand = getCommand('layout.toggleResultPanel');
    const toggleRightSidebarCommand = getCommand('layout.toggleRightSidebar');

    return [
        {
            id: 'file',
            title: 'File',
            items: [
                {
                    id: 'file.reload',
                    label: reloadCommand?.label || 'Reload Frontend',
                    shortcut: getShortcut('app.reload'),
                    action: () => reloadCommand?.action() || WindowReloadApp(),
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
                    label: newTabCommand?.label || 'New Query Tab',
                    shortcut: getShortcut('editor.newTab'),
                    action: () => newTabCommand?.action(),
                },
                {
                    id: 'edit.closeTab',
                    label: closeTabCommand?.label || 'Close Current Tab',
                    shortcut: getShortcut('editor.closeTab'),
                    action: () => closeTabCommand?.action(),
                },
                {
                    id: 'edit.commandPalette',
                    label: commandPaletteCommand?.label || 'Command Palette',
                    shortcut: getShortcut('view.commandPalette'),
                    action: () => commandPaletteCommand?.action(),
                },
                {
                    id: 'edit.formatQuery',
                    label: formatQueryCommand?.label || 'Format Query',
                    shortcut: getShortcut('editor.formatQuery'),
                    action: () => formatQueryCommand?.action(),
                },
            ],
        },
        {
            id: 'view',
            title: 'View',
            items: [
                {
                    id: 'view.settings',
                    label: openSettingsCommand?.label || 'Settings',
                    shortcut: getShortcut('view.openSettings'),
                    action: () => openSettingsCommand?.action(),
                },
                {
                    id: 'view.shortcuts',
                    label: openShortcutsCommand?.label || 'Keyboard Shortcuts',
                    shortcut: getShortcut('view.openShortcuts'),
                    action: () => openShortcutsCommand?.action(),
                },
                {
                    id: 'view.sidebar',
                    label: toggleSidebarCommand?.label || 'Toggle Sidebar',
                    shortcut: getShortcut('layout.toggleSidebar'),
                    action: () => toggleSidebarCommand?.action(),
                },
                {
                    id: 'view.resultPanel',
                    label: toggleResultPanelCommand?.label || 'Toggle Result Panel',
                    shortcut: getShortcut('layout.toggleResultPanel'),
                    disabled: !isQueryTab,
                    action: () => toggleResultPanelCommand?.action(),
                },
                {
                    id: 'view.rightSidebar',
                    label: toggleRightSidebarCommand?.label || 'Toggle Right Sidebar',
                    shortcut: getShortcut('layout.toggleRightSidebar'),
                    action: () => toggleRightSidebarCommand?.action(),
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
