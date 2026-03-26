import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    Settings,
    RefreshCw,
    Lock,
    Eye,
    PanelLeft,
    PanelBottom,
    PanelRight,
    Layers3,
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
import { Reconnect } from '../../services/connectionService';
import { WindowMinimise, WindowToggleMaximise, Quit } from '../../../wailsjs/runtime/runtime';

import { EnvironmentSwitcherModal } from './EnvironmentSwitcherModal';
import { AboutModal } from './AboutModal';
import { UpdateModal } from './UpdateModal';
import { LicenseModal } from './LicenseModal';
import { useUpdateCheck } from '../../hooks/useUpdateCheck';
import { cn } from '../../lib/cn';
import { getEnvironmentMeta } from '../../lib/projects';
import { Button } from '../ui';
import zentroLogo from '../../assets/images/main-logo.png';
import { DOM_EVENT } from '../../lib/constants';
import { useToast } from './Toast';
import type { EnvironmentKey } from '../../types/project';
import { utils } from '../../../wailsjs/go/models';
import { emitCommand, onCommand } from '../../lib/commandBus';
import { WindowControls } from './toolbar/WindowControls';
import { AppMenu } from './toolbar/AppMenu';

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
    const [quickEnvHighlightedIndex, setQuickEnvHighlightedIndex] = useState(0);
    const quickEnvRef = useRef<HTMLDivElement | null>(null);

    // Active tab detection for menu
    const { groups, activeGroupId } = useEditorStore();
    const activeGroup = groups.find((g) => g.id === activeGroupId);
    const activeTab = activeGroup?.tabs.find((t) => t.id === activeGroup.activeTabId);
    const isQueryTab = activeTab?.type === 'query';

    const serverLabel = activeProfile?.name || activeProfile?.host || 'No server';
    const databaseLabel = activeProfile?.db_name || 'No database';
    const envMeta = getEnvironmentMeta(activeEnvironmentKey || activeProject?.default_environment_key);

    const quickEnvOptions = useMemo(() => {
        if (environments.length > 0) return environments.map((env) => env.key as EnvironmentKey);
        if (activeProject?.default_environment_key) return [activeProject.default_environment_key as EnvironmentKey];
        return [] as EnvironmentKey[];
    }, [activeProject?.default_environment_key, environments]);

    // ── Environment switcher command ──────────────────────────────────────────
    useEffect(() => {
        const off = onCommand(DOM_EVENT.OPEN_ENVIRONMENT_SWITCHER, () => {
            setQuickEnvOpen(false);
            setEnvironmentSwitcherOpen(true);
        });
        return off;
    }, []);

    // ── Quick env dropdown: close on outside click ────────────────────────────
    useEffect(() => {
        if (!quickEnvOpen) return;
        const onDown = (e: MouseEvent) => { if (!quickEnvRef.current?.contains(e.target as Node)) setQuickEnvOpen(false); };
        window.addEventListener('mousedown', onDown);
        return () => window.removeEventListener('mousedown', onDown);
    }, [quickEnvOpen]);

    // ── Quick env keyboard ────────────────────────────────────────────────────
    useEffect(() => {
        if (!quickEnvOpen) return;
        const activeKey = (activeEnvironmentKey || activeProject?.default_environment_key) as EnvironmentKey | undefined;
        const idx = activeKey ? quickEnvOptions.findIndex((k) => k === activeKey) : -1;
        setQuickEnvHighlightedIndex(idx >= 0 ? idx : 0);
    }, [activeEnvironmentKey, activeProject?.default_environment_key, quickEnvOpen, quickEnvOptions]);

    useEffect(() => {
        if (!quickEnvOpen) return;
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
            if (e.key === 'Escape') { e.preventDefault(); setQuickEnvOpen(false); }
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
    }, [quickEnvHighlightedIndex, quickEnvOpen, quickEnvOptions]);

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

    return (
        <div className="h-8 flex items-center justify-between flex-shrink-0 px-3 gap-2 bg-bg-secondary border-b border-border">
            {/* Left: logo + primary buttons */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
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
                    {viewMode && <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />}
                </Button>

                <Button variant="ghost" size="icon" title="Reload Connection" onClick={() => activeProfile && Reconnect().catch(() => {})} disabled={!activeProfile || connectionStatus === 'connecting'}>
                    <RefreshCw size={14} className={cn(connectionStatus === 'connecting' && 'animate-spin')} />
                </Button>
            </div>

            {/* Center: project / connection pill + quick env switcher */}
            <div className="flex-1 flex items-center justify-center h-full" style={{ '--wails-draggable': 'drag', cursor: 'default' } as React.CSSProperties}>
                <div
                    className="flex justify-center relative h-10/12 my-1"
                    style={{ width: 'min(520px, 44vw)', '--wails-draggable': 'no-drag' } as React.CSSProperties & Record<'--wails-draggable', string>}
                >
                    <div
                        ref={quickEnvRef}
                        className={cn(
                            'relative flex items-stretch w-full rounded-full text-xs font-medium text-text-secondary select-none transition-all duration-200 bg-success/10',
                            (quickEnvOpen || environmentSwitcherOpen) && 'border-success text-text-primary',
                        )}
                    >
                        {/* Project button */}
                        <button
                            type="button"
                            className={cn('h-full flex min-w-0 items-center gap-2 px-2.5 rounded-l-full border-r border-border/30 hover:bg-bg-secondary/40 transition-colors text-[11px] leading-none', !activeProject && 'opacity-60')}
                            title="Open Project Hub"
                            onClick={() => { setQuickEnvOpen(false); emitCommand(DOM_EVENT.OPEN_PROJECT_HUB); }}
                        >
                            <Layers3
                                size={14}
                                className={cn(
                                    'shrink-0 translate-y-[0.5px]',
                                    connectionStatus === 'connected' ? 'text-success' : connectionStatus === 'error' ? 'text-red-500 animate-pulse' : 'text-text-secondary',
                                )}
                            />
                            <span className="truncate max-w-[170px] text-text-primary font-semibold leading-none">{activeProject?.name || 'No Project'}</span>
                        </button>

                        {/* Connection info / env switcher trigger */}
                        <button
                            type="button"
                            className={cn('relative h-full flex min-w-0 flex-1 items-center gap-2 px-3 border-r border-border/30 cursor-pointer transition-all duration-200 leading-none', !quickEnvOpen && !environmentSwitcherOpen && 'hover:text-text-primary hover:border-border')}
                            onClick={() => setQuickEnvOpen((c) => !c)}
                            disabled={!activeProject}
                            title="Switch environment"
                        >
                            <div className="min-w-0 flex-1 flex items-center justify-center overflow-hidden text-text-secondary text-[11px] leading-none">
                                <div className="min-w-0 inline-flex items-center justify-center gap-1.5">
                                    <span className="truncate max-w-[120px] text-center leading-none">{serverLabel}</span>
                                    <Server size={13} className="shrink-0 translate-y-[0.5px]" />
                                    <Database size={13} className="shrink-0 translate-y-[0.5px]" />
                                    <span className="truncate max-w-[120px] text-center leading-none">{databaseLabel}</span>
                                </div>
                            </div>
                        </button>

                        {/* Environment config button */}
                        <button
                            type="button"
                            className="relative h-full shrink-0 cursor-pointer flex items-center gap-1.5 px-2.5 rounded-r-full hover:bg-bg-secondary/40 transition-colors leading-none"
                            title="Configure environment bindings"
                            onClick={() => { setQuickEnvOpen(false); setEnvironmentSwitcherOpen(true); }}
                        >
                            {activeProject && (
                                <span className={cn('shrink-0 px-1.5 py-0.5 rounded-full border font-bold uppercase tracking-wider leading-none text-[10px]', envMeta.colorClass)}>
                                    {activeEnvironmentKey || activeProject.default_environment_key}
                                </span>
                            )}
                            <SlidersHorizontal size={12} className="translate-y-[0.5px]" />
                        </button>

                        {/* Quick env dropdown */}
                        {quickEnvOpen && activeProject && (
                            <div className="absolute left-1/2 top-[calc(100%+6px)] z-dropdown w-2/3 min-w-[220px] -translate-x-1/2 rounded-lg border border-border/40 bg-bg-secondary shadow-xl p-2">
                                <div className="space-y-1">
                                    {quickEnvOptions.map((envKey, index) => {
                                        const meta = getEnvironmentMeta(envKey);
                                        const isActive = envKey === (activeEnvironmentKey || activeProject.default_environment_key);
                                        const isHighlighted = index === quickEnvHighlightedIndex;
                                        return (
                                            <button
                                                key={envKey} type="button"
                                                className={cn(
                                                    'w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] transition-colors',
                                                    isActive ? 'bg-accent/10 border border-accent/35 text-text-primary' : isHighlighted ? 'bg-bg-primary/60 text-text-primary' : 'hover:bg-bg-primary/50 text-text-secondary',
                                                )}
                                                onClick={() => void handleQuickSwitchEnv(envKey)}
                                                onMouseEnter={() => setQuickEnvHighlightedIndex(index)}
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className={cn('shrink-0 rounded-full border px-2 py-0.5 font-bold uppercase tracking-wider', meta.colorClass)}>{envKey}</span>
                                                    <span className="truncate font-semibold">{meta.label}</span>
                                                </div>
                                                {isActive && <span className="text-[10px] text-accent font-semibold">Active</span>}
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

            {/* Right: panel toggles + window controls */}
            <div className="flex items-center shrink-0">
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
        </div>
    );
};
