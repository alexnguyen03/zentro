import React, { useEffect, useState } from 'react';
import { Toolbar } from './components/layout/Toolbar';
import { Sidebar } from './components/layout/Sidebar';
import { StatusBar } from './components/layout/StatusBar';
import { QueryTabs } from './features/editor/QueryTabs';
import { useConnectionStore } from './stores/connectionStore';
import { useLayoutStore } from './stores/layoutStore';
import { useProjectStore } from './stores/projectStore';
import { useEnvironmentStore } from './stores/environmentStore';
import { useEditorStore } from './stores/editorStore';
import { useSidebarUiStore } from './stores/sidebarUiStore';
import { useToast } from './components/layout/Toast';
import { SecondarySidebar } from './components/sidebar/SecondarySidebar';
import { CommandPalette } from './components/layout/CommandPalette';
import { ContextSearchDialog } from './components/layout/ContextSearchDialog';
import { QueryCompareModal } from './components/editor/QueryCompareModal';
import { ProjectHub } from './components/layout/ProjectHub';
import { ConfirmationModal } from './components/ui/ConfirmationModal';
import { DOM_EVENT, type ProjectHubLaunchIntent } from './lib/constants';
import { emitCommand, onCommand } from './lib/commandBus';
import { Disconnect } from './services/connectionService';
import { Button, Spinner } from './components/ui';
import { useGlobalShortcuts } from './features/shortcuts/useGlobalShortcuts';
import { useAppEventBridge } from './features/app-runtime/useAppEventBridge';
import { useBeforeCloseGuard } from './features/app-runtime/useBeforeCloseGuard';
import { useSidebarResize, useProjectLifecycle } from './features/project/useProjectLifecycle';
import { usePluginCommandBridge } from './features/plugin/usePluginCommandBridge';
import { forceQuitWithAutosave } from './features/app-runtime/forceQuitWithAutosave';
import { useQueryTabAutosave } from './features/editor/useQueryTabAutosave';
import { useAppZoom } from './features/app-runtime/useAppZoom';

const STARTUP_LOADING_FADE_MS = 480;

interface PersistApi {
    hasHydrated?: () => boolean;
    onFinishHydration?: (listener: () => void) => (() => void) | void;
}

interface PersistEnabledStore {
    persist?: PersistApi;
}

function readPersistApi(store: unknown): PersistApi | null {
    const candidate = (store as PersistEnabledStore | undefined)?.persist;
    return candidate || null;
}

function isPersistStoreReady(store: unknown): boolean {
    const persistApi = readPersistApi(store);
    if (!persistApi || typeof persistApi.hasHydrated !== 'function') {
        return true;
    }
    return Boolean(persistApi.hasHydrated());
}

function App() {
    const startupAutoOpenAttemptedRef = React.useRef(false);
    const persistedStateGateDoneRef = React.useRef(false);
    const { isConnected } = useConnectionStore();
    const resetRuntime = useConnectionStore((state) => state.resetRuntime);
    const activeProject = useProjectStore((state) => state.activeProject);
    const projects = useProjectStore((state) => state.projects);
    const recentProjectIds = useProjectStore((state) => state.recentProjectIds);
    const hasBootstrapped = useProjectStore((state) => state.hasBootstrapped);
    const projectStoreError = useProjectStore((state) => state.error);
    const openProject = useProjectStore((state) => state.openProject);
    const activeEnvironmentKey = useEnvironmentStore((state) => state.activeEnvironmentKey);
    const { toast } = useToast();
    const toastError = toast.error;
    const { showSidebar, showRightSidebar, showCommandPalette } = useLayoutStore();

    const [showForceQuitConfirm, setShowForceQuitConfirm] = useState(false);
    const [showCompareModal, setShowCompareModal] = useState(false);
    const [showProjectHub, setShowProjectHub] = useState(false);
    const [projectHubLaunchIntent, setProjectHubLaunchIntent] = useState<ProjectHubLaunchIntent | undefined>(undefined);
    const [showContextSearch, setShowContextSearch] = useState(false);
    const [startupPhase, setStartupPhase] = useState<'bootstrapping' | 'autoOpening' | 'hydratingAppState' | 'ready'>('bootstrapping');
    const [startupLoadingMounted, setStartupLoadingMounted] = useState(true);
    const [startupLoadingVisible, setStartupLoadingVisible] = useState(true);

    const { sidebarWidth, startResizing } = useSidebarResize();

    useBeforeCloseGuard(() => setShowForceQuitConfirm(true));
    useProjectLifecycle();
    useAppEventBridge(toast);
    useGlobalShortcuts(toast);
    usePluginCommandBridge();
    useQueryTabAutosave();
    useAppZoom();

    useEffect(() => {
        const off = onCommand(DOM_EVENT.OPEN_QUERY_COMPARE, () => setShowCompareModal(true));
        return off;
    }, []);

    useEffect(() => {
        const off = onCommand(DOM_EVENT.OPEN_PROJECT_HUB, (intent) => {
            setProjectHubLaunchIntent(intent);
            setShowProjectHub(true);
        });
        return off;
    }, []);

    useEffect(() => {
        const off = onCommand(DOM_EVENT.OPEN_ENVIRONMENT_SWITCHER, () => {
            if (!activeProject?.id) {
                setProjectHubLaunchIntent(undefined);
                setShowProjectHub(true);
                return;
            }
            setProjectHubLaunchIntent({
                surface: 'wizard',
                wizardMode: 'edit',
                launchContext: 'env-config',
                projectId: activeProject.id,
                initialEnvironmentKey: activeEnvironmentKey || activeProject.default_environment_key,
            });
            setShowProjectHub(true);
        });
        return off;
    }, [activeEnvironmentKey, activeProject?.default_environment_key, activeProject?.id]);

    useEffect(() => {
        const off = onCommand(DOM_EVENT.OPEN_CONTEXT_SEARCH, () => setShowContextSearch(true));
        return off;
    }, []);

    useEffect(() => {
        if (!hasBootstrapped) {
            setStartupPhase('bootstrapping');
            startupAutoOpenAttemptedRef.current = false;
            persistedStateGateDoneRef.current = false;
            return;
        }

        if (activeProject?.id) {
            setStartupPhase(persistedStateGateDoneRef.current ? 'ready' : 'hydratingAppState');
            return;
        }

        if (startupAutoOpenAttemptedRef.current) {
            setStartupPhase('ready');
            return;
        }

        startupAutoOpenAttemptedRef.current = true;

        const recentProjectId = recentProjectIds[0];
        const latestUpdatedProjectId = [...projects]
            .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))[0]?.id;
        const targetProjectId = recentProjectId || latestUpdatedProjectId;

        if (!targetProjectId) {
            setStartupPhase('ready');
            return;
        }

        setStartupPhase('autoOpening');
        let cancelled = false;

        const tryAutoOpen = async () => {
            try {
                try { await Disconnect(); } catch { /* ignore */ }
                const project = await openProject(targetProjectId);
                resetRuntime();

                if (cancelled) return;
                if (!project) {
                    toastError(projectStoreError || 'Could not auto-open the last project. Please choose one manually.');
                }
            } catch (error) {
                resetRuntime();
                if (cancelled) return;
                const message = projectStoreError || (error instanceof Error ? error.message : String(error));
                toastError(`Could not auto-open the last project: ${message}`);
            } finally {
                if (!cancelled) {
                    setStartupPhase('ready');
                }
            }
        };

        void tryAutoOpen();
        return () => {
            cancelled = true;
        };
    }, [activeProject?.id, hasBootstrapped, openProject, projectStoreError, projects, recentProjectIds, resetRuntime, toastError]);

    useEffect(() => {
        if (!activeProject?.id) return;
        if (startupPhase === 'bootstrapping' || startupPhase === 'autoOpening') return;

        if (persistedStateGateDoneRef.current) {
            setStartupPhase('ready');
            return;
        }

        const persistStores: unknown[] = [useEditorStore, useLayoutStore, useSidebarUiStore];
        const allStoresReady = () => persistStores.every((store) => isPersistStoreReady(store));

        if (allStoresReady()) {
            persistedStateGateDoneRef.current = true;
            setStartupPhase('ready');
            return;
        }

        setStartupPhase('hydratingAppState');

        let cancelled = false;
        const finishGate = () => {
            if (cancelled || persistedStateGateDoneRef.current) return;
            persistedStateGateDoneRef.current = true;
            setStartupPhase('ready');
        };

        const unsubscribers = persistStores.map((store) => {
            const persistApi = readPersistApi(store);
            if (!persistApi || typeof persistApi.onFinishHydration !== 'function') return () => {};
            const unsubscribe = persistApi.onFinishHydration(() => {
                if (allStoresReady()) finishGate();
            });
            return typeof unsubscribe === 'function' ? unsubscribe : () => {};
        });

        const timeoutId = window.setTimeout(() => {
            finishGate();
        }, 2000);

        return () => {
            cancelled = true;
            window.clearTimeout(timeoutId);
            unsubscribers.forEach((unsubscribe) => unsubscribe());
        };
    }, [activeProject?.id, startupPhase]);

    const shouldBlockStartup = startupPhase !== 'ready';

    useEffect(() => {
        if (shouldBlockStartup) {
            setStartupLoadingMounted(true);
            const rafId = window.requestAnimationFrame(() => {
                setStartupLoadingVisible(true);
            });
            return () => {
                window.cancelAnimationFrame(rafId);
            };
        }

        setStartupLoadingVisible(false);
        const timeoutId = window.setTimeout(() => {
            setStartupLoadingMounted(false);
        }, STARTUP_LOADING_FADE_MS);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [shouldBlockStartup]);

    if (!activeProject) {
        return (
            <>
                <div className="h-full w-full bg-background">
                    {startupPhase === 'ready' && <ProjectHub overlay startupMode />}
                </div>
                {startupLoadingMounted && (
                    <div
                        className={`fixed inset-0 z-[9999] flex h-full w-full flex-col items-center justify-center gap-3 bg-background ${startupLoadingVisible ? 'opacity-100 animate-[startup-loading-fade-in_480ms_linear_forwards]' : 'pointer-events-none opacity-0 animate-[startup-loading-fade-out_480ms_linear_forwards]'}`}
                        data-testid="startup-loading"
                    >
                        <Spinner size={24} />
                        <div className="text-small text-muted-foreground">Preparing your workspace...</div>
                    </div>
                )}
            </>
        );
    }

    return (
        <>
            <div className="h-full w-full bg-background">
                {startupPhase === 'ready' && (
                    <div className="flex flex-col h-full w-full">
                        {showCommandPalette && <CommandPalette />}
                        {showContextSearch && <ContextSearchDialog onClose={() => setShowContextSearch(false)} />}
                        {showCompareModal && <QueryCompareModal onClose={() => setShowCompareModal(false)} />}
                        {showProjectHub && (
                            <ProjectHub
                                overlay
                                launchIntent={projectHubLaunchIntent}
                                onClose={() => {
                                    setShowProjectHub(false);
                                    setProjectHubLaunchIntent(undefined);
                                }}
                            />
                        )}
                        <ConfirmationModal
                            isOpen={showForceQuitConfirm}
                            onClose={() => setShowForceQuitConfirm(false)}
                            onConfirm={() => {
                                setShowForceQuitConfirm(false);
                                forceQuitWithAutosave().catch(() => {});
                            }}
                            title="Force Close Application"
                            message="One or more queries are still running."
                            description="Close now and stop all active queries?"
                            confirmLabel="Force Close"
                            variant="destructive"
                        />
                        <Toolbar />
                        <div className="flex flex-1 overflow-hidden">
                            {showSidebar && (
                                <>
                                    <div style={{ width: sidebarWidth, flexShrink: 0 }}>
                                        <Sidebar />
                                    </div>
                                    <div className="resizer bg-card/10" onMouseDown={startResizing} />
                                </>
                            )}
                            <div className="flex flex-1 flex-col overflow-hidden">
                                <div className="flex-1 flex flex-col bg-background overflow-hidden">
                                    {!isConnected && activeProject && (
                                        <div className="flex items-center justify-between px-4 py-1.5 bg-muted border-b border-border text-label text-muted-foreground shrink-0">
                                            <span>No active connection - switch environment to connect.</span>
                                            <Button
                                                type="button"
                                                variant="link"
                                                size="sm"
                                                onClick={() => emitCommand(DOM_EVENT.OPEN_ENVIRONMENT_SWITCHER)}
                                                className="h-auto px-0 py-0 text-accent font-semibold"
                                            >
                                                Configure env
                                            </Button>
                                        </div>
                                    )}
                                    <QueryTabs />
                                </div>
                            </div>
                            {showRightSidebar && <SecondarySidebar />}
                        </div>
                        <StatusBar />
                    </div>
                )}
            </div>
            {startupLoadingMounted && (
                <div
                    className={`fixed inset-0 z-[9999] flex h-full w-full flex-col items-center justify-center gap-3 bg-background ${startupLoadingVisible ? 'opacity-100 animate-[startup-loading-fade-in_480ms_linear_forwards]' : 'pointer-events-none opacity-0 animate-[startup-loading-fade-out_480ms_linear_forwards]'}`}
                    data-testid="startup-loading"
                >
                    <Spinner size={24} />
                    <div className="text-small text-muted-foreground">
                        {startupPhase === 'hydratingAppState'
                            ? 'Restoring your workspace state...'
                            : 'Preparing your workspace...'}
                    </div>
                </div>
            )}
        </>
    );
}

export default App;
