import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Toolbar } from './Toolbar';
import { CONNECTION_STATUS, ENVIRONMENT_KEY, TAB_TYPE, TRANSACTION_STATUS } from '../../lib/constants';

const mocks = vi.hoisted(() => ({
    reconnect: vi.fn(),
    windowReload: vi.fn(),
    windowReloadApp: vi.fn(),
    browserOpenURL: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
}));

const connectionState = {
    activeProfile: null as any,
    connectionStatus: CONNECTION_STATUS.DISCONNECTED,
};

const projectState = {
    activeProject: { name: 'Demo Project', default_environment_key: ENVIRONMENT_KEY.LOCAL } as any,
    setProjectEnvironment: vi.fn(async () => true),
};

const environmentState = {
    activeEnvironmentKey: ENVIRONMENT_KEY.LOCAL,
    environments: [] as any[],
    setActiveEnvironment: vi.fn(),
};

const editorState = {
    groups: [{ id: 'group-1', activeTabId: 'tab-1', tabs: [{ id: 'tab-1', type: TAB_TYPE.QUERY }] }] as any[],
    activeGroupId: 'group-1',
    addTab: vi.fn(),
};

const layoutState = {
    showSidebar: true,
    showResultPanel: true,
    showRightSidebar: false,
    toggleSidebar: vi.fn(),
    toggleResultPanel: vi.fn(),
    toggleRightSidebar: vi.fn(),
    setShowCommandPalette: vi.fn(),
};

const statusState = {
    transactionStatus: TRANSACTION_STATUS.NONE,
};

const settingsState = {
    viewMode: false,
    save: vi.fn(async () => undefined),
};

const shortcutState = {
    bindings: {
        'app.reload': 'Ctrl+Shift+R',
        'editor.newTab': 'Ctrl+T',
        'editor.closeTab': 'Ctrl+W',
        'view.commandPalette': 'Ctrl+Shift+P',
        'editor.formatQuery': 'Ctrl+Shift+F',
        'view.openSettings': 'Ctrl+,',
        'view.openShortcuts': 'Ctrl+K Ctrl+B',
        'layout.toggleSidebar': 'Ctrl+B',
        'layout.toggleResultPanel': 'Ctrl+J',
        'layout.toggleRightSidebar': 'Ctrl+Alt+B',
    } as Record<string, string>,
};

const updateCheckState = {
    hasUpdate: false,
    updateInfo: null as any,
    dismiss: vi.fn(),
    isChecking: false,
    check: vi.fn(async () => null),
};

vi.mock('../../../wailsjs/go/app/App', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../wailsjs/go/app/App')>();
    return {
        ...actual,
        Reconnect: mocks.reconnect,
    };
});

vi.mock('../../../wailsjs/runtime/runtime', () => ({
    WindowMinimise: vi.fn(),
    WindowToggleMaximise: vi.fn(),
    Quit: vi.fn(),
    WindowReload: mocks.windowReload,
    WindowReloadApp: mocks.windowReloadApp,
    BrowserOpenURL: mocks.browserOpenURL,
}));

vi.mock('../../stores/connectionStore', () => ({
    useConnectionStore: () => connectionState,
}));

vi.mock('../../stores/projectStore', () => ({
    useProjectStore: (selector: any) => selector(projectState),
}));

vi.mock('../../stores/environmentStore', () => ({
    useEnvironmentStore: (selector: any) => selector(environmentState),
}));

vi.mock('../../stores/editorStore', () => ({
    useEditorStore: () => editorState,
}));

vi.mock('../../stores/layoutStore', () => ({
    useLayoutStore: () => layoutState,
}));

vi.mock('../../stores/statusStore', () => ({
    useStatusStore: (selector: any) => selector(statusState),
}));

vi.mock('../../stores/settingsStore', () => ({
    useSettingsStore: (selector: any) => selector(settingsState),
}));

vi.mock('../../stores/shortcutStore', () => ({
    useShortcutStore: (selector: any) => selector(shortcutState),
}));

vi.mock('../../hooks/useUpdateCheck', () => ({
    useUpdateCheck: () => updateCheckState,
}));

vi.mock('../../lib/projects', () => ({
    getEnvironmentMeta: () => ({
        label: 'Local',
        description: 'Local env',
        colorClass: 'border-success/30 text-success',
    }),
}));

vi.mock('./Toast', () => ({
    useToast: () => ({
        toast: {
            success: mocks.toastSuccess,
            error: mocks.toastError,
        },
    }),
}));

vi.mock('./AboutModal', () => ({
    AboutModal: ({ onClose }: { onClose: () => void }) => (
        <div data-testid="about-modal" onClick={onClose}>About Modal</div>
    ),
}));

vi.mock('./UpdateModal', () => ({
    UpdateModal: ({ onClose }: { onClose: () => void }) => (
        <div data-testid="update-modal" onClick={onClose}>Update Modal</div>
    ),
}));

vi.mock('./LicenseModal', () => ({
    LicenseModal: ({ onClose }: { onClose: () => void }) => (
        <div data-testid="license-modal" onClick={onClose}>License Modal</div>
    ),
}));

vi.mock('./EnvironmentSwitcherModal', () => ({
    EnvironmentSwitcherModal: ({ onClose }: { onClose: () => void }) => (
        <div data-testid="env-modal" onClick={onClose}>Env Modal</div>
    ),
}));

describe('Toolbar app menu', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        updateCheckState.hasUpdate = false;
        updateCheckState.updateInfo = null;
        updateCheckState.isChecking = false;
        updateCheckState.check = vi.fn(async () => null);
    });

    it('opens app menu when clicking the logo', () => {
        render(<Toolbar />);

        fireEvent.click(screen.getByTitle('Open app menu'));

        expect(screen.getByRole('button', { name: /^File$/ })).toBeInTheDocument();
        expect(screen.queryByText('Restart App')).not.toBeInTheDocument();
    });

    it('triggers full app reload when clicking Restart App', () => {
        render(<Toolbar />);

        fireEvent.click(screen.getByTitle('Open app menu'));
        fireEvent.mouseEnter(screen.getByRole('button', { name: /^File$/ }));
        fireEvent.click(screen.getByRole('button', { name: /^File$/ }));
        fireEvent.click(screen.getByText('Restart App'));

        expect(mocks.windowReload).toHaveBeenCalledTimes(1);
    });

    it('opens License modal from Help menu', async () => {
        render(<Toolbar />);

        fireEvent.click(screen.getByTitle('Open app menu'));
        fireEvent.click(screen.getByRole('button', { name: /^Help$/ }));

        await waitFor(() => {
            expect(screen.getByText('License')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByRole('button', { name: /License/i }));

        expect(screen.getByTestId('license-modal')).toBeInTheDocument();
    });

    it('checks updates manually and shows latest-version toast when no update exists', async () => {
        updateCheckState.check = vi.fn(async () => null);
        render(<Toolbar />);

        fireEvent.click(screen.getByTitle('Open app menu'));
        fireEvent.click(screen.getByRole('button', { name: /^Help$/ }));
        await waitFor(() => {
            expect(screen.getByText('Check for Updates')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByRole('button', { name: /Check for Updates/i }));

        await waitFor(() => {
            expect(updateCheckState.check).toHaveBeenCalledWith(true);
        });
        expect(mocks.toastSuccess).toHaveBeenCalledWith('You are already on the latest version.');
    });
});
