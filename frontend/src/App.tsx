import React, { useState, useRef, useEffect } from 'react';
import { Toolbar } from './components/layout/Toolbar';
import { Sidebar } from './components/layout/Sidebar';
import { StatusBar } from './components/layout/StatusBar';
import { SettingsDialog } from './components/layout/SettingsDialog';
import { QueryTabs } from './components/editor/QueryTabs';
import { useConnectionStore } from './stores/connectionStore';
import { useEditorStore } from './stores/editorStore';
import { useResultStore } from './stores/resultStore';
import { useStatusStore } from './stores/statusStore';
import { useSettingsStore } from './stores/settingsStore';
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
import { EventsOn } from '../wailsjs/runtime/runtime';
import { ForceQuit } from '../wailsjs/go/app/App';

function App() {
    const { isConnected, setIsConnected, setActiveProfile, setDatabases } = useConnectionStore();
    const { setTabRunning, addTab } = useEditorStore();
    const { initTab, appendRows, setDone, results } = useResultStore();
    const { setQueryStats } = useStatusStore();
    const { toast } = useToast();

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
            if (ok) ForceQuit();
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
                    setActiveProfile(data.profile as any);
                } else if (data.status === 'disconnected') {
                    setIsConnected(false);
                    setActiveProfile(null);
                    setDatabases([]);
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
            onQueryStarted(({ tabID }) => {
                setTabRunning(tabID, true);
                initTab(tabID);
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

    return (
        <div className="app-container">
            <div className="main-content">
                <div style={{ width: sidebarWidth, flexShrink: 0 }}>
                    <Sidebar />
                </div>
                <div className="resizer" onMouseDown={startResizing} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <Toolbar />
                    <div className="editor-area">
                        {!isConnected ? (
                            <div className="empty-state">
                                <span className="empty-icon">🔌</span>
                                <h3>No active connection</h3>
                                <p>Select or add a connection from the sidebar to begin.</p>
                            </div>
                        ) : (
                            <QueryTabs />
                        )}
                    </div>
                </div>
            </div>
            <StatusBar />
            <SettingsDialog />
        </div>
    );
}

export default App;
