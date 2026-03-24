import React, { useState, useEffect, useMemo, useRef } from 'react';
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
    SlidersHorizontal,
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
import type { EnvironmentKey } from '../../types/project';

export const Toolbar: React.FC = () => {
    const { isConnected, activeProfile, connectionStatus } = useConnectionStore();
    const activeProject = useProjectStore((state) => state.activeProject);
    const setProjectEnvironment = useProjectStore((state) => state.setProjectEnvironment);
    const activeEnvironmentKey = useEnvironmentStore((state) => state.activeEnvironmentKey);
    const environments = useEnvironmentStore((state) => state.environments);
    const setActiveEnvironment = useEnvironmentStore((state) => state.setActiveEnvironment);
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
    const [quickEnvOpen, setQuickEnvOpen] = useState(false);
    const quickEnvRef = useRef<HTMLDivElement | null>(null);

    const { hasUpdate, updateInfo, dismiss } = useUpdateCheck();

    const activeGroup = groups.find((g) => g.id === activeGroupId);
    const activeTab = activeGroup?.tabs.find((t) => t.id === activeGroup.activeTabId);
    const activeTabId = activeGroup?.activeTabId;
    const isRunning = activeTab?.isRunning ?? false;
    const isQueryTab = activeTab?.type === 'query';
    const canRunEditorAction = Boolean(isConnected && activeTab && !activeTab.readOnly && isQueryTab);
    const txActive = transactionStatus === 'active';

    useEffect(() => {
        const handler = () => {
            setQuickEnvOpen(false);
            setEnvironmentSwitcherOpen(true);
        };
        window.addEventListener(DOM_EVENT.OPEN_ENVIRONMENT_SWITCHER, handler);
        return () => window.removeEventListener(DOM_EVENT.OPEN_ENVIRONMENT_SWITCHER, handler);
    }, []);

    useEffect(() => {
        if (!quickEnvOpen) return;
        const onDocMouseDown = (event: MouseEvent) => {
            if (!quickEnvRef.current?.contains(event.target as Node)) {
                setQuickEnvOpen(false);
            }
        };
        window.addEventListener('mousedown', onDocMouseDown);
        return () => window.removeEventListener('mousedown', onDocMouseDown);
    }, [quickEnvOpen]);

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
    const quickEnvOptions = useMemo(() => {
        if (environments.length > 0) {
            return environments.map((env) => env.key as EnvironmentKey);
        }
        if (activeProject?.default_environment_key) {
            return [activeProject.default_environment_key as EnvironmentKey];
        }
        return [] as EnvironmentKey[];
    }, [activeProject?.default_environment_key, environments]);

    const handleQuickSwitchEnv = async (envKey: EnvironmentKey) => {
        setQuickEnvOpen(false);
        if (!activeProject) return;
        if (envKey === activeEnvironmentKey) return;

        try {
            setActiveEnvironment(envKey);
            const updated = await setProjectEnvironment(envKey);
            if (updated) return;
            toast.error('Could not switch environment.');
        } catch (error) {
            toast.error(`Could not switch environment: ${error}`);
        }
    };

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
                        ref={quickEnvRef}
                        className={cn(
                            'relative flex items-stretch w-full rounded-full text-xs font-medium text-text-secondary select-none transition-all duration-200 bg-success/10',
                            (quickEnvOpen || environmentSwitcherOpen) && 'border-success text-text-primary',
                        )}
                    >
                        <button
                            type="button"
                            className={cn(
                                'flex min-w-0 flex-1 items-center gap-2 px-3 rounded-l-full cursor-pointer transition-all duration-200',
                                !quickEnvOpen && !environmentSwitcherOpen && 'hover:text-text-primary hover:border-border',
                            )}
                            onClick={() => setQuickEnvOpen((current) => !current)}
                            disabled={!activeProject}
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
                                strokeWidth={quickEnvOpen ? 2.5 : 2}
                                className={cn('opacity-50 transition-transform duration-200', quickEnvOpen && 'rotate-180 opacity-100 text-accent')}
                            />
                        </button>

                        <button
                            type="button"
                            className="shrink-0 flex items-center justify-center px-2.5 rounded-r-full border-l border-border/30 hover:bg-bg-secondary/40 transition-colors"
                            title="Edit environment bindings"
                            onClick={() => {
                                setQuickEnvOpen(false);
                                setEnvironmentSwitcherOpen(true);
                            }}
                        >
                            <SlidersHorizontal size={13} />
                        </button>

                        {quickEnvOpen && activeProject && (
                            <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[1200] rounded-2xl border border-border/40 bg-bg-secondary shadow-xl p-2">
                                <div className="space-y-1">
                                    {quickEnvOptions.map((envKey) => {
                                        const meta = getEnvironmentMeta(envKey);
                                        const isActive = envKey === (activeEnvironmentKey || activeProject.default_environment_key);
                                        return (
                                            <button
                                                key={envKey}
                                                type="button"
                                                className={cn(
                                                    'w-full flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-[11px] transition-colors',
                                                    isActive
                                                        ? 'bg-accent/10 border border-accent/35 text-text-primary'
                                                        : 'hover:bg-bg-primary/50 text-text-secondary',
                                                )}
                                                onClick={() => void handleQuickSwitchEnv(envKey)}
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider', meta.colorClass)}>
                                                        {envKey}
                                                    </span>
                                                    <span className="truncate font-semibold">{meta.label}</span>
                                                </div>
                                                {isActive && (
                                                    <span className="text-[10px] text-accent font-semibold">Active</span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
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
