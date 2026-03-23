import React, { useState, useEffect } from 'react';
import {
    Plus,
    Play,
    Square,
    Settings,
    ChevronDown,
    RefreshCw,
    Lock,
    Minus,
    X,
    PanelLeft,
    PanelBottom,
    PanelRight,
    GitBranchPlus,
    Check,
    Undo2,
    Search,
    Columns2,
    Layers3,
} from 'lucide-react';
import { useConnectionStore } from '../../stores/connectionStore';
import { useEditorStore } from '../../stores/editorStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { useStatusStore } from '../../stores/statusStore';
import { useProjectStore } from '../../stores/projectStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { BeginTransaction, CommitTransaction, RollbackTransaction, CancelQuery, Reconnect } from '../../../wailsjs/go/app/App';
import { WindowMinimise, WindowToggleMaximise, Quit } from '../../../wailsjs/runtime/runtime';

import { EnvironmentSwitcherModal } from './EnvironmentSwitcherModal';
import { AboutModal } from './AboutModal';
import { UpdateModal } from './UpdateModal';
import { useUpdateCheck } from '../../hooks/useUpdateCheck';
import { cn } from '../../lib/cn';
import { getEnvironmentMeta } from '../../lib/projects';
import { Button, Divider } from '../ui';
import zentroLogo from '../../assets/images/main-logo.png';
import { DOM_EVENT } from '../../lib/constants';
import { useToast } from './Toast';

export const Toolbar: React.FC = () => {
    const { isConnected, activeProfile, connectionStatus } = useConnectionStore();
    const activeProject = useProjectStore((state) => state.activeProject);
    const activeEnvironmentKey = useEnvironmentStore((state) => state.activeEnvironmentKey);
    const { groups, activeGroupId, addTab } = useEditorStore();
    const {
        showSidebar,
        showResultPanel,
        showRightSidebar,
        toggleSidebar,
        toggleResultPanel,
        toggleRightSidebar,
    } = useLayoutStore();
    const { transactionStatus } = useStatusStore();
    const { toast } = useToast();

    const [aboutOpen, setAboutOpen] = useState(false);
    const [updateModalOpen, setUpdateModalOpen] = useState(false);
    const [environmentSwitcherOpen, setEnvironmentSwitcherOpen] = useState(false);

    const { hasUpdate, updateInfo, dismiss } = useUpdateCheck();

    const activeGroup = groups.find((g) => g.id === activeGroupId);
    const activeTab = activeGroup?.tabs.find((t) => t.id === activeGroup.activeTabId);
    const activeTabId = activeGroup?.activeTabId;
    const isRunning = activeTab?.isRunning ?? false;
    const isQueryTab = activeTab?.type === 'query';
    const canRunEditorAction = Boolean(isConnected && activeTab && !activeTab.readOnly && isQueryTab);
    const txActive = transactionStatus === 'active';

    useEffect(() => {
        const handler = () => setEnvironmentSwitcherOpen(true);
        window.addEventListener(DOM_EVENT.OPEN_ENVIRONMENT_SWITCHER, handler);
        return () => window.removeEventListener(DOM_EVENT.OPEN_ENVIRONMENT_SWITCHER, handler);
    }, []);

    const handleRun = () => {
        if (!activeTab || !canRunEditorAction) return;
        window.dispatchEvent(new CustomEvent(DOM_EVENT.RUN_QUERY_ACTION, { detail: { tabId: activeTab.id } }));
    };

    const handleExplain = (analyze: boolean) => {
        if (!activeTab || !canRunEditorAction) return;
        window.dispatchEvent(new CustomEvent(DOM_EVENT.RUN_EXPLAIN_ACTION, { detail: { tabId: activeTab.id, analyze } }));
    };

    const handleCancel = async () => {
        if (!activeTabId) return;
        try {
            await CancelQuery(activeTabId);
        } catch {
            // ignore
        }
    };

    const handleBeginTransaction = async () => {
        try {
            await BeginTransaction();
            toast.success('Transaction started.');
        } catch (error: any) {
            toast.error(`Begin transaction failed: ${error}`);
        }
    };

    const handleCommitTransaction = async () => {
        try {
            await CommitTransaction();
            toast.success('Transaction committed.');
        } catch (error: any) {
            toast.error(`Commit failed: ${error}`);
        }
    };

    const handleRollbackTransaction = async () => {
        try {
            await RollbackTransaction();
            toast.success('Transaction rolled back.');
        } catch (error: any) {
            toast.error(`Rollback failed: ${error}`);
        }
    };

    let breadcrumbLabel = 'No Connection';
    if (activeProfile) {
        breadcrumbLabel = `${activeProfile.name} / ${activeProfile.db_name}`;
    }

    const envMeta = getEnvironmentMeta(activeEnvironmentKey || activeProject?.default_environment_key);

    return (
        <div className="h-8 flex items-center justify-between flex-shrink-0 px-3 gap-2 bg-bg-secondary border-b border-border">
            <div className="flex items-center gap-1.5 flex-shrink-0">
                <div
                    className="flex items-center justify-center w-6 h-6 mr-1 cursor-pointer hover:opacity-80 transition-opacity relative"
                    title={hasUpdate ? 'New version available!' : 'About Zentro'}
                    onClick={() => (hasUpdate ? setUpdateModalOpen(true) : setAboutOpen(true))}
                >
                    <img src={zentroLogo} alt="Zentro" className="w-5 h-5 object-contain" />
                    {hasUpdate && (
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-success rounded-full border border-bg-secondary animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                    )}
                </div>
                <Button variant="ghost" size="icon" title="Toggle Safe Mode">
                    <Lock size={14} />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    title="Open Project Hub"
                    onClick={() => window.dispatchEvent(new CustomEvent(DOM_EVENT.OPEN_PROJECT_HUB))}
                >
                    <Layers3 size={14} />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    title="Reload Connection"
                    onClick={() => activeProfile && Reconnect().catch(() => {})}
                    disabled={!activeProfile || connectionStatus === 'connecting'}
                >
                    <RefreshCw size={14} className={cn(connectionStatus === 'connecting' && 'animate-spin')} />
                </Button>

                <Divider orientation="vertical" className="h-5" />

                <Button variant="ghost" size="icon" title="New Tab (Ctrl+T)" onClick={() => addTab()}>
                    <Plus size={16} />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    disabled={!canRunEditorAction || isRunning}
                    title="Run Query (Ctrl+Enter)"
                    onClick={handleRun}
                >
                    <Play size={16} color={!canRunEditorAction || isRunning ? 'currentColor' : 'var(--success-color)'} />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    disabled={!canRunEditorAction || isRunning}
                    title="Explain"
                    onClick={() => handleExplain(false)}
                >
                    <Search size={14} />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    disabled={!canRunEditorAction || isRunning}
                    title="Explain Analyze"
                    onClick={() => handleExplain(true)}
                >
                    <Search size={14} className="text-accent" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    title="Compare Queries"
                    onClick={() => window.dispatchEvent(new CustomEvent(DOM_EVENT.OPEN_QUERY_COMPARE))}
                >
                    <Columns2 size={14} />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    disabled={!isRunning}
                    title="Cancel Execution"
                    onClick={handleCancel}
                >
                    <Square size={16} fill={isRunning ? 'currentColor' : 'none'} color={isRunning ? 'var(--error-color)' : 'currentColor'} />
                </Button>

                <Divider orientation="vertical" className="h-5" />

                <Button
                    variant="ghost"
                    size="icon"
                    disabled={!isConnected || txActive}
                    title="Begin Transaction"
                    onClick={handleBeginTransaction}
                >
                    <GitBranchPlus size={14} color={!isConnected || txActive ? 'currentColor' : 'var(--success-color)'} />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    disabled={!isConnected || !txActive}
                    title="Commit Transaction"
                    onClick={handleCommitTransaction}
                >
                    <Check size={14} color={!isConnected || !txActive ? 'currentColor' : 'var(--accent-color)'} />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    disabled={!isConnected || !txActive}
                    title="Rollback Transaction"
                    onClick={handleRollbackTransaction}
                >
                    <Undo2 size={14} color={!isConnected || !txActive ? 'currentColor' : 'var(--error-color)'} />
                </Button>
            </div>

            <div
                className="flex-1 flex items-center justify-center h-full"
                style={{ '--wails-draggable': 'drag', cursor: 'default' } as React.CSSProperties}
            >
                <div
                    className="flex justify-center relative h-10/12 my-1"
                    style={{ width: 'min(520px, 44vw)', ['--wails-draggable' as any]: 'no-drag' }}
                >
                    <div
                        className={cn(
                            'flex items-center gap-2 w-full px-3 rounded-full text-xs font-medium text-text-secondary cursor-pointer select-none transition-all duration-200',
                            'bg-success/10',
                            environmentSwitcherOpen && 'border-success text-text-primary',
                            !environmentSwitcherOpen && 'hover:text-text-primary hover:border-border'
                        )}
                        onClick={() => setEnvironmentSwitcherOpen(true)}
                    >
                        {activeProject && (
                            <>
                                <span className="truncate shrink max-w-[150px] text-text-primary font-semibold">
                                    {activeProject.name}
                                </span>
                                <span
                                    className={cn(
                                        'shrink-0 px-1.5 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider leading-none',
                                        envMeta.colorClass
                                    )}
                                >
                                    {activeEnvironmentKey || activeProject.default_environment_key}
                                </span>
                                <span className="text-text-secondary/40 shrink-0">/</span>
                            </>
                        )}
                        <span
                            className={cn(
                                'w-2 h-2 rounded-full shrink-0 transition-all duration-300',
                                connectionStatus === 'connected'
                                    ? 'bg-success shadow-[0_0_6px_rgba(34,197,94,0.5)]'
                                    : connectionStatus === 'error'
                                        ? 'bg-red-500 shadow-[0_0_6px_rgba(255,95,87,0.5)] animate-pulse'
                                        : 'bg-text-secondary'
                            )}
                            title={connectionStatus === 'error' ? 'Connection lost, reconnecting...' : ''}
                        />
                        <span className="flex-1 text-center truncate">
                            {breadcrumbLabel}
                        </span>
                        <ChevronDown
                            size={14}
                            strokeWidth={environmentSwitcherOpen ? 2.5 : 2}
                            className={cn('opacity-50 transition-transform duration-200', environmentSwitcherOpen && 'rotate-180 opacity-100 text-accent')}
                        />
                    </div>
                </div>

                {environmentSwitcherOpen && <EnvironmentSwitcherModal onClose={() => setEnvironmentSwitcherOpen(false)} />}
            </div>

            <div className="flex items-center shrink-0">
                <Button variant="ghost" size="icon" title="Settings" onClick={() => addTab({ type: 'settings', name: 'Settings' })}>
                    <Settings size={14} />
                </Button>

                <Button
                    variant="ghost"
                    size="icon"
                    className={cn(showSidebar && 'text-accent')}
                    title="Toggle Sidebar (Ctrl+B)"
                    onClick={toggleSidebar}
                >
                    <PanelLeft size={14} strokeWidth={showSidebar ? 2.5 : 2} />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn(showResultPanel && 'text-accent')}
                    disabled={!isQueryTab}
                    title="Toggle Result Panel (Ctrl+J)"
                    onClick={toggleResultPanel}
                >
                    <PanelBottom size={14} strokeWidth={showResultPanel && isQueryTab ? 2.5 : 2} />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn(showRightSidebar && 'text-accent')}
                    title="Toggle Right Sidebar (Ctrl+Alt+B)"
                    onClick={toggleRightSidebar}
                >
                    <PanelRight size={14} strokeWidth={showRightSidebar ? 2.5 : 2} />
                </Button>

                <div className="flex items-center gap-0.5 ml-0.5">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="hover:bg-[rgba(255,189,46,0.2)] hover:text-[#ffbd2e]"
                        title="Minimize"
                        onClick={WindowMinimise}
                    >
                        <Minus size={12} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="hover:bg-[rgba(40,201,98,0.2)] hover:text-[#28c962]"
                        title="Maximize / Restore"
                        onClick={WindowToggleMaximise}
                    >
                        <span className="block w-2.5 h-2.5 border-[1.5px] border-current rounded-[1px]" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="hover:bg-[rgba(255,95,87,0.2)] hover:text-[#ff5f57]"
                        title="Close"
                        onClick={Quit}
                    >
                        <X size={13} />
                    </Button>
                </div>
            </div>

            {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
            {updateModalOpen && updateInfo && (
                <UpdateModal
                    latestVersion={updateInfo.latest_version}
                    changelog={updateInfo.changelog}
                    releaseUrl={updateInfo.release_url}
                    onClose={() => setUpdateModalOpen(false)}
                    onDismiss={() => {
                        dismiss();
                        setUpdateModalOpen(false);
                    }}
                />
            )}
        </div>
    );
};
