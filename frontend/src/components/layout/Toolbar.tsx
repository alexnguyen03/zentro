import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    Settings,
    Lock,
    Eye,
    RefreshCw,
    GitBranch,
    PanelLeft,
    PanelBottom,
    PanelRight,
    SlidersHorizontal,
    Server,
    Database,
} from 'lucide-react';
import { useConnectionStore } from '../../stores/connectionStore';
import { useEditorStore } from '../../stores/editorStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { useStatusStore } from '../../stores/statusStore';
import { useProjectStore } from '../../stores/projectStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { WindowMinimise, WindowToggleMaximise, Quit } from '../../../wailsjs/runtime/runtime';

import { EnvironmentSwitcherModal } from './EnvironmentSwitcherModal';
import { AboutModal } from './AboutModal';
import { UpdateModal } from './UpdateModal';
import { LicenseModal } from './LicenseModal';
import { useUpdateCheck } from '../../hooks/useUpdateCheck';
import { cn } from '../../lib/cn';
import { getEnvironmentMeta, sortEnvironmentKeys } from '../../lib/projects';
import { Button } from '../ui';
import zentroLogo from '../../assets/images/main-logo.png';
import { DOM_EVENT, CONNECTION_STATUS, ENVIRONMENT_KEY } from '../../lib/constants';
import { useToast } from './Toast';
import type { EnvironmentKey } from '../../types/project';
import { utils } from '../../../wailsjs/go/models';
import { emitCommand, onCommand } from '../../lib/commandBus';
import { WindowControls } from './toolbar/WindowControls';
import { AppMenu } from './toolbar/AppMenu';
import { Reconnect } from '../../services/connectionService';
import {
    SCGetStatus,
    SCListBranches,
    SCCheckoutBranch,
    SCCreateBranch,
    SCCreateBranchFrom,
    SCCheckoutDetached,
} from '../../services/sourceControlService';
import { PROJECT_ICON_MAP, getProjectIconKey } from './projectHubMeta';
import { BranchSpotlight } from '../sidebar/BranchSpotlight';

export const Toolbar: React.FC = () => {
    const { activeProfile, connectionStatus } = useConnectionStore();
    const activeProject = useProjectStore((s) => s.activeProject);
    const setProjectEnvironment = useProjectStore((s) => s.setProjectEnvironment);
    const activeEnvironmentKey = useEnvironmentStore((s) => s.activeEnvironmentKey);
    const environments = useEnvironmentStore((s) => s.environments);
    const setActiveEnvironment = useEnvironmentStore((s) => s.setActiveEnvironment);
    const { addTab } = useEditorStore();
    const { showSidebar, showResultPanel, showRightSidebar, toggleSidebar, toggleResultPanel, toggleRightSidebar } = useLayoutStore();
    const { toast } = useToast();
    const transactionStatus = useStatusStore((s) => s.transactionStatus);
    const viewMode = useSettingsStore((s) => s.viewMode);
    const savePrefs = useSettingsStore((s) => s.save);

    const { hasUpdate, updateInfo, dismiss, check, isChecking } = useUpdateCheck();

    const [aboutOpen, setAboutOpen] = useState(false);
    const [updateModalOpen, setUpdateModalOpen] = useState(false);
    const [licenseOpen, setLicenseOpen] = useState(false);
    const [environmentSwitcherOpen, setEnvironmentSwitcherOpen] = useState(false);
    const [quickEnvOpen, setQuickEnvOpen] = useState(false);
    const [quickEnvKeyboardMode, setQuickEnvKeyboardMode] = useState(false);
    const [quickEnvHighlightedIndex, setQuickEnvHighlightedIndex] = useState(0);
    const [branchSpotlightOpen, setBranchSpotlightOpen] = useState(false);
    const [gitBranch, setGitBranch] = useState('');
    const [gitBranches, setGitBranches] = useState<string[]>([]);
    const [gitBranchLoading, setGitBranchLoading] = useState(false);
    const [gitBranchBusy, setGitBranchBusy] = useState(false);
    const quickEnvRef = useRef<HTMLDivElement | null>(null);
    const quickEnvCloseTimerRef = useRef<number | null>(null);

    // Active tab detection for menu
    const { groups, activeGroupId } = useEditorStore();
    const activeGroup = groups.find((g) => g.id === activeGroupId);
    const activeTab = activeGroup?.tabs.find((t) => t.id === activeGroup.activeTabId);
    const isQueryTab = activeTab?.type === 'query';

    const serverLabel = activeProfile?.name || activeProfile?.host || 'No server';
    const databaseLabel = activeProfile?.db_name || 'No database';
    const activeProjectIconKey = getProjectIconKey(activeProject);
    const ActiveProjectIcon = PROJECT_ICON_MAP[activeProjectIconKey].icon;
    const activeEnvKey = (activeEnvironmentKey || activeProject?.default_environment_key) as EnvironmentKey | undefined;
    const envMeta = getEnvironmentMeta(activeEnvironmentKey || activeProject?.default_environment_key);
    const envToolbarTone = useMemo(() => {
        if (activeEnvKey === ENVIRONMENT_KEY.PRODUCTION) {
            return {
                base: 'bg-red-500/12',
                active: 'border-red-500/60',
            };
        }
        if (activeEnvKey === ENVIRONMENT_KEY.STAGING) {
            return {
                base: 'bg-amber-500/12',
                active: 'border-amber-500/60',
            };
        }
        if (activeEnvKey === ENVIRONMENT_KEY.DEVELOPMENT) {
            return {
                base: 'bg-sky-500/12',
                active: 'border-sky-500/60',
            };
        }
        if (activeEnvKey === ENVIRONMENT_KEY.TESTING) {
            return {
                base: 'bg-fuchsia-500/12',
                active: 'border-fuchsia-500/60',
            };
        }
        return {
            base: 'bg-success/10',
            active: 'border-success/70',
        };
    }, [activeEnvKey]);

    const quickEnvOptions = useMemo(() => {
        const orderedKeys: EnvironmentKey[] = [];
        const seen = new Set<EnvironmentKey>();
        const pushKey = (key?: EnvironmentKey | null) => {
            if (!key || seen.has(key)) return;
            seen.add(key);
            orderedKeys.push(key);
        };

        (activeProject?.environments || []).forEach((env) => pushKey(env.key as EnvironmentKey));
        environments.forEach((env) => pushKey(env.key as EnvironmentKey));
        pushKey(activeProject?.last_active_environment_key as EnvironmentKey | undefined);
        pushKey(activeProject?.default_environment_key as EnvironmentKey | undefined);
        pushKey(activeEnvironmentKey as EnvironmentKey | undefined);

        return sortEnvironmentKeys(orderedKeys);
    }, [
        activeEnvironmentKey,
        activeProject?.default_environment_key,
        activeProject?.last_active_environment_key,
        activeProject?.environments,
        environments,
    ]);

    const quickEnvConnectionDetails = useMemo(() => {
        const byKey = new Map<EnvironmentKey, { host: string; database: string }>();
        quickEnvOptions.forEach((envKey) => {
            const envConnection = activeProject?.connections?.find((connection) => connection.environment_key === envKey);
            const envModel = activeProject?.environments?.find((env) => env.key === envKey);
            const isActive = envKey === activeEnvKey;

            const host = (isActive ? (activeProfile?.host || activeProfile?.name) : undefined)
                || envConnection?.host
                || envConnection?.name
                || 'No host';
            const database = (isActive ? activeProfile?.db_name : undefined)
                || envConnection?.database
                || envModel?.last_database
                || 'No DB';

            byKey.set(envKey, { host, database });
        });
        return byKey;
    }, [activeEnvKey, activeProfile?.db_name, activeProfile?.host, activeProfile?.name, activeProject?.connections, activeProject?.environments, quickEnvOptions]);

    const clearQuickEnvCloseTimer = useCallback(() => {
        if (quickEnvCloseTimerRef.current === null) return;
        window.clearTimeout(quickEnvCloseTimerRef.current);
        quickEnvCloseTimerRef.current = null;
    }, []);

    const openQuickEnv = useCallback((keyboardMode = false) => {
        clearQuickEnvCloseTimer();
        setQuickEnvOpen(true);
        setQuickEnvKeyboardMode(keyboardMode);
    }, [clearQuickEnvCloseTimer]);

    const scheduleQuickEnvClose = useCallback(() => {
        clearQuickEnvCloseTimer();
        quickEnvCloseTimerRef.current = window.setTimeout(() => {
            setQuickEnvOpen(false);
            setQuickEnvKeyboardMode(false);
            quickEnvCloseTimerRef.current = null;
        }, 120);
    }, [clearQuickEnvCloseTimer]);

    // ── Environment switcher command ──────────────────────────────────────────
    useEffect(() => {
        const off = onCommand(DOM_EVENT.OPEN_ENVIRONMENT_SWITCHER, () => {
            setQuickEnvOpen(false);
            setQuickEnvKeyboardMode(false);
            setEnvironmentSwitcherOpen(true);
        });
        return off;
    }, []);

    useEffect(() => () => clearQuickEnvCloseTimer(), [clearQuickEnvCloseTimer]);

    // ── Quick env dropdown: close on outside click ────────────────────────────
    useEffect(() => {
        if (!quickEnvOpen) return;
        const onDown = (e: MouseEvent) => {
            if (quickEnvRef.current?.contains(e.target as Node)) return;
            setQuickEnvOpen(false);
            setQuickEnvKeyboardMode(false);
        };
        window.addEventListener('mousedown', onDown);
        return () => window.removeEventListener('mousedown', onDown);
    }, [quickEnvOpen]);

    // ── Quick env keyboard ────────────────────────────────────────────────────
    useEffect(() => {
        if (!quickEnvOpen) return;
        const activeKey = activeEnvKey;
        const idx = activeKey ? quickEnvOptions.findIndex((k) => k === activeKey) : -1;
        setQuickEnvHighlightedIndex(idx >= 0 ? idx : 0);
    }, [activeEnvKey, quickEnvOpen, quickEnvOptions]);

    useEffect(() => {
        if (!quickEnvOpen || !quickEnvKeyboardMode) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (quickEnvOptions.length === 0) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); setQuickEnvHighlightedIndex((c) => (c + 1) % quickEnvOptions.length); return; }
            if (e.key === 'ArrowUp') { e.preventDefault(); setQuickEnvHighlightedIndex((c) => (c - 1 + quickEnvOptions.length) % quickEnvOptions.length); return; }
            if (e.key === 'Enter') {
                e.preventDefault();
                const target = quickEnvOptions[Math.max(0, quickEnvHighlightedIndex)];
                if (target) void handleQuickSwitchEnv(target);
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                setQuickEnvOpen(false);
                setQuickEnvKeyboardMode(false);
            }
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
    }, [quickEnvHighlightedIndex, quickEnvKeyboardMode, quickEnvOpen, quickEnvOptions]);

    const handleQuickSwitchEnv = async (envKey: EnvironmentKey) => {
        setQuickEnvOpen(false);
        setQuickEnvKeyboardMode(false);
        if (!activeProject || envKey === activeEnvironmentKey) return;
        try {
            setActiveEnvironment(envKey);
            const updated = await setProjectEnvironment(envKey);
            if (updated) return;
            toast.error('Could not switch environment.');
        } catch (error) {
            toast.error(`Could not switch environment: ${error}`);
        }
    };

    const handleToggleViewMode = async () => {
        const next = !viewMode;
        if (next && transactionStatus === 'active') {
            toast.error('Cannot enable View Mode while a transaction is active. Please commit or rollback first.');
            return;
        }
        await savePrefs(new utils.Preferences({ view_mode: next }));
        toast.success(next ? 'View Mode enabled (read-only).' : 'View Mode disabled.');
    };
    const handleReconnect = async () => {
        if (!activeProfile || connectionStatus === CONNECTION_STATUS.CONNECTING) return;
        try {
            await Reconnect();
        } catch {
            // Keep silent to match previous reload behavior.
        }
    };

    const hasGitRepo = Boolean(activeProject?.git_repo_path);
    const loadGitBranchState = useCallback(async () => {
        if (!hasGitRepo) {
            setGitBranch('');
            setGitBranches([]);
            return;
        }
        setGitBranchLoading(true);
        try {
            const [status, branches] = await Promise.all([SCGetStatus(), SCListBranches()]);
            setGitBranch(status.branch || '');
            setGitBranches(Array.from(new Set((branches || []).filter(Boolean))));
        } catch {
            setGitBranches([]);
        } finally {
            setGitBranchLoading(false);
        }
    }, [hasGitRepo]);

    useEffect(() => {
        void loadGitBranchState();
    }, [loadGitBranchState]);

    const handleCheckoutBranch = useCallback(async (nextBranch: string) => {
        if (!nextBranch || gitBranchBusy) return;
        setGitBranchBusy(true);
        try {
            await SCCheckoutBranch(nextBranch);
            await loadGitBranchState();
            setBranchSpotlightOpen(false);
        } catch (error) {
            toast.error(`Switch branch failed: ${error}`);
        } finally {
            setGitBranchBusy(false);
        }
    }, [gitBranchBusy, loadGitBranchState, toast]);

    const handleCreateBranch = useCallback(async (branchName: string) => {
        const next = branchName.trim();
        if (!next || gitBranchBusy) return;
        setGitBranchBusy(true);
        try {
            const latest = await SCListBranches();
            const exists = (latest || []).some((b) => b.toLowerCase() === next.toLowerCase());
            if (exists) {
                await SCCheckoutBranch(next);
            } else {
                await SCCreateBranch(next);
                toast.success(`Created "${next}"`);
            }
            await loadGitBranchState();
            setBranchSpotlightOpen(false);
        } catch (error) {
            toast.error(`Create branch failed: ${error}`);
        } finally {
            setGitBranchBusy(false);
        }
    }, [gitBranchBusy, loadGitBranchState, toast]);

    const handleCreateBranchFrom = useCallback(async (branchName: string, fromRef: string) => {
        const next = branchName.trim();
        const base = fromRef.trim();
        if (!next || !base || gitBranchBusy) return;
        setGitBranchBusy(true);
        try {
            const latest = await SCListBranches();
            const exists = (latest || []).some((b) => b.toLowerCase() === next.toLowerCase());
            if (exists) {
                await SCCheckoutBranch(next);
            } else {
                await SCCreateBranchFrom(next, base);
                toast.success(`Created "${next}" from "${base}"`);
            }
            await loadGitBranchState();
            setBranchSpotlightOpen(false);
        } catch (error) {
            toast.error(`Create branch from failed: ${error}`);
        } finally {
            setGitBranchBusy(false);
        }
    }, [gitBranchBusy, loadGitBranchState, toast]);

    const handleCheckoutDetached = useCallback(async (ref: string) => {
        const target = ref.trim();
        if (!target || gitBranchBusy) return;
        setGitBranchBusy(true);
        try {
            await SCCheckoutDetached(target);
            await loadGitBranchState();
            setBranchSpotlightOpen(false);
            toast.success(`Checked out detached at "${target}"`);
        } catch (error) {
            toast.error(`Checkout detached failed: ${error}`);
        } finally {
            setGitBranchBusy(false);
        }
    }, [gitBranchBusy, loadGitBranchState, toast]);

    const handleToolbarDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
        const target = event.target as HTMLElement | null;
        if (!target) return;
        if (target.closest('button, a, input, textarea, select, [role="button"], [data-no-window-dblclick="true"]')) {
            return;
        }
        WindowToggleMaximise();
    };

    return (
        <div
            className="h-10 grid grid-cols-10 items-center shrink-0 px-3 gap-2"
            onDoubleClick={handleToolbarDoubleClick}
        >
            {/* Left: 3/10 */}
            <div
                className="col-span-3 min-w-0 flex items-center"
                style={{ '--wails-draggable': 'drag', cursor: 'default' } as React.CSSProperties}
            >
                <div
                    className="flex items-center gap-1.5"
                    style={{ '--wails-draggable': 'no-drag' } as React.CSSProperties & Record<'--wails-draggable', string>}
                >
                    <AppMenu
                        trigger={<img src={zentroLogo} alt="Zentro" className="w-5 h-5 object-contain" />}
                        hasUpdate={hasUpdate}
                        updateInfo={updateInfo}
                        isChecking={isChecking}
                        check={check}
                        dismiss={dismiss}
                        onOpenAbout={() => setAboutOpen(true)}
                        onOpenLicense={() => setLicenseOpen(true)}
                        onOpenUpdateModal={setUpdateModalOpen}
                    />

                    <Button
                        variant="ghost" size="icon"
                        title={viewMode ? 'View Mode ON (Click to disable)' : 'Enable View Mode (Read-only)'}
                        aria-pressed={viewMode}
                        className={cn('relative', viewMode && 'text-warning')}
                        onClick={() => { void handleToggleViewMode(); }}
                    >
                        {viewMode ? <Eye size={14} className="drop-shadow-[0_0_4px_rgba(245,158,11,0.55)]" /> : <Lock size={14} />}
                        {viewMode && <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-sm bg-warning animate-pulse" />}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        title="Reload Connection"
                        onClick={() => {
                            void handleReconnect();
                        }}
                        disabled={!activeProfile || connectionStatus === CONNECTION_STATUS.CONNECTING}
                    >
                        <RefreshCw size={14} className={cn(connectionStatus === CONNECTION_STATUS.CONNECTING && 'animate-spin')} />
                    </Button>
                    {hasGitRepo && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 px-2 text-[11px] font-mono"
                            title="Switch or create branch"
                            onClick={() => setBranchSpotlightOpen(true)}
                        >
                            <GitBranch size={13} />
                            <span className="max-w-[120px] truncate">{gitBranchLoading ? 'loading...' : (gitBranch || '-')}</span>
                        </Button>
                    )}
                </div>
            </div>

            {/* Center: 4/10 - project / connection pill + quick env switcher */}
            <div className="col-span-4 min-w-0 flex items-center justify-center h-full">
                <div
                    className="flex flex-1 justify-center relative h-10/12 my-1"
                    style={{ width: 'min(520px, 44vw)', '--wails-draggable': 'no-drag' } as React.CSSProperties & Record<'--wails-draggable', string>}
                >
                    <div
                        ref={quickEnvRef}
                        className={cn(
                            'relative flex items-stretch w-full rounded-sm text-xs font-medium text-muted-foreground select-none transition-all duration-200',
                            envToolbarTone.base,
                            (quickEnvOpen || environmentSwitcherOpen) && cn(envToolbarTone.active, 'text-foreground'),
                        )}
                        onMouseLeave={scheduleQuickEnvClose}
                        onBlurCapture={(event) => {
                            if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                            setQuickEnvOpen(false);
                            setQuickEnvKeyboardMode(false);
                        }}
                    >
                        {/* Project button */}
                        <Button
                            type="button"
                            variant="ghost"
                            className={cn('relative z-[2] h-full flex min-w-0 items-center gap-2 px-2.5 hover:bg-card/40 transition-colors text-[11px] leading-none', !activeProject && 'opacity-60')}
                            title="Open Project Hub"
                            onClick={() => { setQuickEnvOpen(false); emitCommand(DOM_EVENT.OPEN_PROJECT_HUB); }}
                        >
                            <ActiveProjectIcon
                                size={14}
                                className={cn(
                                    'shrink-0 translate-y-[0.5px]',
                                    connectionStatus === CONNECTION_STATUS.CONNECTED ? 'text-success' : connectionStatus === CONNECTION_STATUS.ERROR ? 'text-red-500 animate-pulse' : 'text-muted-foreground',
                                )}
                            />
                            <span className="truncate max-w-[170px] text-foreground font-semibold leading-none">{activeProject?.name || 'No Project'}</span>
                        </Button>

                        {/* Connection info / env switcher trigger */}
                        <Button
                            type="button"
                            variant="ghost"
                            className={cn(
                                'relative z-1 h-full flex min-w-0 flex-1 items-center gap-2 px-3 border-r border-border/50 cursor-pointer transition-all duration-200 leading-none',
                                connectionStatus === CONNECTION_STATUS.CONNECTING && 'connecting-soft-flash',
                                !quickEnvOpen && !environmentSwitcherOpen && 'hover:text-foreground hover:border-border',
                            )}
                            onClick={() => openQuickEnv(true)}
                            onMouseEnter={() => openQuickEnv(false)}
                            onFocus={() => openQuickEnv(true)}
                            disabled={!activeProject}
                            title="Switch environment"
                        >
                            <span className="sr-only">Switch environment</span>
                        </Button>

                        <div className="pointer-events-none absolute left-1/2 top-1/2 z-[1] w-[min(340px,54%)] -translate-x-1/2 -translate-y-1/2 text-[11px] leading-none text-muted-foreground">
                            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto_minmax(0,1fr)] items-center gap-1.5">
                                <span className="truncate text-end leading-none">{serverLabel}</span>
                                <Server size={13} className="shrink-0 translate-y-[0.5px]" />
                                <Database size={13} className="shrink-0 translate-y-[0.5px]" />
                                <span className="truncate leading-none">{databaseLabel}</span>
                            </div>
                        </div>

                        {/* Environment config button */}
                        <Button
                            type="button"
                            variant="ghost"
                            className="relative z-[2] h-full shrink-0 cursor-pointer flex items-center gap-1.5 px-2.5 rounded-r-full hover:bg-card/40 transition-colors leading-none"
                            title="Configure environment bindings"
                            onClick={() => {
                                setQuickEnvOpen(false);
                                setQuickEnvKeyboardMode(false);
                                setEnvironmentSwitcherOpen(true);
                            }}
                        >
                            {activeProject && (
                                <span className={cn('shrink-0 px-1.5 py-0.5 rounded-sm border font-bold uppercase tracking-wider leading-none text-[10px]', envMeta.colorClass)}>
                                    {activeEnvironmentKey || activeProject.default_environment_key}
                                </span>
                            )}
                        </Button>

                        {/* Quick env dropdown */}
                        {quickEnvOpen && activeProject && (
                            <div
                                className="absolute left-1/2 top-[calc(100%+6px)] z-dropdown w-2/3 min-w-[220px] -translate-x-1/2 rounded-sm border border-border/40 bg-card shadow-xl p-2"
                                onMouseEnter={clearQuickEnvCloseTimer}
                            >
                                <div className="space-y-1">
                                    {quickEnvOptions.map((envKey, index) => {
                                        const meta = getEnvironmentMeta(envKey);
                                        const isActive = envKey === (activeEnvironmentKey || activeProject.default_environment_key);
                                        const isHighlighted = index === quickEnvHighlightedIndex;
                                        const details = quickEnvConnectionDetails.get(envKey);
                                        return (
                                            <Button
                                                key={envKey} type="button"
                                                variant="ghost"
                                                className={cn(
                                                    'relative h-auto w-full justify-start rounded-sm px-2.5 py-2 pr-14 text-left text-[11px] transition-colors',
                                                    isActive ? 'bg-accent/10 border border-accent/35 text-foreground' : isHighlighted ? 'bg-background/60 text-foreground' : 'hover:bg-background/50 text-muted-foreground',
                                                )}
                                                onClick={() => void handleQuickSwitchEnv(envKey)}
                                                onMouseEnter={() => setQuickEnvHighlightedIndex(index)}
                                            >
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span className={cn('shrink-0 rounded-sm border px-2 py-0.5 font-bold uppercase tracking-wider', meta.colorClass)}>{envKey}</span>
                                                        <span className="truncate font-semibold">{meta.label}</span>
                                                    </div>
                                                    <div className="mt-1 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 text-[10px] text-muted-foreground">
                                                        <span className="inline-flex min-w-0 w-full items-center gap-1">
                                                            <Server size={11} className="shrink-0" />
                                                            <span className="truncate" title={details?.host || 'No host'}>{details?.host || 'No host'}</span>
                                                        </span>
                                                        <span className="inline-flex min-w-0 w-full items-center gap-1">
                                                            <Database size={11} className="shrink-0" />
                                                            <span className="truncate" title={details?.database || 'No DB'}>{details?.database || 'No DB'}</span>
                                                        </span>
                                                    </div>
                                                </div>
                                                {isActive && (
                                                    <span className="pointer-events-none absolute right-2.5 top-2 text-[10px] font-semibold text-accent">
                                                        Active
                                                    </span>
                                                )}
                                            </Button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {environmentSwitcherOpen && <EnvironmentSwitcherModal onClose={() => setEnvironmentSwitcherOpen(false)} />}
            </div>

            {/* Right: 3/10 */}
            <div
                className="col-span-3 min-w-0 flex items-center justify-end"
                style={{ '--wails-draggable': 'drag', cursor: 'default' } as React.CSSProperties}
            >
                <div
                    className="flex items-center"
                    style={{ '--wails-draggable': 'no-drag' } as React.CSSProperties & Record<'--wails-draggable', string>}
                >
                    <Button variant="ghost" size="icon" title="Settings" onClick={() => addTab({ type: 'settings', name: 'Settings' })}>
                        <Settings size={14} />
                    </Button>
                    <Button variant="ghost" size="icon" className={cn(showSidebar && 'text-accent')} title="Toggle Sidebar (Ctrl+B)" onClick={toggleSidebar}>
                        <PanelLeft size={14} strokeWidth={showSidebar ? 2.5 : 2} />
                    </Button>
                    <Button variant="ghost" size="icon" className={cn(showResultPanel && 'text-accent')} disabled={!isQueryTab} title="Toggle Result Panel (Ctrl+J)" onClick={toggleResultPanel}>
                        <PanelBottom size={14} strokeWidth={showResultPanel && isQueryTab ? 2.5 : 2} />
                    </Button>
                    <Button variant="ghost" size="icon" className={cn(showRightSidebar && 'text-accent')} title="Toggle Right Sidebar (Ctrl+Alt+B)" onClick={toggleRightSidebar}>
                        <PanelRight size={14} strokeWidth={showRightSidebar ? 2.5 : 2} />
                    </Button>
                    <WindowControls onMinimize={WindowMinimise} onToggleMaximize={WindowToggleMaximise} onClose={Quit} />
                </div>
            </div>

            {/* Modals */}
            {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
            {licenseOpen && <LicenseModal onClose={() => setLicenseOpen(false)} />}
            {updateModalOpen && updateInfo && (
                <UpdateModal
                    latestVersion={updateInfo.latest_version}
                    changelog={updateInfo.changelog}
                    releaseUrl={updateInfo.release_url}
                    onClose={() => setUpdateModalOpen(false)}
                    onDismiss={() => { dismiss(); setUpdateModalOpen(false); }}
                />
            )}
            <BranchSpotlight
                open={branchSpotlightOpen}
                branches={gitBranches}
                currentBranch={gitBranch}
                loading={gitBranchLoading}
                busy={gitBranchBusy}
                onClose={() => setBranchSpotlightOpen(false)}
                onCheckout={handleCheckoutBranch}
                onCreateBranch={handleCreateBranch}
                onCreateBranchFrom={handleCreateBranchFrom}
                onCheckoutDetached={handleCheckoutDetached}
            />
        </div>
    );
};
