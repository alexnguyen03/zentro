import React, { useState, useRef, useEffect } from 'react';
import { Toolbar } from './components/layout/Toolbar';
import { Sidebar } from './components/layout/Sidebar';
import { StatusBar } from './components/layout/StatusBar';
import { useConnectionStore } from './stores/connectionStore';
import { onConnectionChanged, onSchemaDatabases } from './lib/events';

function App() {
    const { setIsConnected, setActiveProfile, setDatabases } = useConnectionStore();
    const [sidebarWidth, setSidebarWidth] = useState(250);
    const isResizing = useRef(false);

    const startResizing = React.useCallback(() => {
        isResizing.current = true;
    }, []);

    const stopResizing = React.useCallback(() => {
        isResizing.current = false;
    }, []);

    const resize = React.useCallback(
        (mouseMoveEvent: MouseEvent) => {
            if (isResizing.current) {
                if (mouseMoveEvent.clientX > 150 && mouseMoveEvent.clientX < 800) {
                    setSidebarWidth(mouseMoveEvent.clientX);
                }
            }
        },
        []
    );

    // Wire global Wails events → stores. Placed at root so listeners
    // persist for the full app lifetime regardless of which child is mounted.
    useEffect(() => {
        const unsubConn = onConnectionChanged((data) => {
            if (data.status === 'connected' && data.profile) {
                setIsConnected(true);
                // Cast to any because Wails runtime serialises the Go struct as plain object
                setActiveProfile(data.profile as any);
            } else {
                setIsConnected(false);
                setActiveProfile(null);
                setDatabases([]);
            }
        });
        const unsubDbs = onSchemaDatabases((data) => {
            setDatabases(data.databases ?? []);
        });
        return () => {
            unsubConn();
            unsubDbs();
        };
    }, [setIsConnected, setActiveProfile, setDatabases]);

    useEffect(() => {
        window.addEventListener("mousemove", resize);
        window.addEventListener("mouseup", stopResizing);
        return () => {
            window.removeEventListener("mousemove", resize);
            window.removeEventListener("mouseup", stopResizing);
        };
    }, [resize, stopResizing]);

    return (
        <div className="app-container">
            <Toolbar />
            <div className="main-content">
                <div style={{ width: sidebarWidth, flexShrink: 0 }}>
                    <Sidebar />
                </div>
                <div
                    className="resizer"
                    onMouseDown={startResizing}
                />
                <div className="editor-area">
                    <div className="empty-state">
                        <h1>Zentro Engine</h1>
                        <p>Select a database and run queries.</p>
                    </div>
                </div>
            </div>
            <StatusBar />
        </div>
    );
}

export default App;
