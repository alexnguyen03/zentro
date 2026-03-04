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
    onQueryStarted,
    onQueryChunk,
    onQueryDone,
} from './lib/events';

function App() {
    const { setIsConnected, setActiveProfile, setDatabases } = useConnectionStore();
    const { setTabRunning } = useEditorStore();
    const { initTab, appendRows, setDone, results } = useResultStore();
    const { setQueryStats } = useStatusStore();

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
            onConnectionChanged((data) => {
                console.log('[zentro] connection:changed', data);
                if (data.status === 'connected' && data.profile) {
                    setIsConnected(true);
                    setActiveProfile(data.profile as any);
                } else {
                    setIsConnected(false);
                    setActiveProfile(null);
                    setDatabases([]);
                }
            }),
            onSchemaDatabases((data) => {
                console.log('[zentro] schema:databases', data);
                setDatabases(data.databases ?? []);
            }),
            onQueryStarted(({ tabID }) => {
                setTabRunning(tabID, true);
                initTab(tabID);
            }),
            onQueryChunk(({ tabID, columns, rows }) => {
                appendRows(tabID, columns, rows);
            }),
            onQueryDone(({ tabID, affected, duration, isSelect, error }) => {
                setTabRunning(tabID, false);
                setDone(tabID, affected, duration, isSelect, error);
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
                        <QueryTabs />
                    </div>
                </div>
            </div>
            <StatusBar />
            <SettingsDialog />
        </div>
    );
}

export default App;
