import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    Settings,
    RefreshCw,
    Lock,
    Eye,
    Minus,
    X,
    PanelLeft,
    PanelBottom,
    PanelRight,
    Layers3,
    SlidersHorizontal,
    Server,
    Database,
    ChevronRight,
} from 'lucide-react';
import { useConnectionStore } from '../../stores/connectionStore';
import { useEditorStore } from '../../stores/editorStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { useStatusStore } from '../../stores/statusStore';
import { useProjectStore } from '../../stores/projectStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useShortcutStore } from '../../stores/shortcutStore';
import { Reconnect } from '../../services/connectionService';
import {
    WindowMinimise,
    WindowToggleMaximise,
    Quit,
} from '../../../wailsjs/runtime/runtime';

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
import type { CommandId } from '../../lib/shortcutRegistry';
import { emitCommand, onCommand } from '../../lib/commandBus';
import { AppMenuItem, AppMenuSection, buildAppMenuSections } from './toolbar/appMenuSections';

export const Toolbar: React.FC = () => {
    const { activeProfile, connectionStatus } = useConnectionStore();
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
    const shortcutBindings = useShortcutStore((state) => state.bindings);
    const { toast } = useToast();
    const transactionStatus = useStatusStore((state) => state.transactionStatus);
    const viewMode = useSettingsStore((state) => state.viewMode);
    const savePrefs = useSettingsStore((state) => state.save);

    const [aboutOpen, setAboutOpen] = useState(false);
    const [updateModalOpen, setUpdateModalOpen] = useState(false);
    const [licenseOpen, setLicenseOpen] = useState(false);
    const [environmentSwitcherOpen, setEnvironmentSwitcherOpen] = useState(false);
    const [quickEnvOpen, setQuickEnvOpen] = useState(false);
    const [quickEnvHighlightedIndex, setQuickEnvHighlightedIndex] = useState(0);
    const [appMenuOpen, setAppMenuOpen] = useState(false);
    const [appMenuActiveSectionIndex, setAppMenuActiveSectionIndex] = useState<number | null>(null);
    const [appMenuHighlightedIndex, setAppMenuHighlightedIndex] = useState(0);
    const [appSubmenuTop, setAppSubmenuTop] = useState(0);
    const quickEnvRef = useRef<HTMLDivElement | null>(null);
    const appMenuRef = useRef<HTMLDivElement | null>(null);
    const appMenuParentPanelRef = useRef<HTMLDivElement | null>(null);
    const appMenuSectionButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const submenuHideTimerRef = useRef<number | null>(null);

    const { hasUpdate, updateInfo, dismiss, check, isChecking } = useUpdateCheck();

    const activeGroup = groups.find((g) => g.id === activeGroupId);
    const activeTab = activeGroup?.tabs.find((t) => t.id === activeGroup.activeTabId);
    const isQueryTab = activeTab?.type === 'query';

    useEffect(() => {
        const off = onCommand(DOM_EVENT.OPEN_ENVIRONMENT_SWITCHER, () => {
            setQuickEnvOpen(false);
            setEnvironmentSwitcherOpen(true);
        });
        return off;
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

    useEffect(() => {
        if (!appMenuOpen) return;
        const onDocMouseDown = (event: MouseEvent) => {
            if (!appMenuRef.current?.contains(event.target as Node)) {
                setAppMenuOpen(false);
            }
        };
        window.addEventListener('mousedown', onDocMouseDown);
        return () => window.removeEventListener('mousedown', onDocMouseDown);
    }, [appMenuOpen]);

    const serverLabel = activeProfile?.name || activeProfile?.host || 'No server';
    const databaseLabel = activeProfile?.db_name || 'No database';

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

    useEffect(() => {
        if (!quickEnvOpen) return;
        const activeKey = (activeEnvironmentKey || activeProject?.default_environment_key) as EnvironmentKey | undefined;
        const activeIndex = activeKey ? quickEnvOptions.findIndex((envKey) => envKey === activeKey) : -1;
        setQuickEnvHighlightedIndex(activeIndex >= 0 ? activeIndex : 0);
    }, [activeEnvironmentKey, activeProject?.default_environment_key, quickEnvOpen, quickEnvOptions]);

    useEffect(() => {
        if (!quickEnvOpen) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (quickEnvOptions.length === 0) return;

            if (event.key === 'ArrowDown') {
                event.preventDefault();
                setQuickEnvHighlightedIndex((current) => (current + 1) % quickEnvOptions.length);
                return;
            }
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                setQuickEnvHighlightedIndex((current) => (current - 1 + quickEnvOptions.length) % quickEnvOptions.length);
                return;
            }
            if (event.key === 'Enter') {
                event.preventDefault();
                const targetEnv = quickEnvOptions[Math.max(0, quickEnvHighlightedIndex)];
                if (targetEnv) {
                    void handleQuickSwitchEnv(targetEnv);
                }
                return;
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                setQuickEnvOpen(false);
            }
        };

        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
    }, [quickEnvHighlightedIndex, quickEnvOpen, quickEnvOptions]);

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

    const handleToggleViewMode = async () => {
        const next = !viewMode;
        if (next && transactionStatus === 'active') {
            toast.error('Cannot enable View Mode while a transaction is active. Please commit or rollback first.');
            return;
        }

        await savePrefs(new utils.Preferences({ view_mode: next }));
        toast.success(next ? 'View Mode enabled (read-only).' : 'View Mode disabled.');
    };

    const getShortcut = useCallback((commandId: CommandId) => {
        return shortcutBindings[commandId] || '';
    }, [shortcutBindings]);

    const handleManualCheckForUpdates = useCallback(async () => {
        const result = await check(true);
        if (result === undefined) {
            toast.error('Could not check for updates.');
            return;
        }
        if (result?.has_update) {
            setUpdateModalOpen(true);
            return;
        }
        toast.success('You are already on the latest version.');
    }, [check, toast]);

    const appMenuSections = useMemo<AppMenuSection[]>(
        () =>
            buildAppMenuSections({
                getShortcut,
                isQueryTab,
                isChecking,
                hasUpdate,
                onCheckForUpdates: handleManualCheckForUpdates,
                onOpenAbout: () => setAboutOpen(true),
                onOpenLicense: () => setLicenseOpen(true),
            }),
        [
            getShortcut,
            isQueryTab,
            isChecking,
            hasUpdate,
            handleManualCheckForUpdates,
        ],
    );

    const clearSubmenuHideTimer = useCallback(() => {
        if (submenuHideTimerRef.current !== null) {
            window.clearTimeout(submenuHideTimerRef.current);
            submenuHideTimerRef.current = null;
        }
    }, []);

    const scheduleSubmenuHide = useCallback(() => {
        clearSubmenuHideTimer();
        submenuHideTimerRef.current = window.setTimeout(() => {
            setAppMenuActiveSectionIndex(null);
            submenuHideTimerRef.current = null;
        }, 120);
    }, [clearSubmenuHideTimer]);

    const setActiveSection = useCallback((sectionIndex: number, anchor?: HTMLElement | null) => {
        const section = appMenuSections[sectionIndex];
        if (!section) return;

        const panelElement = appMenuParentPanelRef.current;
        const anchorElement = anchor ?? appMenuSectionButtonRefs.current[sectionIndex] ?? null;
        if (panelElement && anchorElement) {
            const panelRect = panelElement.getBoundingClientRect();
            const anchorRect = anchorElement.getBoundingClientRect();
            setAppSubmenuTop(Math.max(0, anchorRect.top - panelRect.top));
        } else {
            setAppSubmenuTop(0);
        }

        setAppMenuActiveSectionIndex(sectionIndex);
        const firstEnabled = section.items.findIndex((item) => !item.disabled);
        setAppMenuHighlightedIndex(firstEnabled >= 0 ? firstEnabled : 0);
    }, [appMenuSections]);

    const appMenuActiveSection = useMemo(() => {
        if (appMenuActiveSectionIndex === null) return null;
        return appMenuSections[appMenuActiveSectionIndex] ?? null;
    }, [appMenuActiveSectionIndex, appMenuSections]);

    const findNextEnabledItemIndex = useCallback((items: AppMenuItem[], startIndex: number, direction: 1 | -1) => {
        if (items.length === 0) return 0;
        let nextIndex = startIndex;
        for (let i = 0; i < items.length; i += 1) {
            nextIndex = (nextIndex + direction + items.length) % items.length;
            if (!items[nextIndex]?.disabled) {
                return nextIndex;
            }
        }
        return Math.max(0, startIndex);
    }, []);

    useEffect(() => {
        if (appMenuOpen) return;
        clearSubmenuHideTimer();
        setAppMenuActiveSectionIndex(null);
        setAppMenuHighlightedIndex(0);
        setAppSubmenuTop(0);
    }, [appMenuOpen, clearSubmenuHideTimer]);

    useEffect(() => {
        return () => {
            clearSubmenuHideTimer();
        };
    }, [clearSubmenuHideTimer]);

    const handleSelectAppMenuItem = useCallback((item: AppMenuItem) => {
        if (item.disabled) return;
        setAppMenuOpen(false);
        Promise.resolve(item.action()).catch((error) => {
            toast.error(`Action failed: ${error}`);
        });
    }, [toast]);

    useEffect(() => {
        if (!appMenuOpen) return;
        const onKeyDown = (event: KeyboardEvent) => {
            const activeItems = appMenuActiveSection?.items || [];
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                if (!appMenuActiveSection) {
                    setActiveSection(0);
                    return;
                }
                setAppMenuHighlightedIndex((current) => findNextEnabledItemIndex(activeItems, current, 1));
                return;
            }
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                if (!appMenuActiveSection) {
                    setActiveSection(0);
                    return;
                }
                setAppMenuHighlightedIndex((current) => findNextEnabledItemIndex(activeItems, current, -1));
                return;
            }
            if (event.key === 'ArrowRight') {
                event.preventDefault();
                if (appMenuActiveSectionIndex === null) {
                    setActiveSection(0);
                    return;
                }
                setActiveSection((appMenuActiveSectionIndex + 1) % appMenuSections.length);
                return;
            }
            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                if (appMenuActiveSectionIndex === null) return;
                setActiveSection((appMenuActiveSectionIndex - 1 + appMenuSections.length) % appMenuSections.length);
                return;
            }
            if (event.key === 'Enter') {
                event.preventDefault();
                const target = activeItems[appMenuHighlightedIndex];
                if (target) {
                    handleSelectAppMenuItem(target);
                }
                return;
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                setAppMenuOpen(false);
            }
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
    }, [
        appMenuActiveSection,
        appMenuActiveSectionIndex,
        appMenuHighlightedIndex,
        appMenuOpen,
        appMenuSections.length,
        findNextEnabledItemIndex,
        handleSelectAppMenuItem,
        setActiveSection,
    ]);

    return (
        <div
            className={cn(
                'h-8 flex items-center justify-between flex-shrink-0 px-3 gap-2 bg-bg-secondary border-b border-border'
            )}
        >
            <div className="flex items-center gap-1.5 flex-shrink-0">
                <div ref={appMenuRef} className="relative">
                    <button
                        type="button"
                        className={cn(
                            'flex items-center justify-center w-6 h-6 mr-1 cursor-pointer hover:opacity-80 transition-opacity relative rounded-md',
                            appMenuOpen && 'bg-bg-primary/60'
                        )}
                        title="Open app menu"
                        aria-haspopup="menu"
                        aria-expanded={appMenuOpen}
                        onClick={() => {
                            setQuickEnvOpen(false);
                            clearSubmenuHideTimer();
                            setAppMenuOpen((current) => {
                                if (current) return false;
                                setAppMenuActiveSectionIndex(null);
                                setAppMenuHighlightedIndex(0);
                                setAppSubmenuTop(0);
                                return true;
                            });
                        }}
                    >
                        <img src={zentroLogo} alt="Zentro" className="w-5 h-5 object-contain" />
                        {hasUpdate && (
                            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-success rounded-full border border-bg-secondary animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                        )}
                    </button>

                    {appMenuOpen && (
                        <>
                            <div className="absolute left-0 top-[calc(100%+6px)] z-toolbar">
                                <div
                                    ref={appMenuParentPanelRef}
                                    className="w-[190px] rounded-xl bg-bg-secondary/95 shadow-2xl p-2"
                                    onMouseEnter={() => clearSubmenuHideTimer()}
                                    onMouseLeave={() => scheduleSubmenuHide()}
                                >
                                    <div className="space-y-0.5">
                                        {appMenuSections.map((section, sectionIndex) => {
                                            const isActive = sectionIndex === appMenuActiveSectionIndex;
                                            return (
                                                <button
                                                    ref={(element) => {
                                                        appMenuSectionButtonRefs.current[sectionIndex] = element;
                                                    }}
                                                    key={section.id}
                                                    type="button"
                                                    className={cn(
                                                        'cursor-pointer w-full flex items-center justify-between rounded-md px-2 py-1.5 text-[13px] transition-colors',
                                                        isActive
                                                            ? 'bg-accent/12 text-text-primary'
                                                            : 'text-text-secondary hover:bg-bg-secondary/80 hover:text-text-primary'
                                                    )}
                                                    onMouseEnter={(event) => {
                                                        clearSubmenuHideTimer();
                                                        setActiveSection(sectionIndex, event.currentTarget);
                                                    }}
                                                    onFocus={(event) => setActiveSection(sectionIndex, event.currentTarget)}
                                                    onClick={(event) => setActiveSection(sectionIndex, event.currentTarget)}
                                                >
                                                    <span>{section.title}</span>
                                                    <ChevronRight size={12} className={cn(isActive ? 'text-accent' : 'text-text-muted')} />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {appMenuActiveSection && (
                                    <div
                                        className="absolute left-[194px] z-toolbar w-[320px] rounded-xl bg-bg-secondary/95 shadow-2xl p-2"
                                        style={{ top: appSubmenuTop }}
                                        onMouseEnter={() => clearSubmenuHideTimer()}
                                        onMouseLeave={() => scheduleSubmenuHide()}
                                    >
                                        <div className="space-y-0.5">
                                            {appMenuActiveSection.items.map((item, itemIndex) => {
                                                const isHighlighted = itemIndex === appMenuHighlightedIndex;
                                                return (
                                                    <button
                                                        key={item.id}
                                                        type="button"
                                                        disabled={item.disabled}
                                                        className={cn(
                                                            'cursor-pointer w-full flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-[12px] transition-colors',
                                                            item.disabled
                                                                ? 'opacity-45 cursor-not-allowed text-text-secondary'
                                                                : isHighlighted
                                                                    ? item.danger
                                                                        ? 'bg-error/15 text-error'
                                                                        : 'bg-accent/10 text-text-primary'
                                                                    : item.danger
                                                                        ? 'text-error/80 hover:bg-error/10 hover:text-error'
                                                                        : 'text-text-secondary hover:bg-bg-secondary/80 hover:text-text-primary'
                                                        )}
                                                        onMouseEnter={() => setAppMenuHighlightedIndex(itemIndex)}
                                                        onClick={() => handleSelectAppMenuItem(item)}
                                                    >
                                                        <span className="inline-flex items-center gap-1.5">
                                                            <span>{item.label}</span>
                                                            {item.hasBadge && (
                                                                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                                                            )}
                                                        </span>
                                                        {item.shortcut && (
                                                            <span className="text-[10px] font-mono text-text-muted">{item.shortcut}</span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    title={viewMode ? 'View Mode ON (Click to disable)' : 'Enable View Mode (Read-only)'}
                    aria-pressed={viewMode}
                    className={cn(
                        'relative',
                        viewMode &&
                            'text-warning',
                    )}
                    onClick={() => {
                        void handleToggleViewMode();
                    }}
                >
                    {viewMode ? (
                        <Eye size={14} className="drop-shadow-[0_0_4px_rgba(245,158,11,0.55)]" />
                    ) : (
                        <Lock size={14} />
                    )}
                    {viewMode && <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />}
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
                                'h-full flex min-w-0 items-center gap-2 px-2.5 rounded-l-full border-r border-border/30 hover:bg-bg-secondary/40 transition-colors text-[11px] leading-none',
                                !activeProject && 'opacity-60',
                            )}
                            title="Open Project Hub"
                            onClick={() => {
                                setQuickEnvOpen(false);
                                emitCommand(DOM_EVENT.OPEN_PROJECT_HUB);
                            }}
                        >
                            <Layers3
                                size={14}
                                className={cn(
                                    'shrink-0 translate-y-[0.5px]',
                                    connectionStatus === 'connected'
                                        ? 'text-success'
                                        : connectionStatus === 'error'
                                            ? 'text-red-500 animate-pulse'
                                            : 'text-text-secondary',
                                )}
                            />
                            <span className="truncate max-w-[170px] text-text-primary font-semibold leading-none">
                                {activeProject?.name || 'No Project'}
                            </span>
                        </button>
                        <button
                            type="button"
                            className={cn(
                                'relative h-full flex min-w-0 flex-1 items-center gap-2 px-3 border-r border-border/30 cursor-pointer transition-all duration-200 leading-none',
                                !quickEnvOpen && !environmentSwitcherOpen && 'hover:text-text-primary hover:border-border',
                            )}
                            onClick={() => setQuickEnvOpen((current) => !current)}
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
                        <button
                            type="button"
                            className="relative h-full shrink-0 cursor-pointer flex items-center gap-1.5 px-2.5 rounded-r-full hover:bg-bg-secondary/40 transition-colors leading-none"
                            title="Configure environment bindings"
                            onClick={() => {
                                setQuickEnvOpen(false);
                                setEnvironmentSwitcherOpen(true);
                            }}
                        >
                            {activeProject && (
                                <span
                                    className={cn(
                                        'shrink-0 px-1.5 py-0.5 rounded-full border font-bold uppercase tracking-wider leading-none text-[10px]',
                                        envMeta.colorClass
                                    )}
                                >
                                    {activeEnvironmentKey || activeProject.default_environment_key}
                                </span>
                            )}
                            <SlidersHorizontal size={12} className="translate-y-[0.5px]" />
                        </button>

                        {quickEnvOpen && activeProject && (
                            <div className="absolute left-1/2 top-[calc(100%+6px)] z-dropdown w-2/3 min-w-[220px] -translate-x-1/2 rounded-lg border border-border/40 bg-bg-secondary shadow-xl p-2">
                                <div className="space-y-1">
                                    {quickEnvOptions.map((envKey, index) => {
                                        const meta = getEnvironmentMeta(envKey);
                                        const isActive = envKey === (activeEnvironmentKey || activeProject.default_environment_key);
                                        const isHighlighted = index === quickEnvHighlightedIndex;
                                        return (
                                            <button
                                                key={envKey}
                                                type="button"
                                                className={cn(
                                                    'w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] transition-colors',
                                                    isActive
                                                        ? 'bg-accent/10 border border-accent/35 text-text-primary'
                                                        : isHighlighted
                                                            ? 'bg-bg-primary/60 text-text-primary'
                                                            : 'hover:bg-bg-primary/50 text-text-secondary',
                                                )}
                                                onClick={() => void handleQuickSwitchEnv(envKey)}
                                                onMouseEnter={() => setQuickEnvHighlightedIndex(index)}
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className={cn('shrink-0 rounded-full border px-2 py-0.5 font-bold uppercase tracking-wider', meta.colorClass)}>
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
            {licenseOpen && <LicenseModal onClose={() => setLicenseOpen(false)} />}
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

