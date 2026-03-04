import React from 'react';
import { Plus, Play, Square, Save, Settings } from 'lucide-react';
import { useConnectionStore } from '../../stores/connectionStore';
import { useEditorStore } from '../../stores/editorStore';
import { useResultStore } from '../../stores/resultStore';
import { ExecuteQuery, CancelQuery } from '../../../wailsjs/go/app/App';

export const Toolbar: React.FC = () => {
    const isConnected = useConnectionStore(s => s.isConnected);
    const { tabs, activeTabId, addTab } = useEditorStore();
    const { results } = useResultStore();

    const activeTab = tabs.find(t => t.id === activeTabId);
    const isRunning = activeTab?.isRunning ?? false;
    const isDone = activeTabId ? (results[activeTabId]?.isDone ?? true) : true;

    const handleRun = async () => {
        if (!activeTab || !isConnected) return;
        try { await ExecuteQuery(activeTab.id, activeTab.query); } catch { /* event-driven, ignore */ }
    };

    const handleCancel = async () => {
        if (!activeTabId) return;
        try { await CancelQuery(activeTabId); } catch { /* swallow */ }
    };

    return (
        <div className="toolbar">
            <button
                className="toolbar-btn"
                title="New Tab (Ctrl+T)"
                onClick={() => addTab()}
            >
                <Plus size={16} /> New Tab
            </button>

            <div className="toolbar-separator" />

            <button
                className="toolbar-btn"
                disabled={!isConnected || !activeTab || isRunning}
                title="Run Query (Ctrl+Enter)"
                onClick={handleRun}
            >
                <Play
                    size={16}
                    color={!isConnected || isRunning ? 'currentColor' : 'var(--success-color)'}
                />
                Run
            </button>

            <button
                className="toolbar-btn"
                disabled={!isRunning}
                title="Cancel Execution"
                onClick={handleCancel}
            >
                <Square
                    size={16}
                    color={isRunning ? 'var(--error-color)' : 'currentColor'}
                    fill={isRunning ? 'currentColor' : 'none'}
                />
                Cancel
            </button>

            <div style={{ flex: 1 }} />

            <button
                className="toolbar-btn"
                disabled={!isDone || !activeTab}
                title="Export CSV"
            >
                <Save size={16} /> Export
            </button>

            <button className="toolbar-btn" title="Settings">
                <Settings size={16} />
            </button>
        </div>
    );
};
