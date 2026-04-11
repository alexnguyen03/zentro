import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../../lib/cn';
import { useShortcutStore } from '../../../stores/shortcutStore';
import { useEditorStore } from '../../../stores/editorStore';
import { useUpdateCheck } from '../../../hooks/useUpdateCheck';
import { useToast } from '../Toast';
import { AppMenuItem, AppMenuSection, buildAppMenuSections } from './appMenuSections';
import type { CommandId } from '../../../lib/shortcutRegistry';
import { Button } from '../../ui';

interface AppMenuProps {
    /** Logo element placed as the trigger button content */
    trigger: React.ReactNode;
    onOpenAbout: () => void;
    onOpenLicense: () => void;
    onOpenUpdateModal: (open: boolean) => void;
    hasUpdate: boolean;
    updateInfo: ReturnType<typeof useUpdateCheck>['updateInfo'];
    isChecking: boolean;
    check: ReturnType<typeof useUpdateCheck>['check'];
    dismiss: ReturnType<typeof useUpdateCheck>['dismiss'];
}

/**
 * Self-contained hamburger app menu with a two-level flyout panel.
 * All keyboard navigation, hover timers, and submenu positioning live here.
 */
export const AppMenu: React.FC<AppMenuProps> = ({
    trigger,
    onOpenAbout,
    onOpenLicense,
    onOpenUpdateModal,
    hasUpdate,
    isChecking,
    check,
    dismiss: _dismiss,
}) => {
    const shortcutBindings = useShortcutStore((s) => s.bindings);
    const { groups, activeGroupId } = useEditorStore();
    const { toast } = useToast();

    const [open, setOpen] = useState(false);
    const [activeSectionIndex, setActiveSectionIndex] = useState<number | null>(null);
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const [submenuTop, setSubmenuTop] = useState(0);

    const menuRef = useRef<HTMLDivElement | null>(null);
    const parentPanelRef = useRef<HTMLDivElement | null>(null);
    const sectionButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const hideTimerRef = useRef<number | null>(null);

    // Derived
    const activeGroup = groups.find((g) => g.id === activeGroupId);
    const activeTab = activeGroup?.tabs.find((t) => t.id === activeGroup.activeTabId);
    const isQueryTab = activeTab?.type === 'query';

    const getShortcut = useCallback((commandId: CommandId) => shortcutBindings[commandId] || '', [shortcutBindings]);

    const handleManualCheckForUpdates = useCallback(async () => {
        const result = await check(true);
        if (result === undefined) { toast.error('Could not check for updates.'); return; }
        if (result?.has_update) { onOpenUpdateModal(true); return; }
        toast.success('You are already on the latest version.');
    }, [check, onOpenUpdateModal, toast]);

    const sections = useMemo<AppMenuSection[]>(
        () => buildAppMenuSections({
            getShortcut,
            isQueryTab,
            isChecking,
            hasUpdate,
            onCheckForUpdates: handleManualCheckForUpdates,
            onOpenAbout: () => { setOpen(false); onOpenAbout(); },
            onOpenLicense: () => { setOpen(false); onOpenLicense(); },
        }),
        [getShortcut, isQueryTab, isChecking, hasUpdate, handleManualCheckForUpdates, onOpenAbout, onOpenLicense],
    );

    const activeSection = activeSectionIndex !== null ? (sections[activeSectionIndex] ?? null) : null;

    // ── Timer helpers ─────────────────────────────────────────────────────────
    const clearHideTimer = useCallback(() => {
        if (hideTimerRef.current !== null) { window.clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
    }, []);

    const scheduleHide = useCallback(() => {
        clearHideTimer();
        hideTimerRef.current = window.setTimeout(() => { setActiveSectionIndex(null); hideTimerRef.current = null; }, 120);
    }, [clearHideTimer]);

    // ── Close on outside click ────────────────────────────────────────────────
    useEffect(() => {
        if (!open) return;
        const onMouseDown = (e: MouseEvent) => {
            if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
        };
        window.addEventListener('mousedown', onMouseDown);
        return () => window.removeEventListener('mousedown', onMouseDown);
    }, [open]);

    // ── Reset state on close ──────────────────────────────────────────────────
    useEffect(() => {
        if (open) return;
        clearHideTimer();
        setActiveSectionIndex(null);
        setHighlightedIndex(0);
        setSubmenuTop(0);
    }, [clearHideTimer, open]);

    useEffect(() => () => clearHideTimer(), [clearHideTimer]);

    // ── Section activation ────────────────────────────────────────────────────
    const activateSection = useCallback((sectionIndex: number, anchor?: HTMLElement | null) => {
        const section = sections[sectionIndex];
        if (!section) return;
        const panel = parentPanelRef.current;
        const btn = anchor ?? sectionButtonRefs.current[sectionIndex] ?? null;
        if (panel && btn) {
            const pRect = panel.getBoundingClientRect();
            const bRect = btn.getBoundingClientRect();
            setSubmenuTop(Math.max(0, bRect.top - pRect.top));
        } else {
            setSubmenuTop(0);
        }
        setActiveSectionIndex(sectionIndex);
        const firstEnabled = section.items.findIndex((item) => !item.disabled);
        setHighlightedIndex(firstEnabled >= 0 ? firstEnabled : 0);
    }, [sections]);

    // ── Find next enabled item ────────────────────────────────────────────────
    const findNextEnabled = useCallback((items: AppMenuItem[], from: number, dir: 1 | -1) => {
        let next = from;
        for (let i = 0; i < items.length; i += 1) {
            next = (next + dir + items.length) % items.length;
            if (!items[next]?.disabled) return next;
        }
        return Math.max(0, from);
    }, []);

    // ── Item execution ────────────────────────────────────────────────────────
    const selectItem = useCallback((item: AppMenuItem) => {
        if (item.disabled) return;
        setOpen(false);
        Promise.resolve(item.action()).catch((err) => toast.error(`Action failed: ${err}`));
    }, [toast]);

    // ── Keyboard navigation ───────────────────────────────────────────────────
    useEffect(() => {
        if (!open) return;
        const items = activeSection?.items || [];
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (!activeSection) { activateSection(0); return; }
                setHighlightedIndex((c) => findNextEnabled(items, c, 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (!activeSection) { activateSection(0); return; }
                setHighlightedIndex((c) => findNextEnabled(items, c, -1));
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                activateSection(activeSectionIndex === null ? 0 : (activeSectionIndex + 1) % sections.length);
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                if (activeSectionIndex !== null) activateSection((activeSectionIndex - 1 + sections.length) % sections.length);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const target = items[highlightedIndex];
                if (target) selectItem(target);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                setOpen(false);
            }
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
    }, [activateSection, activeSection, activeSectionIndex, findNextEnabled, highlightedIndex, open, sections.length, selectItem]);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div ref={menuRef} className="relative">
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn('flex items-center justify-center w-6 h-6 mr-1 cursor-pointer hover:opacity-80 transition-opacity relative rounded-sm', open && 'bg-background/60')}
                title="Open app menu"
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => {
                    clearHideTimer();
                    setOpen((current) => {
                        if (current) return false;
                        setActiveSectionIndex(null);
                        setHighlightedIndex(0);
                        setSubmenuTop(0);
                        return true;
                    });
                }}
            >
                {trigger}
                {hasUpdate && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-success rounded-full border border-bg-secondary animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                )}
            </Button>

            {open && (
                <div className="absolute left-0 top-[calc(100%+6px)] z-toolbar">
                    {/* Section list */}
                    <div
                        ref={parentPanelRef}
                        className="w-[190px] rounded-sm bg-card/95 shadow-2xl p-2"
                        onMouseEnter={clearHideTimer}
                        onMouseLeave={scheduleHide}
                    >
                        <div className="space-y-0.5">
                            {sections.map((section, sectionIndex) => {
                                const isActive = sectionIndex === activeSectionIndex;
                                return (
                                    <Button
                                        ref={(el) => { sectionButtonRefs.current[sectionIndex] = el; }}
                                        key={section.id}
                                        type="button"
                                        variant="ghost"
                                        className={cn(
                                            'h-auto w-full items-center justify-between rounded-sm px-2 py-1.5 text-[13px] transition-colors',
                                            isActive ? 'bg-accent/12 text-foreground' : 'text-muted-foreground hover:bg-card/80 hover:text-foreground',
                                        )}
                                        onMouseEnter={(e) => { clearHideTimer(); activateSection(sectionIndex, e.currentTarget); }}
                                        onFocus={(e) => activateSection(sectionIndex, e.currentTarget)}
                                        onClick={(e) => activateSection(sectionIndex, e.currentTarget)}
                                    >
                                        <span>{section.title}</span>
                                        <ChevronRight size={12} className={cn(isActive ? 'text-accent' : 'text-muted-foreground')} />
                                    </Button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Submenu */}
                    {activeSection && (
                        <div
                            className="absolute left-[194px] z-toolbar w-[320px] rounded-sm bg-card/95 shadow-2xl p-2"
                            style={{ top: submenuTop }}
                            onMouseEnter={clearHideTimer}
                            onMouseLeave={scheduleHide}
                        >
                            <div className="space-y-0.5">
                                {activeSection.items.map((item, itemIndex) => {
                                    const isHighlighted = itemIndex === highlightedIndex;
                                    return (
                                        <Button
                                            key={item.id}
                                            type="button"
                                            variant="ghost"
                                            disabled={item.disabled}
                                            className={cn(
                                                'h-auto w-full items-center justify-between gap-2 rounded-sm px-2.5 py-1.5 text-[12px] transition-colors',
                                                item.disabled
                                                    ? 'opacity-45 cursor-not-allowed text-muted-foreground'
                                                    : isHighlighted
                                                        ? item.danger ? 'bg-error/15 text-error' : 'bg-accent/10 text-foreground'
                                                        : item.danger ? 'text-error/80 hover:bg-error/10 hover:text-error' : 'text-muted-foreground hover:bg-card/80 hover:text-foreground',
                                            )}
                                            onMouseEnter={() => setHighlightedIndex(itemIndex)}
                                            onClick={() => selectItem(item)}
                                        >
                                            <span className="inline-flex items-center gap-1.5">
                                                <span>{item.label}</span>
                                                {item.hasBadge && <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />}
                                            </span>
                                            {item.shortcut && <span className="text-[10px] font-mono text-muted-foreground">{item.shortcut}</span>}
                                        </Button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
