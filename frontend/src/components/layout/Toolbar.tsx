import React, { useState } from 'react';
import { Database, Play, Square, Save, Settings } from 'lucide-react';
import { useConnectionStore } from '../../stores/connectionStore';
import { useEditorStore } from '../../stores/editorStore';

export const Toolbar: React.FC = () => {
    const isConnected = useConnectionStore(state => state.isConnected);
    const tabs = useEditorStore(state => state.tabs);
    const activeTabId = useEditorStore(state => state.activeTabId);

    // Derived state for the active tab context
    const activeTab = tabs.find(t => t.id === activeTabId);
    const isRunning = activeTab?.isRunning || false;

    return (
        <div className="toolbar">
            <button className="toolbar-btn primary" title="New Connection">
                <Database size={16} /> Connect
            </button>

            <div style={{ width: '1px', height: '20px', background: 'var(--border-color)', margin: '0 8px' }}></div>

            <button
                className="toolbar-btn"
                disabled={!isConnected || isRunning}
                title="Run Query (Ctrl+Enter)"
            >
                <Play size={16} color={!isConnected || isRunning ? "gray" : "var(--success-color)"} /> Run
            </button>
            <button
                className="toolbar-btn"
                disabled={!isConnected || !isRunning}
                title="Cancel Execution"
            >
                <Square size={16} color={!isConnected || !isRunning ? "gray" : "var(--error-color)"} fill={!isConnected || !isRunning ? "none" : "currentColor"} /> Cancel
            </button>

            <div style={{ flex: 1 }}></div>

            <button className="toolbar-btn" disabled={!isConnected} title="Export CSV">
                <Save size={16} /> Export
            </button>
            <button className="toolbar-btn" title="Settings">
                <Settings size={16} />
            </button>
        </div>
    );
};
