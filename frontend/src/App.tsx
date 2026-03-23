import React, { useState, useRef, useEffect } from 'react';
import { Toolbar } from './components/layout/Toolbar';
import { Sidebar } from './components/layout/Sidebar';
import { StatusBar } from './components/layout/StatusBar';
import { QueryTabs } from './components/editor/QueryTabs';
import { useConnectionStore } from './stores/connectionStore';
import { useEditorStore } from './stores/editorStore';
import { useResultStore } from './stores/resultStore';
import { useStatusStore } from './stores/statusStore';
import { useSettingsStore } from './stores/settingsStore';
import { useLayoutStore } from './stores/layoutStore';
import { useProjectStore } from './stores/projectStore';
import { useEnvironmentStore } from './stores/environmentStore';
import { useWorkspaceStore, getWorkspaceEnvironmentKey } from './stores/workspaceStore';
import {
    onConnectionChanged,
    onSchemaDatabases,
    onSchemaError,
    onQueryStarted,
    onQueryChunk,
    onQueryDone,
    onTransactionStatus,
    type ConnectionChangedPayload,
    type QueryStartedPayload,
    type QueryChunkPayload,
    type QueryDonePayload,
} from './lib/events';
import { useToast } from './components/layout/Toast';
import { EventsOn } from '../wailsjs/runtime/runtime';
import { ForceQuit, Connect, GetTransactionStatus } from '../wailsjs/go/app/App';
import { SecondarySidebar } from './components/sidebar/SecondarySidebar';
import { CommandPalette } from './components/layout/CommandPalette';
import { QueryCompareModal } from './components/editor/QueryCompareModal';
import { ProjectHub } from './components/layout/ProjectHub';
import { eventToKeyToken, normalizeBinding, shortcutRegistry } from './lib/shortcutRegistry';
import { useShortcutStore } from './stores/shortcutStore';
import { DOM_EVENT } from './lib/constants';
import { appLogger } from './lib/logger';

function clearGeneratedResults(sourceTabID: string) {
    const resultState = useResultStore.getState();
    Object.keys(resultState.results).forEach((k) => {
        if (
            k !== sourceTabID &&
            (k.startsWith(`${sourceTabID}::result:`) || k.startsWith(`${sourceTabID}::explain:`))
        ) {
            resultState.clearResult(k);
        }
    });
}

function App() {
    const { isConnected, setIsConnected, setActiveProfile, setDatabases, setConnectionStatus, activeProfile } = useConnectionStore();
    const { setTransactionStatus } = useStatusStore();
    const bootstrapProjects = useProjectStore((state) => state.bootstrap);
    const activeProject = useProjectStore((state) => state.activeProject);
    const bootstrapEnvironment = useEnvironmentStore((state) => state.bootstrap);
    const clearEnvironment = useEnvironmentStore((state) => state.clear);
    const bootstrapWorkspaces = useWorkspaceStore((state) => state.bootstrap);
    const clearWorkspaces = useWorkspaceStore((state) => state.clear);
    const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);
    const workspaces = useWorkspaceStore((state) => state.workspaces);
    const switchEditorWorkspace = useEditorStore((state) => state.switchWorkspace);
    const switchResultWorkspace = useResultStore((state) => state.switchWorkspace);
    const { toast } = useToast();
    const { showSidebar, showRightSidebar, showCommandPalette } = useLayoutStore();
    const { bindings, chordStart, chordUntil, setChord } = useShortcutStore();

    useEffect(() => {
        const off = EventsOn('app:before-close', () => {
            const running = useEditorStore.getState().groups.some((g) => g.tabs.some((t) => t.isRunning));
            if (!running) {
                ForceQuit().catch(() => { });
                return;
            }
            const ok = window.confirm('One or more queries are still running.\nStop them and close anyway?');
            if (ok) {
                ForceQuit().catch(() => { });
            }
        });
        return () => { if (typeof off === 'function') off(); };
    }, []);

    const [sidebarWidth, setSidebarWidth] = useState(250);
    const isResizing = useRef(false);

    const startResizing = React.useCallback(() => { isResizing.current = true; }, []);
    const stopResizing = React.useCallback(() => { isResizing.current = false; }, []);

    const resize = React.useCallback((e: MouseEvent) => {
        if (isResizing.current && e.clientX > 150 && e.clientX < 800) {
            setSidebarWidth(e.clientX);
        }
    }, []);

    useEffect(() => {
        useSettingsStore.getState().load();
        bootstrapProjects().catch((error) => {
            appLogger.warn('project bootstrap failed', error);
        });

        const subs = [
            onConnectionChanged((data: ConnectionChangedPayload) => {
                appLogger.info('connection changed', data);
                if (data.status === 'connected' && data.profile) {
                    setIsConnected(true);
                    setConnectionStatus('connected');
                    setActiveProfile(data.profile as any);
                    setDatabases(data.databases ?? []);
                    GetTransactionStatus()
                        .then((status) => setTransactionStatus((status as any) || 'none'))
                        .catch(() => setTransactionStatus('none'));
                } else if (data.status === 'connecting' && data.profile) {
                    setConnectionStatus('connecting');
                    setActiveProfile(data.profile as any);
                } else if (data.status === 'disconnected') {
                    setIsConnected(false);
                    setConnectionStatus('disconnected');
                    setActiveProfile(null);
                    setDatabases([]);
                    setTransactionStatus('none');
                } else if (data.status === 'error') {
                    if (data.profile) {
                        setActiveProfile(data.profile as any);
                    }
                    setConnectionStatus('error');
                    setIsConnected(false);
                    setTransactionStatus('error', 'connection error');
                    toast.error('Connection failed or lost. Please check your settings.');
                } else {
                    toast.error('Connection failed');
                }
            }),
            onSchemaDatabases((data) => {
                appLogger.info('schema databases', data);
                setDatabases(data.databases ?? []);
            }),
            onSchemaError((data) => {
                appLogger.warn('schema error', data);
                toast.error(`Failed to load schema for ${data.dbName}: ${data.error}`);
            }),
            onQueryStarted((payload) => {
                if (payload.statementIndex === 0) {
                    clearGeneratedResults(payload.sourceTabID);
                }
                
                useEditorStore.getState().setTabRunning(payload.sourceTabID, true);
                useResultStore.getState().initTab(payload.tabID);
                useLayoutStore.getState().setShowResultPanel(true);

                const executedText = payload.statementText || payload.query;
                if (executedText && !executedText.includes('_zentro_filter')) {
                    useResultStore.getState().setLastExecutedQuery(payload.tabID, executedText);
                }
            }),
            onQueryChunk((payload) => {
                useResultStore.getState().appendRows(payload.tabID, payload.columns, payload.rows, payload.tableName, payload.primaryKeys);
            }),
            onQueryDone((payload) => {
                if (payload.statementCount <= 1 || payload.statementIndex === payload.statementCount - 1 || Boolean(payload.error)) {
                    useEditorStore.getState().setTabRunning(payload.sourceTabID, false);
                }
                useResultStore.getState().setDone(payload.tabID, payload.affected, payload.duration, payload.isSelect, payload.hasMore, payload.error);
                if (payload.error) {
                    toast.error(`Query failed: ${payload.error}`);
                }

                const currentResults = useResultStore.getState().results;
                const rowCount = payload.isSelect
                    ? (currentResults[payload.tabID]?.rows.length ?? payload.affected)
                    : payload.affected;
                useStatusStore.getState().setQueryStats(Number(rowCount), payload.duration);
            }),
            onTransactionStatus((payload) => {
                setTransactionStatus(payload.status, payload.error || null);
                if (payload.status === 'error' && payload.error) {
                    toast.error(`Transaction failed: ${payload.error}`);
                }
            }),
        ];

        return () => subs.forEach((unsub) => unsub());
    }, [bootstrapProjects, setActiveProfile, setConnectionStatus, setDatabases, setIsConnected, setTransactionStatus, toast]);

    useEffect(() => {
        window.addEventListener('mousemove', resize);
        window.addEventListener('mouseup', stopResizing);
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [resize, stopResizing]);

    useEffect(() => {
        if (!activeProject) {
            clearWorkspaces();
            clearEnvironment();
            switchEditorWorkspace(null);
            switchResultWorkspace(null);
            return;
        }

        bootstrapWorkspaces(activeProject);
    }, [activeProject, bootstrapWorkspaces, clearEnvironment, clearWorkspaces, switchEditorWorkspace, switchResultWorkspace]);

    useEffect(() => {
        if (!activeProject) return;

        const environmentKey = getWorkspaceEnvironmentKey(
            workspaces,
            activeWorkspaceId,
            activeProject.default_environment_key
        );

        bootstrapEnvironment(activeProject, environmentKey);
        switchEditorWorkspace(activeWorkspaceId);
        switchResultWorkspace(activeWorkspaceId);
    }, [
        activeProject,
        activeWorkspaceId,
        bootstrapEnvironment,
        switchEditorWorkspace,
        switchResultWorkspace,
        workspaces,
    ]);

    useEffect(() => {
        const isTypingTarget = (target: EventTarget | null) => {
            const el = target as HTMLElement | null;
            if (!el) return false;
            if (el.closest('.monaco-editor')) return false;
            return Boolean(el.closest('input, textarea, [contenteditable="true"]'));
        };

        const execute = (entry: (typeof shortcutRegistry)[number]) => {
            Promise.resolve(entry.action()).catch((err) => {
                appLogger.error(`shortcut ${entry.id} failed`, err);
                toast.error(`Shortcut failed: ${entry.label}`);
            });
        };

        const handler = (e: KeyboardEvent) => {
            if (isTypingTarget(e.target)) return;
            const token = eventToKeyToken(e);
            const now = Date.now();
            const inMonaco = Boolean((e.target as HTMLElement | null)?.closest('.monaco-editor'));

            // Ctrl+Enter is handled by Monaco editor action to avoid duplicate handling/newline side effects.
            if (inMonaco && token === 'ctrl+enter') {
                return;
            }

            for (const entry of shortcutRegistry) {
                const binding = normalizeBinding(bindings[entry.id] || entry.defaultBinding);
                const parts = binding.split(' ');
                if (parts.length === 2) {
                    if (token === parts[0]) {
                        e.preventDefault();
                        setChord(parts[0]);
                        return;
                    }
                    if (chordStart === parts[0] && now <= chordUntil && token === parts[1]) {
                        e.preventDefault();
                        setChord(null);
                        execute(entry);
                        return;
                    }
                    continue;
                }
                if (token === parts[0]) {
                    e.preventDefault();
                    execute(entry);
                    return;
                }
            }

            if (chordStart && now > chordUntil) {
                setChord(null);
            }
        };

        window.addEventListener('keydown', handler, true);
        return () => window.removeEventListener('keydown', handler, true);
    }, [bindings, chordStart, chordUntil, setChord, toast]);

    const [showCompareModal, setShowCompareModal] = useState(false);
    const [showProjectHub, setShowProjectHub] = useState(false);
    useEffect(() => {
        const open = () => setShowCompareModal(true);
        window.addEventListener(DOM_EVENT.OPEN_QUERY_COMPARE, open);
        return () => window.removeEventListener(DOM_EVENT.OPEN_QUERY_COMPARE, open);
    }, []);

    useEffect(() => {
        const open = () => setShowProjectHub(true);
        window.addEventListener(DOM_EVENT.OPEN_PROJECT_HUB, open);
        return () => window.removeEventListener(DOM_EVENT.OPEN_PROJECT_HUB, open);
    }, []);

    if (!activeProject) {
        return (
            <div className="h-full w-full bg-bg-primary">
                <ProjectHub />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full">
            {showCommandPalette && <CommandPalette />}
            {showCompareModal && <QueryCompareModal onClose={() => setShowCompareModal(false)} />}
            {showProjectHub && <ProjectHub overlay onClose={() => setShowProjectHub(false)} />}
            <Toolbar />
            <div className="flex flex-1 overflow-hidden">
                {showSidebar && (
                    <>
                        <div style={{ width: sidebarWidth, flexShrink: 0 }}>
                            <Sidebar />
                        </div>
                        <div className="resizer" onMouseDown={startResizing} />
                    </>
                )}
                <div className="flex flex-1 flex-col overflow-hidden">
                    <div className="flex-1 flex flex-col bg-bg-primary overflow-hidden">
                        {!isConnected ? (
                            <div className="flex flex-col items-center justify-center h-full gap-4 text-text-secondary">
                                <span className="text-3xl">Plug</span>
                                <h3 className="m-0 text-sm font-semibold text-text-primary">
                                    {activeProject ? 'No active connection' : 'No active project'}
                                </h3>
                                <p className="m-0 text-xs text-center max-w-[320px]">
                                    {activeProject
                                        ? `Project "${activeProject.name}" is loaded. Connect an environment from the sidebar to start working inside its workspace context.`
                                        : 'No project is currently loaded.'}
                                </p>
                                {activeProfile && (
                                    <button
                                        onClick={() => Connect(activeProfile.name).catch(() => { })}
                                        className="mt-2 px-4 py-2 bg-success text-white text-xs font-bold rounded-lg hover:bg-success/90 transition-all active:scale-95 shadow-lg shadow-success/20"
                                    >
                                        Reconnect to {activeProfile.name}
                                    </button>
                                )}
                            </div>
                        ) : (
                            <QueryTabs />
                        )}
                    </div>
                </div>
                {showRightSidebar && <SecondarySidebar />}
            </div>
            <StatusBar />
        </div>
    );
}

export default App;
