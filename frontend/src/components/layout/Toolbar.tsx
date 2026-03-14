import React, { useRef, useState, useEffect } from 'react';
import { Plus, Play, Square, Settings, ChevronDown, Search, RefreshCw, Lock, Minus, X, PanelLeft, PanelBottom, PanelRight } from 'lucide-react';
import { useConnectionStore } from '../../stores/connectionStore';
import { useEditorStore } from '../../stores/editorStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { useResultStore } from '../../stores/resultStore';
import { ExecuteQuery, CancelQuery, Connect, Reconnect } from '../../../wailsjs/go/app/App';
import { WindowMinimise, WindowToggleMaximise, Quit } from '../../../wailsjs/runtime/runtime';
import { WorkspaceModal } from './WorkspaceModal';
import { getProvider } from '../../lib/providers';
import { cn } from '../../lib/cn';
import { Button, Divider } from '../ui';
import zentroLogo from '../../assets/images/main-logo.png';

export const Toolbar: React.FC = () => {
    const { isConnected, activeProfile, connectionStatus } = useConnectionStore();
    const { groups, activeGroupId, addTab } = useEditorStore();
    const { showSidebar, showResultPanel, showRightSidebar, toggleSidebar, toggleResultPanel, toggleRightSidebar, setShowCommandPalette } = useLayoutStore();

    const [pickerOpen, setPickerOpen] = useState(false);

    const activeGroup = groups.find(g => g.id === activeGroupId);
    const activeTab = activeGroup?.tabs.find(t => t.id === activeGroup.activeTabId);
    const activeTabId = activeGroup?.activeTabId;
    const isRunning = activeTab?.isRunning ?? false;
    const isQueryTab = activeTab?.type === 'query';

    useEffect(() => {
        const handleKd = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'c') {
                e.preventDefault();
                setPickerOpen(true);
            }
        };
        window.addEventListener('keydown', handleKd);
        return () => window.removeEventListener('keydown', handleKd);
    }, []);

    // Listen for command palette's "open-workspace-modal" event
    useEffect(() => {
        const handler = () => setPickerOpen(true);
        window.addEventListener('open-workspace-modal', handler);
        return () => window.removeEventListener('open-workspace-modal', handler);
    }, []);

    const handleRun = async () => {
        if (!activeTab || !isConnected) return;
        window.dispatchEvent(new CustomEvent('run-query-action', { detail: { tabId: activeTab.id } }));
    };

    const handleCancel = async () => {
        if (!activeTabId) return;
        try { await CancelQuery(activeTabId); } catch { /* swallow */ }
    };

    let breadcrumbLabel = 'No Connection';
    if (activeProfile) {
        breadcrumbLabel = `${activeProfile.name}  ·  ${activeProfile.db_name} `;
    }

    return (
        <div className="h-8 flex items-center justify-between flex-shrink-0 px-3 gap-2 bg-bg-secondary border-b border-border">
            {/* Left */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
                <div className="flex items-center justify-center w-6 h-6 mr-1" title="Zentro">
                    <img src={zentroLogo} alt="Zentro" className="w-5 h-5 object-contain" />
                </div>
                <Button variant="ghost" size="icon" title="Toggle Safe Mode">
                    <Lock size={14} />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    title="Reload Connection"
                    onClick={() => activeProfile && Reconnect()}
                    disabled={!activeProfile || connectionStatus === 'connecting'}
                >
                    <RefreshCw size={14} className={cn(connectionStatus === 'connecting' && "animate-spin")} />
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
                    className="flex justify-center relative h-10/12 my-1"
                    style={{ width: 'min(400px, 33vw)', ['--wails-draggable' as any]: 'no-drag' }}
                >
                    <div
                        className={cn(
                            'flex items-center gap-2 w-full px-3 rounded-full text-xs font-medium text-text-secondary cursor-pointer select-none transition-all duration-200',
                            'bg-success/10',
                            pickerOpen && 'border-success text-text-primary',
                            !pickerOpen && 'hover:text-text-primary hover:border-border',
                        )}
                        onClick={() => setPickerOpen(true)}
                    >
                        <span
                            className={cn(
                                'w-2 h-2 rounded-full shrink-0 transition-all duration-300',
                                connectionStatus === 'connected' ? 'bg-success shadow-[0_0_6px_rgba(34,197,94,0.5)]' :
                                    connectionStatus === 'error' ? 'bg-red-500 shadow-[0_0_6px_rgba(255,95,87,0.5)] animate-pulse' :
                                        'bg-text-secondary'
                            )}
                            title={connectionStatus === 'error' ? 'Connection lost, reconnecting...' : ''}
                        />
                        <span className="flex-1 text-center truncate">{breadcrumbLabel}</span>
                        {/* {activeProfile ? (
                            <button
                                className={cn(
                                    "w-5 h-5 flex items-center justify-center rounded-sm transition-colors opacity-100 hover:opacity-80",
                                    connectionStatus !== 'connected' ? 'bg-bg-tertiary hover:bg-bg-primary' : 'hover:bg-bg-primary'
                                )}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setPickerOpen(true);
                                }}
                                title="Connection details"
                            >
                                <img
                                    src={getProvider(activeProfile.driver).icon}
                                    alt={activeProfile.driver}
                                    className={cn('w-[20px] h-[20px] shrink-0 transition-all duration-300', connectionStatus === 'connected' ? 'grayscale-0' : 'grayscale')}
                                />
                            </button>
                        ) : (
                        )} */}
                        <ChevronDown
                            size={14}
                            strokeWidth={pickerOpen ? 2.5 : 2}
                            className={cn('opacity-50 transition-transform duration-200', pickerOpen && 'rotate-180 opacity-100 text-accent')}
                        />
                    </div>
                </div>

                {pickerOpen && (
                    <WorkspaceModal onClose={() => setPickerOpen(false)} />
                )}
            </div>

            {/* Right */}
            <div className="flex items-center shrink-0">
                <Button variant="ghost" size="icon" title="Settings" onClick={() => addTab({ type: 'settings', name: 'Settings' })}>
                    <Settings size={14} />
                </Button>

                {/* <Divider orientation="vertical" className="h-5" /> */}

                {/* Layout toggles */}
                <Button
                    variant="ghost" size="icon"
                    className={cn(showSidebar && "text-accent")}
                    title="Toggle Sidebar (Ctrl+B)"
                    onClick={toggleSidebar}
                >
                    <PanelLeft size={14} strokeWidth={showSidebar ? 2.5 : 2} />
                </Button>
                <Button
                    variant="ghost" size="icon"
                    className={cn(showResultPanel && "text-accent")}
                    disabled={!isQueryTab}
                    title="Toggle Result Panel (Ctrl+J)"
                    onClick={toggleResultPanel}
                >
                    <PanelBottom size={14} strokeWidth={showResultPanel && isQueryTab ? 2.5 : 2} />
                </Button>
                <Button
                    variant="ghost" size="icon"
                    className={cn(showRightSidebar && "text-accent")}
                    title="Toggle Right Sidebar (Ctrl+Alt+B)"
                    onClick={toggleRightSidebar}
                >
                    <PanelRight size={14} strokeWidth={showRightSidebar ? 2.5 : 2} />
                </Button>


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
