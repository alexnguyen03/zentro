import React, { useRef, useState } from 'react';
import { Plus, Play, Square, Settings, ChevronDown, Search, RefreshCw, Lock, Minus, X, PanelLeft, PanelBottom, PanelRight } from 'lucide-react';
import { useConnectionStore } from '../../stores/connectionStore';
import { useEditorStore } from '../../stores/editorStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { ExecuteQuery, CancelQuery } from '../../../wailsjs/go/app/App';
import { WindowMinimise, WindowToggleMaximise, Quit } from '../../../wailsjs/runtime/runtime';
import { ConnectionPicker } from './ConnectionPicker';
import { ShortcutHelp } from './ShortcutHelp';

export const Toolbar: React.FC = () => {
    const { isConnected, activeProfile } = useConnectionStore();
    const { groups, activeGroupId, addTab } = useEditorStore();
    const { openModal } = useSettingsStore();
    const { showSidebar, showResultPanel, showRightSidebar, toggleSidebar, toggleResultPanel, toggleRightSidebar } = useLayoutStore();

    const [pickerOpen, setPickerOpen] = useState(false);
    const [helpOpen, setHelpOpen] = useState(false);
    const breadcrumbRef = useRef<HTMLDivElement>(null);

    const activeGroup = groups.find(g => g.id === activeGroupId);
    const activeTab = activeGroup?.tabs.find(t => t.id === activeGroup.activeTabId);
    const activeTabId = activeGroup?.activeTabId;
    const isRunning = activeTab?.isRunning ?? false;

    const handleRun = async () => {
        if (!activeTab || !isConnected) return;
        try { await ExecuteQuery(activeTab.id, activeTab.query); } catch { /* event-driven */ }
    };

    const handleCancel = async () => {
        if (!activeTabId) return;
        try { await CancelQuery(activeTabId); } catch { /* swallow */ }
    };

    let breadcrumbLabel = 'No Connection';
    if (isConnected && activeProfile) {
        breadcrumbLabel = `${activeProfile.name}  ·  ${activeProfile.db_name} `;
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

            {/* Drag region — fills center, allows dragging the frameless window */}
            <div className="toolbar-drag-region">
                <div ref={breadcrumbRef}>
                    <div
                        className={`connection-breadcrumb ${pickerOpen ? 'active' : ''} ${isConnected ? 'connected' : 'disconnected'}`}
                        onClick={() => setPickerOpen(prev => !prev)}
                        style={{ '--wails-draggable': 'no-drag' } as React.CSSProperties}
                    >
                        <div className="connection-status-dot" />
                        <span className="connection-label">{breadcrumbLabel}</span>
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
                <button className="toolbar-btn icon-only" title="Keyboard Shortcuts" onClick={() => setHelpOpen(true)}>
                    <span style={{ fontSize: 13, fontWeight: 'bold' }}>?</span>
                </button>
                <button className="toolbar-btn icon-only" title="Search">
                    <Search size={14} />
                </button>
                <button className="toolbar-btn icon-only" title="Settings" onClick={openModal}>
                    <Settings size={14} />
                </button>

                <div className="toolbar-separator" />

                {/* Layout Toggles */}
                <button
                    className={`toolbar-btn icon-only ${showSidebar ? 'active' : ''}`}
                    title="Toggle Sidebar (Ctrl+B)"
                    onClick={toggleSidebar}
                >
                    <PanelLeft size={14} />
                </button>
                <button
                    className={`toolbar-btn icon-only ${showResultPanel ? 'active' : ''}`}
                    title="Toggle Result Panel (Ctrl+J)"
                    onClick={toggleResultPanel}
                >
                    <PanelBottom size={14} />
                </button>
                <button
                    className={`toolbar-btn icon-only ${showRightSidebar ? 'active' : ''}`}
                    title="Toggle Right Sidebar (Ctrl+Alt+B)"
                    onClick={toggleRightSidebar}
                >
                    <PanelRight size={14} />
                </button>

                <div className="toolbar-separator" />

                {/* Window controls */}
                <div className="window-controls">
                    <button className="wc-btn wc-minimize" title="Minimize" onClick={WindowMinimise}>
                        <Minus size={12} />
                    </button>
                    <button className="wc-btn wc-maximize" title="Maximize / Restore" onClick={WindowToggleMaximise}>
                        {/* Simple maximize icon via CSS box */}
                        <span className="wc-max-icon" />
                    </button>
                    <button className="wc-btn wc-close" title="Close" onClick={Quit}>
                        <X size={13} />
                    </button>
                </div>
            </div>

            <ShortcutHelp isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
        </div>
    );
};
