import React, { useRef, useState } from 'react';
import { Plus, Play, Square, Save, Settings, ChevronDown, Search, RefreshCw, Lock } from 'lucide-react';
import { useConnectionStore } from '../../stores/connectionStore';
import { useEditorStore } from '../../stores/editorStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { ExecuteQuery, CancelQuery } from '../../../wailsjs/go/app/App';
import { ConnectionPicker } from './ConnectionPicker';

export const Toolbar: React.FC = () => {
    const { isConnected, activeProfile } = useConnectionStore();
    const { tabs, activeTabId, addTab } = useEditorStore();
    const { openModal } = useSettingsStore();

    const [pickerOpen, setPickerOpen] = useState(false);
    const breadcrumbRef = useRef<HTMLDivElement>(null);

    const activeTab = tabs.find(t => t.id === activeTabId);
    const isRunning = activeTab?.isRunning ?? false;

    const handleRun = async () => {
        if (!activeTab || !isConnected) return;
        try { await ExecuteQuery(activeTab.id, activeTab.query); } catch { /* event-driven */ }
    };

    const handleCancel = async () => {
        if (!activeTabId) return;
        try { await CancelQuery(activeTabId); } catch { /* swallow */ }
    };

    // Breadcrumb label: only connection name + db
    let breadcrumbLabel = 'No Connection';
    if (isConnected && activeProfile) {
        breadcrumbLabel = `${activeProfile.name}  ·  ${activeProfile.db_name}`;
    }

    return (
        <div className="toolbar tableplus-toolbar">
            <div className="toolbar-left">
                <button className="toolbar-btn icon-only" title="Toggle Safe Mode">
                    <Lock size={14} />
                </button>
                <button className="toolbar-btn icon-only" title="Refresh">
                    <RefreshCw size={14} />
                </button>

                <div className="toolbar-separator" />

                <button className="toolbar-btn icon-only" title="New Tab (Ctrl+T)" onClick={() => addTab()}>
                    <Plus size={16} />
                </button>
                <button
                    className="toolbar-btn icon-only"
                    disabled={!isConnected || !activeTab || isRunning}
                    title="Run Query (Ctrl+Enter)"
                    onClick={handleRun}
                >
                    <Play
                        size={16}
                        color={!isConnected || isRunning ? 'currentColor' : 'var(--success-color)'}
                        fill={!isConnected || isRunning ? 'none' : 'currentColor'}
                    />
                </button>
                <button
                    className="toolbar-btn icon-only"
                    disabled={!isRunning}
                    title="Cancel Execution"
                    onClick={handleCancel}
                >
                    <Square
                        size={16}
                        fill={isRunning ? 'currentColor' : 'none'}
                        color={isRunning ? 'var(--error-color)' : 'currentColor'}
                    />
                </button>
            </div>

            <div className="toolbar-center">
                <div ref={breadcrumbRef}>
                    <div
                        className={`connection-breadcrumb ${pickerOpen ? 'active' : ''}`}
                        onClick={() => setPickerOpen(prev => !prev)}
                    >
                        {breadcrumbLabel}
                        <ChevronDown size={14} className="breadcrumb-chevron" />
                    </div>
                </div>

                {pickerOpen && (
                    <ConnectionPicker
                        onClose={() => setPickerOpen(false)}
                        anchorRef={breadcrumbRef}
                    />
                )}
            </div>

            <div className="toolbar-right">
                <div className="toolbar-separator" />
                <button className="toolbar-btn icon-only" title="Search">
                    <Search size={14} />
                </button>
                <button className="toolbar-btn icon-only" title="Settings" onClick={openModal}>
                    <Settings size={14} />
                </button>
            </div>
        </div>
    );
};
