import React, { useState, useRef, useEffect } from 'react';
import { Toolbar } from './components/layout/Toolbar';
import { Sidebar } from './components/layout/Sidebar';
import { StatusBar } from './components/layout/StatusBar';
import { EventsOn } from '../wailsjs/runtime/runtime';
import { useConnectionStore } from './stores/connectionStore';
import { useSchemaStore } from './stores/schemaStore';

function App() {
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
