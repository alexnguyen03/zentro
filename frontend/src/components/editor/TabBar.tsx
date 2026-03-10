import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, X, BookMarked, SplitSquareHorizontal, Table2 } from 'lucide-react';
import { Tab } from '../../stores/editorStore';
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '../../lib/cn';

interface TabBarProps {
    groupId: string;
    tabs: Tab[];
    activeTabId: string | null;
    onActivate: (id: string) => void;
    onClose: (id: string) => void;
    onNewTab: () => void;
    onRename: (id: string, newName: string) => void;
    onSaveScript: (tabId: string, scriptName: string) => void;
    onSplit?: (tabId: string) => void;
}

interface ContextMenu {
    x: number;
    y: number;
    tabId: string;
}

// ── Sortable Tab Item ──────────────────────────────────────────────────
interface SortableTabItemProps {
    tab: Tab;
    groupId: string;
    isActive: boolean;
    renamingId: string | null;
    renameValue: string;
    renameInputRef: React.RefObject<HTMLInputElement>;
    onActivate: () => void;
    onDoubleClick: () => void;
    onContextMenu: (e: React.MouseEvent) => void;
    onRenameChange: (val: string) => void;
    onRenameBlur: () => void;
    onRenameKeyDown: (e: React.KeyboardEvent) => void;
    onClose: () => void;
}

const SortableTabItem: React.FC<SortableTabItemProps> = ({
    tab, groupId, isActive, renamingId, renameValue, renameInputRef,
    onActivate, onDoubleClick, onContextMenu, onRenameChange, onRenameBlur, onRenameKeyDown, onClose
}) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: tab.id,
        data: {
            type: 'Tab',
            tab,
            groupId,
        }
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 100 : undefined,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={cn(
                'group flex items-center h-full gap-1.5 px-2.5 pl-3.5 cursor-pointer border-r border-r-border text-xs text-text-secondary select-none whitespace-nowrap border-t-2 border-t-transparent mb-0 flex-shrink-0 hover:text-text-primary',
                isActive && 'bg-bg-primary text-text-primary border-t-success mb-[-1px] border-b border-b-bg-primary'
            )}
            onClick={onActivate}
            onDoubleClick={onDoubleClick}
            onContextMenu={onContextMenu}
        >
            {renamingId === tab.id ? (
                <input
                    ref={renameInputRef}
                    className="flex-1 bg-bg-tertiary border border-success text-text-primary text-xs px-1 py-[1px] rounded-sm outline-none w-full"
                    value={renameValue}
                    onChange={(e) => onRenameChange(e.target.value)}
                    onBlur={onRenameBlur}
                    onKeyDown={onRenameKeyDown}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                />
            ) : (
                <span className="overflow-hidden text-ellipsis" title={tab.name}>
                    {tab.type === 'table' && <Table2 size={12} style={{ marginRight: 6, display: 'inline-block', verticalAlign: 'middle' }} />}
                    {tab.name}
                </span>
            )}
            {tab.isRunning && <span className="w-1.5 h-1.5 rounded-full bg-success flex-shrink-0 animate-pulse" title="Running" />}
            <button
                className="bg-transparent border-none text-text-secondary cursor-pointer flex items-center p-0.5 rounded-sm opacity-0 transition-opacity duration-100 flex-shrink-0 group-hover:opacity-100 hover:bg-bg-tertiary hover:text-text-primary"
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                onPointerDown={(e) => e.stopPropagation()} // Prevent drag start when clicking close
                title="Close tab"
            >
                <X size={12} />
            </button>
        </div>
    );
};

// ── Tab Bar ─────────────────────────────────────────────────────────────
export const TabBar: React.FC<TabBarProps> = ({
    groupId,
    tabs,
    activeTabId,
    onActivate,
    onClose,
    onNewTab,
    onRename,
    onSaveScript,
    onSplit,
}) => {
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
    const [savePrompt, setSavePrompt] = useState<{ tabId: string } | null>(null);
    const [saveNameValue, setSaveNameValue] = useState('');
    const renameInputRef = useRef<HTMLInputElement>(null);
    const saveInputRef = useRef<HTMLInputElement>(null);
    const tabsScrollRef = useRef<HTMLDivElement>(null);

    // Make the empty space droppable for cross-group drags to an empty pane
    const { setNodeRef: setDroppableRef } = useDroppable({
        id: `group-drop-${groupId}`,
        data: {
            type: 'Group',
            groupId,
        }
    });

    // Auto-focus rename input
    useEffect(() => {
        if (renamingId && renameInputRef.current) {
            renameInputRef.current.focus();
            renameInputRef.current.select();
        }
    }, [renamingId]);

    // Auto-scroll active tab into view
    useEffect(() => {
        if (!activeTabId || !tabsScrollRef.current) return;
        // active tab now has 'bg-bg-primary' class instead of 'active'
        const activeEl = tabsScrollRef.current.querySelector<HTMLElement>('.bg-bg-primary');
        activeEl?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }, [activeTabId]);

    // Convert vertical wheel to horizontal scroll (VS Code style)
    useEffect(() => {
        const el = tabsScrollRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            if (e.deltaY !== 0) {
                e.preventDefault();
                el.scrollLeft += e.deltaY;
            }
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, []);

    // Ctrl+Tab / Ctrl+Shift+Tab — cycle tabs in this group
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (!e.ctrlKey || e.key !== 'Tab') return;
            if (tabs.length < 2) return;
            e.preventDefault();
            const idx = tabs.findIndex(t => t.id === activeTabId);
            const next = e.shiftKey
                ? (idx - 1 + tabs.length) % tabs.length
                : (idx + 1) % tabs.length;
            onActivate(tabs[next].id);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [tabs, activeTabId, onActivate]);

    // Auto-focus save prompt input
    useEffect(() => {
        if (savePrompt && saveInputRef.current) {
            saveInputRef.current.focus();
            saveInputRef.current.select();
        }
    }, [savePrompt]);

    // Listen to Ctrl+S custom event from QueryGroup/QueryTabs
    useEffect(() => {
        const handler = (e: Event) => {
            const tabId = (e as CustomEvent<string>).detail;
            const tab = tabs.find(t => t.id === tabId);
            if (tab) {
                setSaveNameValue(tab.name ?? '');
                setSavePrompt({ tabId });
            }
        };
        window.addEventListener('zentro:save-script', handler);
        return () => window.removeEventListener('zentro:save-script', handler);
    }, [tabs]);

    // Listen to F2 rename custom hook
    useEffect(() => {
        const handler = (e: Event) => {
            const tabId = (e as CustomEvent<string>).detail;
            const tab = tabs.find(t => t.id === tabId);
            if (tab) {
                setRenamingId(tab.id);
                setRenameValue(tab.name);
            }
        };
        window.addEventListener('zentro:rename-tab', handler);
        return () => window.removeEventListener('zentro:rename-tab', handler);
    }, [tabs]);

    // Close context menu on outside click
    useEffect(() => {
        const handler = () => setContextMenu(null);
        window.addEventListener('click', handler);
        return () => window.removeEventListener('click', handler);
    }, []);

    const startRename = useCallback((tab: Tab) => {
        setRenamingId(tab.id);
        setRenameValue(tab.name);
    }, []);

    const commitRename = useCallback(() => {
        if (renamingId && renameValue.trim()) {
            onRename(renamingId, renameValue.trim());
        }
        setRenamingId(null);
    }, [renamingId, renameValue, onRename]);

    const handleTabKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') commitRename();
        if (e.key === 'Escape') setRenamingId(null);
    }, [commitRename]);

    const handleTabContextMenu = (e: React.MouseEvent, tabId: string) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, tabId });
    };

    const closeOthers = (tabId: string) => {
        tabs.filter(t => t.id !== tabId).forEach(t => onClose(t.id));
        setContextMenu(null);
    };

    const closeAll = () => {
        tabs.forEach(t => onClose(t.id));
        setContextMenu(null);
    };

    return (
        <div className="flex items-center bg-bg-secondary border-b border-border h-9 flex-shrink-0 overflow-hidden">
            <div
                className="flex h-full items-stretch flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:h-px [&::-webkit-scrollbar]:opacity-0 transition-opacity [&:hover::-webkit-scrollbar]:opacity-100 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-sm [&:hover::-webkit-scrollbar-thumb]:bg-border"
                ref={(el) => { setDroppableRef(el); (tabsScrollRef as React.MutableRefObject<HTMLDivElement | null>).current = el; }}
            >
                <SortableContext items={tabs.map(t => t.id)} strategy={horizontalListSortingStrategy}>
                    {tabs.map(tab => (
                        <SortableTabItem
                            key={tab.id}
                            tab={tab}
                            groupId={groupId}
                            isActive={tab.id === activeTabId}
                            renamingId={renamingId}
                            renameValue={renameValue}
                            renameInputRef={renameInputRef}
                            onActivate={() => onActivate(tab.id)}
                            onDoubleClick={() => startRename(tab)}
                            onContextMenu={(e) => handleTabContextMenu(e, tab.id)}
                            onRenameChange={setRenameValue}
                            onRenameBlur={commitRename}
                            onRenameKeyDown={handleTabKeyDown}
                            onClose={() => onClose(tab.id)}
                        />
                    ))}
                </SortableContext>
            </div>

            <button className="bg-transparent border-none text-text-secondary cursor-pointer px-2.5 py-1.5 flex items-center flex-shrink-0 transition-colors duration-100 hover:text-text-primary" onClick={onNewTab} title="New Tab (Ctrl+T)">
                <Plus size={14} />
            </button>

            {/* Save script prompt */}
            {savePrompt && (
                <div
                    className="flex items-center gap-1 px-2 bg-bg-secondary border-l border-border flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                >
                    <input
                        ref={saveInputRef}
                        className="bg-bg-primary border border-success text-text-primary text-[11px] px-1.5 py-[3px] rounded-sm outline-none w-40"
                        placeholder="Script name…"
                        value={saveNameValue}
                        onChange={(e) => setSaveNameValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && saveNameValue.trim()) {
                                onSaveScript(savePrompt.tabId, saveNameValue.trim());
                                setSavePrompt(null);
                                setSaveNameValue('');
                            }
                            if (e.key === 'Escape') {
                                setSavePrompt(null);
                                setSaveNameValue('');
                            }
                        }}
                    />
                    <button
                        className="bg-success border-none text-white text-[11px] font-semibold px-2.5 py-[3px] rounded-sm cursor-pointer transition-opacity duration-100 hover:opacity-85"
                        onClick={() => {
                            if (saveNameValue.trim()) {
                                onSaveScript(savePrompt.tabId, saveNameValue.trim());
                                setSavePrompt(null);
                                setSaveNameValue('');
                            }
                        }}
                    >
                        Save
                    </button>
                    <button
                        className="bg-transparent border-none text-text-secondary text-[13px] leading-none cursor-pointer px-1 py-0.5 rounded-sm transition-colors duration-100 hover:text-text-primary"
                        onClick={() => { setSavePrompt(null); setSaveNameValue(''); }}
                    >
                        ✕
                    </button>
                </div>
            )}

            {contextMenu && (
                <div
                    className="fixed bg-bg-secondary border border-border shadow-[0_2px_8px_rgba(0,0,0,0.3)] py-1 rounded-[4px] z-[1000] min-w-[150px]"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div
                        className="px-4 py-1.5 text-[13px] cursor-pointer hover:bg-success hover:text-white"
                        onClick={() => { const t = tabs.find(t => t.id === contextMenu!.tabId); if (t) startRename(t); setContextMenu(null); }}
                    >
                        Rename
                    </div>

                    {onSplit && (
                        <div
                            className="px-4 py-1.5 text-[13px] cursor-pointer flex items-center hover:bg-success hover:text-white"
                            onClick={() => { onSplit(contextMenu!.tabId); setContextMenu(null); }}
                        >
                            <SplitSquareHorizontal size={11} style={{ marginRight: 5 }} />
                            Split Right
                        </div>
                    )}

                    <div
                        className="px-4 py-1.5 text-[13px] cursor-pointer flex items-center text-success hover:bg-success hover:text-white"
                        onClick={() => {
                            const tab = tabs.find(t => t.id === contextMenu!.tabId);
                            setSaveNameValue(tab?.name ?? '');
                            setSavePrompt({ tabId: contextMenu!.tabId });
                            setContextMenu(null);
                        }}
                    >
                        <BookMarked size={11} style={{ marginRight: 5 }} />
                        Save Script
                    </div>

                    <div className="h-px bg-border my-1" />

                    <div className="px-4 py-1.5 text-[13px] cursor-pointer hover:bg-success hover:text-white" onClick={() => { onClose(contextMenu!.tabId); setContextMenu(null); }}>
                        Close
                    </div>
                    <div className="px-4 py-1.5 text-[13px] cursor-pointer hover:bg-success hover:text-white" onClick={() => closeOthers(contextMenu!.tabId)}>
                        Close Others
                    </div>
                    <div className="px-4 py-1.5 text-[13px] cursor-pointer hover:bg-success hover:text-white" onClick={closeAll}>
                        Close All
                    </div>
                </div>
            )}
        </div>
    );
};
