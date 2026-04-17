import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, X, SplitSquareHorizontal, Table2 } from 'lucide-react';
import { Tab } from '../../stores/editorStore';
import { DOM_EVENT } from '../../lib/constants';
import { onCommand } from '../../lib/commandBus';
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '../../lib/cn';
import { useToast } from '../layout/Toast';
import { Button, Input } from '../ui';

interface TabBarProps {
    groupId: string;
    tabs: Tab[];
    activeTabId: string | null;
    onActivate: (id: string) => void;
    onClose: (id: string) => void;
    onNewTab: () => void;
    onRename: (id: string, newName: string) => void;
    onSplit?: (tabId: string) => void;
}

interface ContextMenu {
    x: number;
    y: number;
    tabId: string;
}

const canRenameTab = (tab: Tab): boolean => tab.type === 'query';

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
        zIndex: isDragging ? 'var(--layer-drag)' : undefined,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={cn(
                'group flex items-center h-full gap-1.5 px-2 cursor-pointer border-r border-r-border text-xs text-muted-foreground select-none whitespace-nowrap border-t-2 border-t-transparent mb-0 shrink-0 hover:text-foreground',
                isActive && 'bg-background -mb-px text-primary'
            )}
            onClick={onActivate}
            onDoubleClick={onDoubleClick}
            onContextMenu={onContextMenu}
        >
            {renamingId === tab.id ? (
                <Input
                    ref={renameInputRef}
                    className="rt-cell-input h-[24px]! px-1.5! text-xs! min-w-30 font-sans"
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
            {tab.isRunning && <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0 animate-pulse" title="Running" />}
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-5 w-5 p-0.5 text-muted-foreground opacity-0 transition-opacity duration-100 shrink-0 group-hover:opacity-100 hover:bg-muted hover:text-foreground"
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                onPointerDown={(e) => e.stopPropagation()} // Prevent drag start when clicking close
                title="Close tab"
            >
                <X size={12} />
            </Button>
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
    onSplit,
}) => {
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
    const { toast } = useToast();
    const renameInputRef = useRef<HTMLInputElement>(null);
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
        // active tab now has 'bg-background' class instead of 'active'
        const activeEl = tabsScrollRef.current.querySelector<HTMLElement>('.bg-background');
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

    // Listen to F2 rename custom hook
    useEffect(() => {
        const off = onCommand(DOM_EVENT.RENAME_TAB, (tabId) => {
            const tab = tabs.find(t => t.id === tabId);
            if (tab && canRenameTab(tab)) {
                setRenamingId(tab.id);
                setRenameValue(tab.name);
            }
        });
        return off;
    }, [tabs]);

    // Close context menu on outside click
    useEffect(() => {
        const handler = () => setContextMenu(null);
        window.addEventListener('click', handler);
        return () => window.removeEventListener('click', handler);
    }, []);

    const startRename = useCallback((tab: Tab) => {
        if (!canRenameTab(tab)) return;
        setRenamingId(tab.id);
        setRenameValue(tab.name);
    }, []);

    const commitRename = useCallback(() => {
        if (!renamingId) {
            setRenamingId(null);
            return;
        }

        const nextName = renameValue.trim();
        if (!nextName) {
            setRenamingId(null);
            return;
        }

        const normalizedNextName = nextName.toLowerCase();
        const hasDuplicate = tabs.some((tab) =>
            tab.id !== renamingId &&
            canRenameTab(tab) &&
            tab.name.trim().toLowerCase() === normalizedNextName);
        if (hasDuplicate) {
            toast.error('Tên tab đã tồn tại. Vui lòng đặt tên khác.');
            renameInputRef.current?.focus();
            renameInputRef.current?.select();
            return;
        }

        onRename(renamingId, nextName);
        setRenamingId(null);
    }, [onRename, renameValue, renamingId, tabs, toast]);

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

    const contextMenuItemClass = 'h-auto w-full justify-start rounded-none px-4 py-1.5 text-[13px]';

    return (
        <div className="flex items-center bg-card h-8 shrink-0 overflow-hidden">
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

            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-full w-9 shrink-0 rounded-none px-2.5 py-1.5 text-muted-foreground transition-colors duration-100 hover:text-foreground"
                onClick={onNewTab}
                title="New Tab (Ctrl+T)"
            >
                <Plus size={14} />
            </Button>


            {contextMenu && (
                <div
                    className="fixed z-popover min-w-[150px] rounded-sm border border-border bg-card py-1 shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {(() => {
                        const contextTab = tabs.find((tab) => tab.id === contextMenu.tabId);
                        if (!contextTab || !canRenameTab(contextTab)) return null;
                        return (
                            <Button
                                type="button"
                                variant="ghost"
                                className={contextMenuItemClass}
                                onClick={() => { startRename(contextTab); setContextMenu(null); }}
                            >
                                Rename
                            </Button>
                        );
                    })()}

                    {onSplit && (
                        <Button
                            type="button"
                            variant="ghost"
                            className={cn(contextMenuItemClass, 'gap-1.5')}
                            onClick={() => { onSplit(contextMenu!.tabId); setContextMenu(null); }}
                        >
                            <SplitSquareHorizontal size={11} />
                            Split Right
                        </Button>
                    )}



                    <div className="h-px bg-border my-1" />

                    <Button
                        type="button"
                        variant="ghost"
                        className={contextMenuItemClass}
                        onClick={() => { onClose(contextMenu!.tabId); setContextMenu(null); }}
                    >
                        Close
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        className={contextMenuItemClass}
                        onClick={() => closeOthers(contextMenu!.tabId)}
                    >
                        Close Others
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        className={contextMenuItemClass}
                        onClick={closeAll}
                    >
                        Close All
                    </Button>
                </div>
            )}
        </div>
    );
};
