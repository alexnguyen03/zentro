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
import { EventsOn, WindowReloadApp } from '../wailsjs/runtime/runtime';
import { ForceQuit, Connect, GetTransactionStatus } from '../wailsjs/go/app/App';
import { RowDetailSidebar } from './components/sidebar/RowDetailSidebar';
import { TAB_TYPE } from './lib/constants';
import { CommandPalette } from './components/layout/CommandPalette';

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
    const { addTab } = useEditorStore();
    const { setTransactionStatus } = useStatusStore();
    const { toast } = useToast();
    const { showSidebar, showRightSidebar, showCommandPalette, toggleSidebar, toggleResultPanel, toggleRightSidebar, setShowCommandPalette } = useLayoutStore();

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

        const subs = [
            onConnectionChanged((data: ConnectionChangedPayload) => {
                console.log('[zentro] connection:changed', data);
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
                console.log('[zentro] schema:databases', data);
                setDatabases(data.databases ?? []);
            }),
            onSchemaError((data) => {
                console.warn('[zentro] schema:error', data);
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
    }, [setActiveProfile, setConnectionStatus, setDatabases, setIsConnected, setTransactionStatus, toast]);

    useEffect(() => {
        window.addEventListener('mousemove', resize);
        window.addEventListener('mouseup', stopResizing);
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [resize, stopResizing]);

    const chordRef = useRef<string | null>(null);
    const chordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const handleLayoutShortcuts = (e: KeyboardEvent) => {
            const mod = e.ctrlKey || e.metaKey;

            if (mod && e.shiftKey && e.key.toLowerCase() === 'p') {
                e.preventDefault();
                setShowCommandPalette(true);
                return;
            }

            if (mod && e.altKey && e.key.toLowerCase() === 'b') {
                e.preventDefault();
                toggleRightSidebar();
                return;
            }

            if (mod && e.shiftKey && e.key.toLowerCase() === 'r') {
                e.preventDefault();
                WindowReloadApp();
                return;
            }

            if (mod && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                chordRef.current = 'k';
                if (chordTimerRef.current) {
                    clearTimeout(chordTimerRef.current);
                }
                chordTimerRef.current = setTimeout(() => {
                    chordRef.current = null;
                }, 1000);
                return;
            }

            if (chordRef.current === 'k') {
                if (mod && e.key.toLowerCase() === 'b') {
                    e.preventDefault();
                    addTab({ type: 'shortcuts', name: 'Keyboard Shortcuts' });
                }
                chordRef.current = null;
                if (chordTimerRef.current) {
                    clearTimeout(chordTimerRef.current);
                }
                return;
            }

            if (mod && e.key === ',') {
                e.preventDefault();
                addTab({ type: 'settings', name: 'Settings' });
                return;
            }

            if (mod && !e.altKey && e.key.toLowerCase() === 'b') {
                e.preventDefault();
                toggleSidebar();
                return;
            }

            if (mod && !e.altKey && e.key.toLowerCase() === 'j') {
                e.preventDefault();
                const editorState = useEditorStore.getState();
                const activeGroup = editorState.groups.find((g) => g.id === editorState.activeGroupId);
                const activeTab = activeGroup?.tabs.find((t) => t.id === activeGroup.activeTabId);

                if (activeTab?.type === TAB_TYPE.QUERY) {
                    toggleResultPanel();
                }
            }
        };

        window.addEventListener('keydown', handleLayoutShortcuts);
        return () => window.removeEventListener('keydown', handleLayoutShortcuts);
    }, [toggleSidebar, toggleResultPanel, toggleRightSidebar, addTab, setShowCommandPalette]);

    return (
        <div className="flex flex-col h-full w-full">
            {showCommandPalette && <CommandPalette />}
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
                                <h3 className="m-0 text-sm font-semibold text-text-primary">No active connection</h3>
                                <p className="m-0 text-xs">Select or add a connection from the sidebar to begin.</p>
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
                {showRightSidebar && <RowDetailSidebar />}
            </div>
            <StatusBar />
        </div>
    );
}

export default App;
