import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '../../ui';
import type { ResultContextCopyAsAction, ResultContextMenuPayload, ResultContextWhereAction } from './types';

const LAST_USED_COPY_AS_KEY = 'zentro.result.copyAs.lastAction';

interface ResultContextMenuProps {
    contextMenu: ResultContextMenuPayload | null;
    contextMenuRef: React.RefObject<HTMLDivElement>;
    contextMenuPosition: { left: number; top: number; submenuOpensLeft?: boolean } | null;
    canCopy: boolean;
    canPaste: boolean;
    canDuplicateRows: boolean;
    canSetNull: boolean;
    canDeleteRows: boolean;
    canOpenRowInNewQueryTab: boolean;
    canUndoLastContextAction: boolean;
    copyDisabledTitle: string;
    pasteDisabledTitle: string;
    duplicateDisabledTitle: string;
    setNullDisabledTitle: string;
    deleteDisabledTitle: string;
    openRowQueryDisabledTitle: string;
    undoDisabledTitle: string;
    copyAsActions: ResultContextCopyAsAction[];
    whereActions: ResultContextWhereAction[];
    onCopy: () => void;
    onPaste: () => void;
    onDeleteRow: () => void;
    onDuplicateRow: () => void;
    onSetNull: () => void;
    onOpenRowInNewQueryTab: () => void;
    onUndoLastContextAction: () => void;
}

type TopLevelItemId =
    | 'paste'
    | 'copy'
    | 'copy-as'
    | 'generate-where'
    | 'open-row-query'
    | 'duplicate'
    | 'set-null'
    | 'delete'
    | 'undo';

type SubmenuKind = 'copy-as' | null;

export const ResultContextMenu: React.FC<ResultContextMenuProps> = ({
    contextMenu,
    contextMenuRef,
    contextMenuPosition,
    canCopy,
    canPaste,
    canDuplicateRows,
    canSetNull,
    canDeleteRows,
    canOpenRowInNewQueryTab,
    canUndoLastContextAction,
    copyDisabledTitle,
    pasteDisabledTitle,
    duplicateDisabledTitle,
    setNullDisabledTitle,
    deleteDisabledTitle,
    openRowQueryDisabledTitle,
    undoDisabledTitle,
    copyAsActions,
    whereActions,
    onCopy,
    onPaste,
    onDeleteRow,
    onDuplicateRow,
    onSetNull,
    onOpenRowInNewQueryTab,
    onUndoLastContextAction,
}) => {
    const [openSubmenu, setOpenSubmenu] = React.useState<SubmenuKind>(null);
    const [activeTopIndex, setActiveTopIndex] = React.useState(0);
    const [activeCopyAsIndex, setActiveCopyAsIndex] = React.useState(0);
    const [lastUsedCopyAs, setLastUsedCopyAs] = React.useState<string>('');
    const [submenuTopOffset, setSubmenuTopOffset] = React.useState(0);

    const menuRef = React.useRef<HTMLDivElement>(null);
    const itemRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
    const focusTimerRef = React.useRef<number | null>(null);

    React.useEffect(() => {
        try {
            const saved = window.localStorage.getItem(LAST_USED_COPY_AS_KEY) || '';
            setLastUsedCopyAs(saved);
        } catch {
            setLastUsedCopyAs('');
        }
    }, []);

    const whereAction = whereActions[0] ?? null;

    const topItems = React.useMemo(() => ([
        { id: 'paste' as TopLevelItemId, label: 'Paste', shortcut: 'Ctrl+V', disabled: !canPaste, title: pasteDisabledTitle, onSelect: onPaste },
        { id: 'copy' as TopLevelItemId, label: 'Copy', shortcut: 'Ctrl+C', disabled: !canCopy, title: copyDisabledTitle, onSelect: onCopy },
        { id: 'copy-as' as TopLevelItemId, label: 'Copy as', shortcut: '', disabled: !canCopy, title: 'Choose copy format', onSelect: undefined, submenu: 'copy-as' as SubmenuKind },
        { id: 'generate-where' as TopLevelItemId, label: 'Generate WHERE (IN)', shortcut: '', disabled: !whereAction || whereAction.disabled, title: whereAction?.title ?? 'Generate WHERE IN from selected values', onSelect: whereAction?.onSelect },
        { id: 'open-row-query' as TopLevelItemId, label: 'Open Row in New Query Tab', shortcut: '', disabled: !canOpenRowInNewQueryTab, title: openRowQueryDisabledTitle, onSelect: onOpenRowInNewQueryTab },
        { id: 'duplicate' as TopLevelItemId, label: 'Duplicate Row', shortcut: '', disabled: !canDuplicateRows, title: duplicateDisabledTitle, onSelect: onDuplicateRow },
        { id: 'set-null' as TopLevelItemId, label: 'Set NULL', shortcut: '', disabled: !canSetNull, title: setNullDisabledTitle, onSelect: onSetNull },
        { id: 'delete' as TopLevelItemId, label: 'Delete Row', shortcut: 'Del', disabled: !canDeleteRows, title: deleteDisabledTitle, onSelect: onDeleteRow, danger: true },
        { id: 'undo' as TopLevelItemId, label: 'Undo Last Context Action', shortcut: 'Ctrl+Z', disabled: !canUndoLastContextAction, title: undoDisabledTitle, onSelect: onUndoLastContextAction },
    ]), [
        canCopy,
        canDeleteRows,
        canDuplicateRows,
        canOpenRowInNewQueryTab,
        canPaste,
        canSetNull,
        canUndoLastContextAction,
        copyDisabledTitle,
        deleteDisabledTitle,
        duplicateDisabledTitle,
        onCopy,
        onDeleteRow,
        onDuplicateRow,
        onOpenRowInNewQueryTab,
        onPaste,
        onSetNull,
        onUndoLastContextAction,
        openRowQueryDisabledTitle,
        pasteDisabledTitle,
        setNullDisabledTitle,
        undoDisabledTitle,
        whereAction,
    ]);

    React.useEffect(() => {
        if (!contextMenu) return;
        setOpenSubmenu(null);
        setActiveTopIndex(0);
        const preferredCopyIndex = copyAsActions.findIndex((item) => item.id === lastUsedCopyAs);
        setActiveCopyAsIndex(preferredCopyIndex >= 0 ? preferredCopyIndex : 0);
        if (focusTimerRef.current !== null) {
            window.clearTimeout(focusTimerRef.current);
        }
        focusTimerRef.current = window.setTimeout(() => {
            menuRef.current?.focus();
            focusTimerRef.current = null;
        }, 0);
        return () => {
            if (focusTimerRef.current !== null) {
                window.clearTimeout(focusTimerRef.current);
                focusTimerRef.current = null;
            }
        };
    }, [contextMenu, copyAsActions, lastUsedCopyAs]);

    const runCopyAs = React.useCallback((action: ResultContextCopyAsAction, index: number) => {
        if (action.disabled) return;
        action.onSelect();
        try {
            window.localStorage.setItem(LAST_USED_COPY_AS_KEY, action.id);
        } catch {
            // ignore localStorage failures
        }
        setLastUsedCopyAs(action.id);
        setActiveCopyAsIndex(index);
    }, []);

    const onMenuKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
        if (!topItems.length) return;
        const currentTop = topItems[activeTopIndex];
        const currentSubmenuItems = openSubmenu === 'copy-as' ? copyAsActions : [];

        if (event.key === 'Escape') {
            if (openSubmenu) {
                event.preventDefault();
                event.stopPropagation();
                setOpenSubmenu(null);
            }
            return;
        }

        if (openSubmenu && currentSubmenuItems.length > 0) {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveCopyAsIndex((prev) => (prev + 1) % copyAsActions.length);
                return;
            }
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveCopyAsIndex((prev) => (prev - 1 + copyAsActions.length) % copyAsActions.length);
                return;
            }
            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                setOpenSubmenu(null);
                return;
            }
            if (event.key === 'Enter') {
                event.preventDefault();
                const action = copyAsActions[activeCopyAsIndex];
                if (action) runCopyAs(action, activeCopyAsIndex);
                return;
            }
            return;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveTopIndex((prev) => (prev + 1) % topItems.length);
            return;
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveTopIndex((prev) => (prev - 1 + topItems.length) % topItems.length);
            return;
        }
        if (event.key === 'ArrowRight' && currentTop?.submenu) {
            if (copyAsActions.length > 0) {
                event.preventDefault();
                setOpenSubmenu(currentTop.submenu);
            }
            return;
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            if (currentTop?.submenu) {
                if (copyAsActions.length > 0) setOpenSubmenu(currentTop.submenu);
                return;
            }
            if (!currentTop?.disabled && currentTop?.onSelect) {
                currentTop.onSelect();
            }
        }
    }, [
        activeCopyAsIndex,
        activeTopIndex,
        copyAsActions,
        openSubmenu,
        runCopyAs,
        topItems,
    ]);

    if (!contextMenu || !contextMenuPosition) return null;

    const submenuItems = openSubmenu === 'copy-as' ? copyAsActions : [];
    const submenuSide = contextMenuPosition.submenuOpensLeft ? 'right-full mr-1' : 'left-full ml-1';

    return (
        <div
            ref={contextMenuRef}
            className="fixed z-panel-overlay"
            style={{ left: contextMenuPosition.left, top: contextMenuPosition.top }}
            onClick={(event) => event.stopPropagation()}
        >
            <div
                ref={menuRef}
                tabIndex={-1}
                onKeyDown={onMenuKeyDown}
                className="relative w-56 rounded-sm border border-border bg-background py-1 shadow-lg outline-none"
            >
                {topItems.map((item, index) => {
                    const isActive = activeTopIndex === index;
                    const itemClass = item.danger
                        ? 'text-destructive hover:bg-muted'
                        : 'text-foreground hover:bg-muted';
                    return (
                        <Button
                            key={item.id}
                            ref={(el) => { itemRefs.current[index] = el; }}
                            type="button"
                            variant="ghost"
                            title={item.title}
                            className={`h-auto w-full justify-between rounded-none px-3 py-1.5 text-left text-[12px] ${item.disabled ? 'text-muted-foreground cursor-not-allowed' : itemClass} ${isActive ? 'bg-muted/60' : ''}`}
                            disabled={item.disabled}
                            onMouseEnter={() => {
                                setActiveTopIndex(index);
                                if (item.submenu && !item.disabled) {
                                    setOpenSubmenu(item.submenu);
                                    const btn = itemRefs.current[index];
                                    const menu = menuRef.current;
                                    if (btn && menu) {
                                        const btnRect = btn.getBoundingClientRect();
                                        const menuRect = menu.getBoundingClientRect();
                                        setSubmenuTopOffset(btnRect.top - menuRect.top);
                                    }
                                } else {
                                    setOpenSubmenu(null);
                                }
                            }}
                            onClick={() => {
                                if (item.submenu) {
                                    if (!item.disabled) {
                                        setOpenSubmenu((prev) => (prev === item.submenu ? null : item.submenu));
                                    }
                                    return;
                                }
                                item.onSelect?.();
                            }}
                        >
                            <span>{item.label}</span>
                            <span className="ml-3 flex items-center gap-2 text-[10px] text-muted-foreground">
                                {item.shortcut ? <span>{item.shortcut}</span> : null}
                                {item.submenu ? <ChevronRight size={12} /> : null}
                            </span>
                        </Button>
                    );
                })}

                {openSubmenu && submenuItems.length > 0 && (
                    <div
                        className={`absolute ${submenuSide} w-56 rounded-sm border border-border bg-background py-1 shadow-lg`}
                        style={{ top: submenuTopOffset }}
                        onMouseEnter={() => setOpenSubmenu(openSubmenu)}
                    >
                        {submenuItems.map((action, index) => {
                            const isActive = activeCopyAsIndex === index;
                            const isLastUsedCopyAction = action.id === lastUsedCopyAs;
                            return (
                                <Button
                                    key={action.id}
                                    type="button"
                                    variant="ghost"
                                    title={action.title}
                                    className={`h-auto w-full justify-between rounded-none px-3 py-1.5 text-left text-[12px] ${action.disabled ? 'text-muted-foreground cursor-not-allowed' : 'text-foreground hover:bg-muted'} ${isActive ? 'bg-muted/60' : ''}`}
                                    disabled={action.disabled}
                                    onMouseEnter={() => setActiveCopyAsIndex(index)}
                                    onClick={() => runCopyAs(action, index)}
                                >
                                    <span>{action.label}</span>
                                    <span className="text-[10px] text-muted-foreground">{isLastUsedCopyAction ? 'Last used' : ''}</span>
                                </Button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
