import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import App from './App';

type PersistStoreKey = 'editor' | 'layout' | 'sidebar';

const mocks = vi.hoisted(() => ({
    openProject: vi.fn(),
    resetRuntime: vi.fn(),
    disconnect: vi.fn(),
    toastError: vi.fn(),
}));

const hydration = vi.hoisted(() => {
    const flags: Record<PersistStoreKey, boolean> = {
        editor: true,
        layout: true,
        sidebar: true,
    };
    const listeners: Record<PersistStoreKey, Set<() => void>> = {
        editor: new Set(),
        layout: new Set(),
        sidebar: new Set(),
    };

    return {
        exposePersistApi: true,
        flags,
        listeners,
        reset() {
            this.exposePersistApi = true;
            this.flags.editor = true;
            this.flags.layout = true;
            this.flags.sidebar = true;
            this.listeners.editor.clear();
            this.listeners.layout.clear();
            this.listeners.sidebar.clear();
        },
        setHydrated(key: PersistStoreKey, hydrated: boolean) {
            this.flags[key] = hydrated;
            if (!hydrated) return;
            this.listeners[key].forEach((listener) => listener());
        },
        persistApiFor(key: PersistStoreKey) {
            if (!this.exposePersistApi) return undefined;
            return {
                hasHydrated: () => this.flags[key],
                onFinishHydration: (listener: () => void) => {
                    this.listeners[key].add(listener);
                    return () => {
                        this.listeners[key].delete(listener);
                    };
                },
            };
        },
    };
});

const projectState = {
    activeProject: null as { id: string } | null,
    hasBootstrapped: true,
    recentProjectIds: [] as string[],
    error: null as string | null,
    projects: [
        { id: 'old-1', updated_at: '2026-01-01T00:00:00Z' },
        { id: 'recent-1', updated_at: '2026-02-01T00:00:00Z' },
    ],
    openProject: mocks.openProject,
};

const layoutState = {
    showSidebar: false,
    showRightSidebar: false,
    showCommandPalette: false,
};

const useEditorStoreMock = vi.hoisted(() => {
    const store = (() => ({})) as unknown as {
        persist?: {
            hasHydrated?: () => boolean;
            onFinishHydration?: (listener: () => void) => () => void;
        };
    };
    Object.defineProperty(store, 'persist', {
        get: () => hydration.persistApiFor('editor'),
    });
    return store;
});

const useLayoutStoreMock = vi.hoisted(() => {
    const store = ((selector?: (state: typeof layoutState) => unknown) => (
        selector ? selector(layoutState) : layoutState
    )) as unknown as {
        (selector?: (state: typeof layoutState) => unknown): unknown;
        persist?: {
            hasHydrated?: () => boolean;
            onFinishHydration?: (listener: () => void) => () => void;
        };
    };
    Object.defineProperty(store, 'persist', {
        get: () => hydration.persistApiFor('layout'),
    });
    return store;
});

const useSidebarUiStoreMock = vi.hoisted(() => {
    const store = (() => ({})) as unknown as {
        persist?: {
            hasHydrated?: () => boolean;
            onFinishHydration?: (listener: () => void) => () => void;
        };
    };
    Object.defineProperty(store, 'persist', {
        get: () => hydration.persistApiFor('sidebar'),
    });
    return store;
});

vi.mock('./stores/projectStore', () => ({
    useProjectStore: (selector: (state: typeof projectState) => unknown) => selector(projectState),
}));

vi.mock('./stores/editorStore', () => ({
    useEditorStore: useEditorStoreMock,
}));

vi.mock('./stores/sidebarUiStore', () => ({
    useSidebarUiStore: useSidebarUiStoreMock,
}));

vi.mock('./stores/connectionStore', () => ({
    useConnectionStore: (selector?: (state: { isConnected: boolean; resetRuntime: () => void }) => unknown) => {
        const state = { isConnected: false, resetRuntime: mocks.resetRuntime };
        return selector ? selector(state) : state;
    },
}));

vi.mock('./stores/layoutStore', () => ({
    useLayoutStore: useLayoutStoreMock,
}));

vi.mock('./components/layout/Toast', () => ({
    useToast: () => ({
        toast: {
            success: vi.fn(),
            error: mocks.toastError,
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
    ProjectHub: () => (
        <div>
            <div data-testid="project-hub">Project Hub</div>
        </div>
    ),
}));

vi.mock('./features/shortcuts/useGlobalShortcuts', () => ({ useGlobalShortcuts: () => undefined }));
vi.mock('./features/app-runtime/useAppEventBridge', () => ({ useAppEventBridge: () => undefined }));
vi.mock('./features/app-runtime/useBeforeCloseGuard', () => ({ useBeforeCloseGuard: () => undefined }));
vi.mock('./features/editor/useQueryTabAutosave', () => ({ useQueryTabAutosave: () => undefined }));
vi.mock('./features/project/useProjectLifecycle', () => ({
    useProjectLifecycle: () => undefined,
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

describe('App startup auto-open behavior', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        hydration.reset();
        projectState.activeProject = null;
        projectState.hasBootstrapped = true;
        projectState.recentProjectIds = [];
        projectState.error = null;
        projectState.projects = [
            { id: 'old-1', updated_at: '2026-01-01T00:00:00Z' },
            { id: 'recent-1', updated_at: '2026-02-01T00:00:00Z' },
        ];
        mocks.disconnect.mockResolvedValue(undefined);
        mocks.openProject.mockResolvedValue({ id: 'recent-1' });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('shows startup loading while project bootstrap has not finished', async () => {
        projectState.hasBootstrapped = false;
        render(<App />);

        expect(screen.getByTestId('startup-loading')).toBeInTheDocument();
        expect(screen.queryByTestId('project-hub')).not.toBeInTheDocument();
        await waitFor(() => {
            expect(mocks.openProject).not.toHaveBeenCalled();
        });
    });

    it('auto-opens the most recently opened project when available', async () => {
        projectState.recentProjectIds = ['recent-1'];
        render(<App />);

        await waitFor(() => {
            expect(mocks.openProject).toHaveBeenCalledWith('recent-1');
        });
        expect(mocks.disconnect).toHaveBeenCalled();
        expect(mocks.resetRuntime).toHaveBeenCalled();
    });

    it('falls back to the latest updated project when no recent project exists', async () => {
        projectState.recentProjectIds = [];
        render(<App />);

        await waitFor(() => {
            expect(mocks.openProject).toHaveBeenCalledWith('recent-1');
        });
    });

    it('shows ProjectHub and error toast when auto-open returns null', async () => {
        projectState.recentProjectIds = ['recent-1'];
        projectState.error = 'Backend rejected project open';
        mocks.openProject.mockResolvedValue(null);
        render(<App />);

        await waitFor(() => {
            expect(screen.getByTestId('project-hub')).toBeInTheDocument();
        });
        expect(mocks.toastError).toHaveBeenCalledWith('Backend rejected project open');
    });

    it('shows ProjectHub when there are no projects to auto-open', async () => {
        projectState.recentProjectIds = [];
        projectState.projects = [];
        render(<App />);

        await waitFor(() => {
            expect(screen.getByTestId('project-hub')).toBeInTheDocument();
        });
        expect(mocks.openProject).not.toHaveBeenCalled();
    });

    it('attempts startup auto-open only once across rerenders', async () => {
        projectState.recentProjectIds = ['recent-1'];
        const { rerender } = render(<App />);
        rerender(<App />);
        await waitFor(() => {
            expect(mocks.openProject).toHaveBeenCalledTimes(1);
        });
    });

    it('keeps loading after core startup until persisted stores are hydrated', async () => {
        projectState.activeProject = { id: 'active-1' };
        hydration.setHydrated('editor', false);
        hydration.setHydrated('layout', false);
        hydration.setHydrated('sidebar', false);

        render(<App />);
        expect(screen.getByTestId('startup-loading')).toBeInTheDocument();
        expect(screen.getByText('Restoring your workspace state...')).toBeInTheDocument();
        expect(screen.queryByText('toolbar')).not.toBeInTheDocument();
    });

    it('renders app when persisted stores finish hydration before timeout', async () => {
        projectState.activeProject = { id: 'active-1' };
        hydration.setHydrated('editor', false);
        hydration.setHydrated('layout', false);
        hydration.setHydrated('sidebar', false);

        render(<App />);
        expect(screen.getByTestId('startup-loading')).toBeInTheDocument();

        await act(async () => {
            hydration.setHydrated('editor', true);
            hydration.setHydrated('layout', true);
            hydration.setHydrated('sidebar', true);
        });

        await waitFor(() => {
            expect(screen.getByText('toolbar')).toBeInTheDocument();
        });
    });

    it('falls back after 2 seconds when persisted hydration does not finish', async () => {
        vi.useFakeTimers();
        projectState.activeProject = { id: 'active-1' };
        hydration.setHydrated('editor', false);
        hydration.setHydrated('layout', false);
        hydration.setHydrated('sidebar', false);

        render(<App />);
        expect(screen.getByTestId('startup-loading')).toBeInTheDocument();

        act(() => {
            vi.advanceTimersByTime(2000);
        });

        await act(async () => {
            await Promise.resolve();
        });
        expect(screen.getByText('toolbar')).toBeInTheDocument();
    });

    it('does not block app when persist api is unavailable in runtime', async () => {
        projectState.activeProject = { id: 'active-1' };
        hydration.exposePersistApi = false;

        render(<App />);

        await waitFor(() => {
            expect(screen.getByText('toolbar')).toBeInTheDocument();
        });
        const loading = screen.getByTestId('startup-loading');
        expect(loading.className).toContain('opacity-0');
        expect(loading.className).toContain('pointer-events-none');
    });
});
