import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';

const mocks = vi.hoisted(() => ({
    openProject: vi.fn(),
    resetRuntime: vi.fn(),
    disconnect: vi.fn(),
}));

const projectState = {
    activeProject: null as { id: string } | null,
    projects: [
        { id: 'old-1', updated_at: '2026-01-01T00:00:00Z' },
        { id: 'recent-1', updated_at: '2026-02-01T00:00:00Z' },
    ],
    openProject: mocks.openProject,
};

vi.mock('./stores/projectStore', () => ({
    useProjectStore: (selector: (state: typeof projectState) => unknown) => selector(projectState),
}));

vi.mock('./stores/connectionStore', () => ({
    useConnectionStore: (selector?: (state: { isConnected: boolean; resetRuntime: () => void }) => unknown) => {
        const state = { isConnected: false, resetRuntime: mocks.resetRuntime };
        return selector ? selector(state) : state;
    },
}));

vi.mock('./stores/layoutStore', () => ({
    useLayoutStore: () => ({
        showSidebar: false,
        showRightSidebar: false,
        showCommandPalette: false,
    }),
}));

vi.mock('./components/layout/Toast', () => ({
    useToast: () => ({
        toast: {
            success: vi.fn(),
            error: vi.fn(),
        },
    }),
}));

vi.mock('./components/layout/Toolbar', () => ({ Toolbar: () => <div>toolbar</div> }));
vi.mock('./components/layout/Sidebar', () => ({ Sidebar: () => <div>sidebar</div> }));
vi.mock('./components/layout/StatusBar', () => ({ StatusBar: () => <div>status</div> }));
vi.mock('./components/editor/QueryTabs', () => ({ QueryTabs: () => <div>tabs</div> }));
vi.mock('./components/sidebar/SecondarySidebar', () => ({ SecondarySidebar: () => <div>secondary</div> }));
vi.mock('./components/layout/CommandPalette', () => ({ CommandPalette: () => <div>palette</div> }));
vi.mock('./components/layout/ContextSearchDialog', () => ({ ContextSearchDialog: () => <div>context-search</div> }));
vi.mock('./components/editor/QueryCompareModal', () => ({ QueryCompareModal: () => <div>compare</div> }));
vi.mock('./components/ui/ConfirmationModal', () => ({ ConfirmationModal: () => <div>confirm</div> }));

vi.mock('./components/layout/ProjectHub', () => ({
    ProjectHub: ({ onClose }: { onClose?: () => void }) => (
        <div>
            <button type="button" onClick={() => onClose?.()} data-testid="startup-close">Close startup</button>
        </div>
    ),
}));

vi.mock('./features/shortcuts/useGlobalShortcuts', () => ({ useGlobalShortcuts: () => undefined }));
vi.mock('./features/app-runtime/useAppEventBridge', () => ({ useAppEventBridge: () => undefined }));
vi.mock('./features/app-runtime/useBeforeCloseGuard', () => ({ useBeforeCloseGuard: () => undefined }));
vi.mock('./features/workspace/useWorkspaceLifecycle', () => ({
    useWorkspaceLifecycle: () => undefined,
    useSidebarResize: () => ({ sidebarWidth: 250, startResizing: vi.fn() }),
}));
vi.mock('./features/plugin/usePluginCommandBridge', () => ({ usePluginCommandBridge: () => undefined }));
vi.mock('./lib/commandBus', () => ({
    emitCommand: vi.fn(),
    onCommand: () => () => undefined,
}));
vi.mock('./services/projectService', () => ({
    ForceQuit: vi.fn(),
}));
vi.mock('./services/connectionService', () => ({
    Disconnect: mocks.disconnect,
}));

describe('App startup close behavior', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        projectState.activeProject = null;
        projectState.projects = [
            { id: 'old-1', updated_at: '2026-01-01T00:00:00Z' },
            { id: 'recent-1', updated_at: '2026-02-01T00:00:00Z' },
        ];
        mocks.disconnect.mockResolvedValue(undefined);
        mocks.openProject.mockResolvedValue({ id: 'recent-1' });
    });

    it('auto-opens the last updated project when closing startup modal', async () => {
        render(<App />);

        fireEvent.click(screen.getByTestId('startup-close'));

        await waitFor(() => {
            expect(mocks.openProject).toHaveBeenCalledWith('recent-1');
        });
        expect(mocks.disconnect).toHaveBeenCalled();
        expect(mocks.resetRuntime).toHaveBeenCalled();
    });

    it('does not open any project when project list is empty', async () => {
        projectState.projects = [];
        render(<App />);

        fireEvent.click(screen.getByTestId('startup-close'));

        await waitFor(() => {
            expect(mocks.openProject).not.toHaveBeenCalled();
        });
    });
});
