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
import { useShortcutStore } from '../../stores/shortcutStore';
import { WindowMinimise, WindowToggleMaximise, Quit } from '../../../wailsjs/runtime/runtime';

import { AboutModal } from './AboutModal';
import { UpdateModal } from './UpdateModal';
import { LicenseModal } from './LicenseModal';
import { useUpdateCheck } from '../../hooks/useUpdateCheck';
import { cn } from '../../lib/cn';
import { getEnvironmentMeta, sortEnvironmentKeys, getEnvironmentBgClass } from '../../lib/projects';
import type { CommandId } from '../../lib/shortcutRegistry';
import { Button, Popover, PopoverAnchor, PopoverContent } from '../ui';
import zentroLogo from '../../assets/images/main-logo.png';
import { DOM_EVENT, CONNECTION_STATUS, ENVIRONMENT_KEY } from '../../lib/constants';
import { useToast } from './Toast';
import type { EnvironmentKey } from '../../types/project';
import { utils } from '../../../wailsjs/go/models';
import { emitCommand } from '../../lib/commandBus';
import { WindowControls } from './toolbar/WindowControls';
import { AppMenu } from './toolbar/AppMenu';
import { usePlatform } from '../../hooks/usePlatform';
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
import { EnvironmentBadge } from '../shared/EnvironmentBadge';

export const Toolbar: React.FC = () => {
    const platform = usePlatform();
    const { activeProfile, connectionStatus } = useConnectionStore();
    const activeProject = useProjectStore((s) => s.activeProject);
    const setProjectEnvironment = useProjectStore((s) => s.setProjectEnvironment);
    const activeEnvironmentKey = useEnvironmentStore((s) => s.activeEnvironmentKey);
    const setActiveEnvironment = useEnvironmentStore((s) => s.setActiveEnvironment);
    const { addTab } = useEditorStore();
    const { showSidebar, showResultPanel, showRightSidebar, toggleSidebar, toggleResultPanel, toggleRightSidebar } = useLayoutStore();
    const { toast } = useToast();
    const transactionStatus = useStatusStore((s) => s.transactionStatus);
    const viewMode = useSettingsStore((s) => s.viewMode);
    const savePrefs = useSettingsStore((s) => s.save);
    const shortcutBindings = useShortcutStore((s) => s.bindings);
    const getShortcutBinding = useShortcutStore((s) => s.getBinding);
    const resolveShortcutBinding = useCallback((id: CommandId) => {
        if (typeof getShortcutBinding === 'function') {
            return getShortcutBinding(id);
        }
        return shortcutBindings?.[id] || '';
    }, [getShortcutBinding, shortcutBindings]);

    const { hasUpdate, updateInfo, dismiss, check, isChecking } = useUpdateCheck();

    const [aboutOpen, setAboutOpen] = useState(false);
    const [updateModalOpen, setUpdateModalOpen] = useState(false);
    const [licenseOpen, setLicenseOpen] = useState(false);
    const [quickEnvOpen, setQuickEnvOpen] = useState(false);
    const [branchSpotlightOpen, setBranchSpotlightOpen] = useState(false);
    const [gitBranch, setGitBranch] = useState('');
    const [gitBranches, setGitBranches] = useState<string[]>([]);
    const [gitBranchLoading, setGitBranchLoading] = useState(false);
    const [gitBranchBusy, setGitBranchBusy] = useState(false);
    const quickEnvCloseTimerRef = useRef<number | null>(null);

    // Active tab detection for menu
    const { groups, activeGroupId } = useEditorStore();
    const activeGroup = groups.find((g) => g.id === activeGroupId);
    const activeTab = activeGroup?.tabs.find((t) => t.id === activeGroup.activeTabId);
    const isQueryTab = activeTab?.type === 'query';

    const serverLabel = activeProfile?.host || 'No server';
    const databaseLabel = activeProfile?.db_name || 'No database';
    const activeProjectIconKey = getProjectIconKey(activeProject);
    const ActiveProjectIcon = PROJECT_ICON_MAP[activeProjectIconKey].icon;
    const activeEnvKey = (activeEnvironmentKey || activeProject?.default_environment_key) as EnvironmentKey | undefined;
    const envMeta = getEnvironmentMeta(activeEnvironmentKey || activeProject?.default_environment_key);
    const envToolbarBg = getEnvironmentBgClass(activeEnvKey);

    const quickEnvOptions = useMemo(() => {
        const orderedKeys: EnvironmentKey[] = [];
        const seen = new Set<EnvironmentKey>();
        const pushKey = (key?: EnvironmentKey | null) => {
            if (!key || seen.has(key)) return;
            seen.add(key);
            orderedKeys.push(key);
        };

        // Quick switch popover should only list environments already bound to a connection.
        (activeProject?.connections || []).forEach((connection) => {
            pushKey(connection.environment_key as EnvironmentKey);
        });

        return sortEnvironmentKeys(orderedKeys);
    }, [activeProject?.connections]);

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

    const quickEnvShortcutDetails = useMemo(() => {
        const byKey = new Map<EnvironmentKey, string>();
        byKey.set(ENVIRONMENT_KEY.LOCAL, resolveShortcutBinding('connection.switchEnvLocal'));
        byKey.set(ENVIRONMENT_KEY.DEVELOPMENT, resolveShortcutBinding('connection.switchEnvDevelopment'));
        byKey.set(ENVIRONMENT_KEY.TESTING, resolveShortcutBinding('connection.switchEnvTesting'));
        byKey.set(ENVIRONMENT_KEY.STAGING, resolveShortcutBinding('connection.switchEnvStaging'));
        byKey.set(ENVIRONMENT_KEY.PRODUCTION, resolveShortcutBinding('connection.switchEnvProduction'));
        return byKey;
    }, [resolveShortcutBinding]);

    const clearQuickEnvCloseTimer = useCallback(() => {
        if (quickEnvCloseTimerRef.current === null) return;
        window.clearTimeout(quickEnvCloseTimerRef.current);
        quickEnvCloseTimerRef.current = null;
    }, []);

    const openQuickEnv = useCallback(() => {
        clearQuickEnvCloseTimer();
        setQuickEnvOpen(true);
    }, [clearQuickEnvCloseTimer]);

    const scheduleQuickEnvClose = useCallback(() => {
        clearQuickEnvCloseTimer();
        quickEnvCloseTimerRef.current = window.setTimeout(() => {
            setQuickEnvOpen(false);
            quickEnvCloseTimerRef.current = null;
        }, 120);
    }, [clearQuickEnvCloseTimer]);

    useEffect(() => () => clearQuickEnvCloseTimer(), [clearQuickEnvCloseTimer]);

    const handleQuickSwitchEnv = async (envKey: EnvironmentKey) => {
        setQuickEnvOpen(false);
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

    const isMac = platform === 'darwin';

    return (
        <div
            className="h-8 grid grid-cols-10 items-center shrink-0 px-3 gap-2 mb-1.5"
            style={isMac ? { paddingLeft: '76px' } : undefined}
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
                        variant="ghost" size="icon-sm"
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
                        size="icon-sm"
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
                            className="text-label"
                            title="Switch or create branch"
                            onClick={() => setBranchSpotlightOpen(true)}
                        >
                            <GitBranch size={14} />
                            <span className="max-w-30 truncate">{gitBranchLoading ? 'loading...' : (gitBranch || '-')}</span>
                        </Button>
                    )}
                </div>
            </div>

            {/* Center: 4/10 - project / server+db (pinned center) / env badge */}
            <div
                className={cn('col-span-4 min-w-0 relative flex items-center h-7 rounded-sm', envToolbarBg)}
                style={{ '--wails-draggable': 'no-drag' } as React.CSSProperties & Record<'--wails-draggable', string>}
            >
                {/* Project button — left-aligned */}
                <Button
                    type="button"
                    variant="ghost"
                    className={cn(
                        'relative shrink-0 h-full flex min-w-0 items-center gap-1.5 px-2 transition-colors',
                        !activeProject && 'opacity-60',
                    )}
                    title="Open Project Hub"
                    onClick={() => {
                        setQuickEnvOpen(false);
                        emitCommand(DOM_EVENT.OPEN_PROJECT_HUB);
                    }}
                >
                    <ActiveProjectIcon
                        size={14}
                        className={cn(
                            'shrink-0',
                            connectionStatus === CONNECTION_STATUS.CONNECTED
                                ? 'text-success'
                                : connectionStatus === CONNECTION_STATUS.ERROR
                                    ? 'text-error animate-pulse'
                                    : 'text-muted-foreground',
                        )}
                    />
                    <span className="truncate max-w-32 text-foreground font-medium">{activeProject?.name || 'No Project'}</span>
                </Button>

                {/* Server + DB — absolutely centered in the col */}
                <div
                    className={cn(
                        'pointer-events-none absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 text-label text-muted-foreground select-none',
                        connectionStatus === CONNECTION_STATUS.CONNECTING && 'connecting-soft-flash rounded-sm px-1',
                    )}
                >
                    <span className="truncate max-w-28 text-end" title={serverLabel}>{serverLabel}</span>
                    <Server size={12} className="shrink-0" />
                    <Database size={12} className="shrink-0" />
                    <span className="truncate max-w-28" title={databaseLabel}>{databaseLabel}</span>
                </div>

                {/* Env badge — right-aligned, no container */}
                <div className="ml-auto shrink-0">
                    <Popover open={quickEnvOpen} onOpenChange={setQuickEnvOpen}>
                        <PopoverAnchor asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                className="h-full shrink-0 flex items-center gap-1.5 transition-colors px-0 leading-none"
                                title="Hover to quick switch environment, click to configure bindings"
                                onMouseEnter={() => openQuickEnv()}
                                onMouseLeave={scheduleQuickEnvClose}
                                onFocus={() => openQuickEnv()}
                                onBlur={scheduleQuickEnvClose}
                                onClick={() => {
                                    setQuickEnvOpen(false);
                                    if (!activeProject?.id) {
                                        emitCommand(DOM_EVENT.OPEN_PROJECT_HUB);
                                        return;
                                    }
                                    emitCommand(DOM_EVENT.OPEN_PROJECT_HUB, {
                                        surface: 'wizard',
                                        wizardMode: 'edit',
                                        launchContext: 'env-config',
                                        projectId: activeProject.id,
                                        initialEnvironmentKey: activeEnvironmentKey || activeProject.default_environment_key,
                                    });
                                }}
                            >
                                {activeProject && (
                                    <EnvironmentBadge
                                        label={activeEnvironmentKey || activeProject.default_environment_key}
                                        toneClassName={envMeta.colorClass}
                                    />
                                )}
                            </Button>
                        </PopoverAnchor>
                        {activeProject && (
                            <PopoverContent
                                align="end"
                                side="bottom"
                                sideOffset={8}
                                className="z-dropdown w-120 max-w-[calc(100vw-28px)] rounded-sm border border-border/40 bg-card p-2 shadow-xl"
                                onMouseEnter={clearQuickEnvCloseTimer}
                                onMouseLeave={scheduleQuickEnvClose}
                            >
                                <div className="space-y-1">
                                    {quickEnvOptions.map((envKey) => {
                                        const meta = getEnvironmentMeta(envKey);
                                        const isActive = envKey === (activeEnvironmentKey || activeProject.default_environment_key);
                                        const details = quickEnvConnectionDetails.get(envKey);
                                        const shortcut = quickEnvShortcutDetails.get(envKey);
                                        return (
                                            <Button
                                                key={envKey}
                                                type="button"
                                                variant="ghost"
                                                className={cn(
                                                    'relative h-auto w-full justify-start rounded-sm px-2.5 py-2 text-left text-label transition-colors',
                                                    isActive
                                                        ? 'border border-accent/35 bg-accent/10 text-foreground'
                                                        : 'text-muted-foreground hover:bg-background/50 hover:text-foreground',
                                                )}
                                                onClick={() => {
                                                    void handleQuickSwitchEnv(envKey);
                                                }}
                                            >
                                                <div className="grid min-w-0 w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2.5">
                                                    <div className="justify-self-start">
                                                        <EnvironmentBadge label={envKey} toneClassName={meta.colorClass} />
                                                    </div>
                                                    <div className="inline-flex min-w-0 max-w-75 items-center justify-center gap-3 justify-self-center text-muted-foreground">
                                                        <span className="inline-flex w-6/12 items-center gap-1">
                                                            <span className="truncate text-label" title={details?.host || 'No host'}>{details?.host || 'No host'}</span>
                                                            <Server size={11} className="shrink-0" />
                                                        </span>
                                                        <span className="inline-flex w-6/12 items-center gap-1">
                                                            <Database size={11} className="shrink-0" />
                                                            <span className="truncate text-label" title={details?.database || 'No DB'}>{details?.database || 'No DB'}</span>
                                                        </span>
                                                    </div>
                                                    <span className="justify-self-end shrink-0 text-label text-muted-foreground">
                                                        {shortcut}
                                                    </span>
                                                </div>
                                            </Button>
                                        );
                                    })}
                                </div>
                            </PopoverContent>
                        )}
                    </Popover>
                </div>
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
                    <Button variant="ghost" size="icon-sm" title="Settings" onClick={() => addTab({ type: 'settings', name: 'Settings' })}>
                        <Settings size={14} />
                    </Button>
                    <Button variant="ghost" size="icon-sm" className={cn(showSidebar && 'text-accent')} title="Toggle Sidebar (Ctrl+B)" onClick={toggleSidebar}>
                        <PanelLeft size={14} strokeWidth={showSidebar ? 2.5 : 2} />
                    </Button>
                    <Button variant="ghost" size="icon-sm" className={cn(showResultPanel && 'text-accent')} disabled={!isQueryTab} title="Toggle Result Panel (Ctrl+J)" onClick={toggleResultPanel}>
                        <PanelBottom size={14} strokeWidth={showResultPanel && isQueryTab ? 2.5 : 2} />
                    </Button>
                    <Button variant="ghost" size="icon-sm" className={cn(showRightSidebar && 'text-accent')} title="Toggle Right Sidebar (Ctrl+Alt+B)" onClick={toggleRightSidebar}>
                        <PanelRight size={14} strokeWidth={showRightSidebar ? 2.5 : 2} />
                    </Button>
                    {!isMac && <WindowControls onMinimize={WindowMinimise} onToggleMaximize={WindowToggleMaximise} onClose={Quit} />}
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
