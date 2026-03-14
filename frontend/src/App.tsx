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
    onSchemaLoaded,
    onSchemaError,
    onQueryStarted,
    onQueryChunk,
    onQueryDone,
    type ConnectionChangedPayload,
} from './lib/events';
import { useToast } from './components/layout/Toast';
import { EventsOn, WindowReloadApp } from '../wailsjs/runtime/runtime';
import { ForceQuit, Connect } from '../wailsjs/go/app/App';
import { RowDetailSidebar } from './components/sidebar/RowDetailSidebar';

function App() {
    const { isConnected, setIsConnected, setActiveProfile, setDatabases, setConnectionStatus, activeProfile } = useConnectionStore();
    const { setTabRunning, addTab } = useEditorStore();
    const { initTab, appendRows, setDone, results } = useResultStore();
    const { setQueryStats } = useStatusStore();
    const { toast } = useToast();
    const { showSidebar, showRightSidebar, toggleSidebar, toggleResultPanel, toggleRightSidebar } = useLayoutStore();

    // ── Before-close guard ────────────────────────────────────────────────
    useEffect(() => {
        const off = EventsOn('app:before-close', () => {
            const running = useEditorStore.getState().groups.some(g => g.tabs.some(t => t.isRunning));
            if (!running) {
                ForceQuit();
                return;
            }
            const ok = window.confirm(
                'One or more queries are still running.\nStop them and close anyway?'
            );
            if (ok) {
                ForceQuit();
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

    // ── Global Wails event wiring ─────────────────────────────────────────
    useEffect(() => {
        // Load global settings on starup
        useSettingsStore.getState().load();

        const subs = [
            onConnectionChanged((data: ConnectionChangedPayload) => {
                console.log('[zentro] connection:changed', data);
                if (data.status === 'connected' && data.profile) {
                    setIsConnected(true);
                    setConnectionStatus('connected');
                    setActiveProfile(data.profile as any);
                    setDatabases(data.databases ?? []);
                } else if (data.status === 'connecting' && data.profile) {
                    setConnectionStatus('connecting');
                    setActiveProfile(data.profile as any);
                } else if (data.status === 'disconnected') {
                    setIsConnected(false);
                    setConnectionStatus('disconnected');
                    setActiveProfile(null);
                    setDatabases([]);
                } else if (data.status === 'error') {
                    if (data.profile) {
                        setActiveProfile(data.profile as any);
                    }
                    setConnectionStatus('error');
                    setIsConnected(false); // Ensure we show the empty state on physical connect failure
                    toast.error(`Connection failed or lost. Please check your settings.`);
                } else {
                    toast.error(`Connection failed`);
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
            onQueryStarted(({ tabID, query }) => {
                setTabRunning(tabID, true);
                initTab(tabID);
                // Automatically show result panel if hidden
                useLayoutStore.getState().setShowResultPanel(true);
                // Store the original query for tooltip/filter — skip filter-wrapped queries
                // so the base stays as the user's original query
                if (query && !query.includes('_zentro_filter')) {
                    useResultStore.getState().setLastExecutedQuery(tabID, query);
                }
            }),
            onQueryChunk(({ tabID, columns, rows, tableName, primaryKeys }) => {
                appendRows(tabID, columns, rows, tableName, primaryKeys);
            }),
            onQueryDone(({ tabID, affected, duration, isSelect, hasMore, error }) => {
                setTabRunning(tabID, false);
                setDone(tabID, affected, duration, isSelect, hasMore, error);
                if (error) {
                    toast.error(`Query failed: ${error}`);
                }
                // Update status bar row count from finished result
                const rowCount = isSelect
                    ? (results[tabID]?.rows.length ?? affected)
                    : affected;
                setQueryStats(Number(rowCount), duration);
            }),
        ];
        return () => subs.forEach(unsub => unsub());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        window.addEventListener('mousemove', resize);
        window.addEventListener('mouseup', stopResizing);
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [resize, stopResizing]);

    // ── Global Layout Shortcuts ───────────────────────────────────────────
    const chordRef = useRef<string | null>(null);
    const chordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const handleLayoutShortcuts = (e: KeyboardEvent) => {
            const mod = e.ctrlKey || e.metaKey;

            // Ctrl + Alt + B: Toggle Right Sidebar
            if (mod && e.altKey && e.key.toLowerCase() === 'b') {
                e.preventDefault();
                toggleRightSidebar();
                return;
            }

            // Ctrl + Shift + R: Reload App
            if (mod && e.shiftKey && e.key.toLowerCase() === 'r') {
                e.preventDefault();
                WindowReloadApp();
                return;
            }

            // Chords: Ctrl+K, Ctrl+B
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

            // Ctrl + ,: Open Settings
            if (mod && e.key === ',') {
                e.preventDefault();
                addTab({ type: 'settings', name: 'Settings' });
                return;
            }

            // Ctrl + B: Toggle Left Sidebar
            if (mod && !e.altKey && e.key.toLowerCase() === 'b') {
                e.preventDefault();
                toggleSidebar();
                return;
            }

            // Ctrl + J: Toggle Result Panel
            if (mod && !e.altKey && e.key.toLowerCase() === 'j') {
                e.preventDefault();
                toggleResultPanel();
                return;
            }
        };

        window.addEventListener('keydown', handleLayoutShortcuts);
        return () => window.removeEventListener('keydown', handleLayoutShortcuts);
    }, [toggleSidebar, toggleResultPanel, toggleRightSidebar, addTab]);

    return (
        <div className="flex flex-col h-full w-full">
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
                                <span className="text-3xl">🔌</span>
                                <h3 className="m-0 text-sm font-semibold text-text-primary">No active connection</h3>
                                <p className="m-0 text-xs">Select or add a connection from the sidebar to begin.</p>
                                {activeProfile && (
                                    <button 
                                        onClick={() => Connect(activeProfile.name)}
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
                {showRightSidebar && (
                    <RowDetailSidebar />
                )}
            </div>
            <StatusBar />
        </div>
    );
}

export default App;
