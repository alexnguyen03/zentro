import React, { useRef, useState, useEffect } from 'react';
import { Plus, Play, Square, Settings, ChevronDown, Search, RefreshCw, Lock, Minus, X, PanelLeft, PanelBottom, PanelRight } from 'lucide-react';
import { useConnectionStore } from '../../stores/connectionStore';
import { useEditorStore } from '../../stores/editorStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { useResultStore } from '../../stores/resultStore';
import { ExecuteQuery, CancelQuery } from '../../../wailsjs/go/app/App';
import { WindowMinimise, WindowToggleMaximise, Quit } from '../../../wailsjs/runtime/runtime';
import { WorkspaceModal } from './WorkspaceModal';
import { cn } from '../../lib/cn';
import { Button, Divider } from '../ui';

export const Toolbar: React.FC = () => {
    const { isConnected, activeProfile, connectionStatus } = useConnectionStore();
    const { groups, activeGroupId, addTab } = useEditorStore();
    const { openModal } = useSettingsStore();
    const { showSidebar, showResultPanel, showRightSidebar, toggleSidebar, toggleResultPanel, toggleRightSidebar } = useLayoutStore();

    const [pickerOpen, setPickerOpen] = useState(false);

    const activeGroup = groups.find(g => g.id === activeGroupId);
    const activeTab = activeGroup?.tabs.find(t => t.id === activeGroup.activeTabId);
    const activeTabId = activeGroup?.activeTabId;
    const isRunning = activeTab?.isRunning ?? false;

    useEffect(() => {
        const handleKd = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'p') {
                e.preventDefault();
                setPickerOpen(true);
            }
        };
        window.addEventListener('keydown', handleKd);
        return () => window.removeEventListener('keydown', handleKd);
    }, []);

    const handleRun = async () => {
        if (!activeTab || !isConnected) return;
        useResultStore.getState().setFilterExpr(activeTab.id, '');
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
        <div className="h-12 flex items-center justify-between flex-shrink-0 px-3 gap-2 bg-bg-secondary border-b border-border">
            {/* Left */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
                <Button variant="ghost" size="icon" title="Toggle Safe Mode">
                    <Lock size={14} />
                </Button>
                <Button variant="ghost" size="icon" title="Refresh">
                    <RefreshCw size={14} />
                </Button>

                <Divider orientation="vertical" className="h-5" />

                <Button variant="ghost" size="icon" title="New Tab (Ctrl+T)" onClick={() => addTab()}>
                    <Plus size={16} />
                </Button>
                <Button
                    variant="ghost" size="icon"
                    disabled={!isConnected || !activeTab || isRunning}
                    title="Run Query (Ctrl+Enter)"
                    onClick={handleRun}
                >
                    <Play
                        size={16}
                        color={!isConnected || isRunning ? 'currentColor' : 'var(--success-color)'}
                        fill={!isConnected || isRunning ? 'none' : 'currentColor'}
                    />
                </Button>
                <Button
                    variant="ghost" size="icon"
                    disabled={!isRunning}
                    title="Cancel Execution"
                    onClick={handleCancel}
                >
                    <Square
                        size={16}
                        fill={isRunning ? 'currentColor' : 'none'}
                        color={isRunning ? 'var(--error-color)' : 'currentColor'}
                    />
                </Button>
            </div>

            {/* Center drag region */}
            <div
                className="flex-1 flex items-center justify-center h-full"
                style={{ '--wails-draggable': 'drag', cursor: 'default' } as React.CSSProperties}
            >
                <div
                    className="flex justify-center relative"
                    style={{ width: 'min(400px, 33vw)', ['--wails-draggable' as any]: 'no-drag' }}
                >
                    <div
                        className={cn(
                            'flex items-center gap-2 w-full px-3 py-1.5 rounded-full border text-xs font-medium text-text-secondary cursor-pointer select-none transition-all duration-200',
                            'bg-bg-tertiary border-border',
                            pickerOpen && 'border-success text-text-primary',
                            !pickerOpen && 'hover:text-text-primary hover:border-border',
                        )}
                        onClick={() => setPickerOpen(true)}
                    >
                        <span
                            className={cn(
                                'w-2 h-2 rounded-full flex-shrink-0 transition-all duration-300',
                                connectionStatus === 'connected' ? 'bg-success shadow-[0_0_6px_rgba(34,197,94,0.5)]' :
                                    connectionStatus === 'error' ? 'bg-red-500 shadow-[0_0_6px_rgba(255,95,87,0.5)] animate-pulse' :
                                        'bg-text-secondary'
                            )}
                            title={connectionStatus === 'error' ? 'Connection lost, reconnecting...' : ''}
                        />
                        <span className="flex-1 text-center truncate">{breadcrumbLabel}</span>
                        <ChevronDown
                            size={14}
                            className={cn('opacity-50 transition-transform duration-200', pickerOpen && 'rotate-180 opacity-100')}
                        />
                    </div>
                </div>

                {pickerOpen && (
                    <WorkspaceModal onClose={() => setPickerOpen(false)} />
                )}
            </div>

            {/* Right */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
                <Divider orientation="vertical" className="h-5" />
                <Button variant="ghost" size="icon" title="Search">
                    <Search size={14} />
                </Button>
                <Button variant="ghost" size="icon" title="Settings" onClick={openModal}>
                    <Settings size={14} />
                </Button>

                <Divider orientation="vertical" className="h-5" />

                {/* Layout toggles */}
                <Button
                    variant="ghost" size="icon"
                    className={cn(showSidebar && "bg-bg-tertiary border-border")}
                    title="Toggle Sidebar (Ctrl+B)"
                    onClick={toggleSidebar}
                >
                    <PanelLeft size={14} />
                </Button>
                <Button
                    variant="ghost" size="icon"
                    className={cn(showResultPanel && "bg-bg-tertiary border-border")}
                    title="Toggle Result Panel (Ctrl+J)"
                    onClick={toggleResultPanel}
                >
                    <PanelBottom size={14} />
                </Button>
                <Button
                    variant="ghost" size="icon"
                    className={cn(showRightSidebar && "bg-bg-tertiary border-border")}
                    title="Toggle Right Sidebar (Ctrl+Alt+B)"
                    onClick={toggleRightSidebar}
                >
                    <PanelRight size={14} />
                </Button>

                <Divider orientation="vertical" className="h-5" />

                {/* Window controls */}
                <div className="flex items-center gap-0.5 ml-0.5">
                    <button
                        className="w-7 h-7 flex items-center justify-center rounded-md bg-transparent border-none text-text-secondary cursor-pointer transition-all duration-150 hover:bg-[rgba(255,189,46,0.2)] hover:text-[#ffbd2e]"
                        title="Minimize"
                        onClick={WindowMinimise}
                    >
                        <Minus size={12} />
                    </button>
                    <button
                        className="w-7 h-7 flex items-center justify-center rounded-md bg-transparent border-none text-text-secondary cursor-pointer transition-all duration-150 hover:bg-[rgba(40,201,98,0.2)] hover:text-[#28c962]"
                        title="Maximize / Restore"
                        onClick={WindowToggleMaximise}
                    >
                        <span className="block w-2.5 h-2.5 border-[1.5px] border-current rounded-[1px]" />
                    </button>
                    <button
                        className="w-7 h-7 flex items-center justify-center rounded-md bg-transparent border-none text-text-secondary cursor-pointer transition-all duration-150 hover:bg-[rgba(255,95,87,0.2)] hover:text-[#ff5f57]"
                        title="Close"
                        onClick={Quit}
                    >
                        <X size={13} />
                    </button>
                </div>
            </div>
        </div>
    );
};
