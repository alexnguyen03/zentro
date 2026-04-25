import React from 'react';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuShortcut,
    ContextMenuSub,
    ContextMenuSubContent,
    ContextMenuSubTrigger,
    ContextMenuTrigger,
} from '../../ui';
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
    const [lastUsedCopyAs, setLastUsedCopyAs] = React.useState<string>('');
    const triggerRef = React.useRef<HTMLDivElement>(null);
    const menuItemClass = 'h-7 px-2 py-0 leading-none';

    React.useEffect(() => {
        try {
            const saved = window.localStorage.getItem(LAST_USED_COPY_AS_KEY) || '';
            setLastUsedCopyAs(saved);
        } catch {
            setLastUsedCopyAs('');
        }
    }, []);

    const runCopyAs = React.useCallback((action: ResultContextCopyAsAction) => {
        if (action.disabled) return;
        action.onSelect();
        try {
            window.localStorage.setItem(LAST_USED_COPY_AS_KEY, action.id);
        } catch {
            // ignore localStorage failures
        }
        setLastUsedCopyAs(action.id);
    }, []);

    const whereAction = whereActions[0] ?? null;

    React.useEffect(() => {
        if (!contextMenu || !contextMenuPosition) return;
        const trigger = triggerRef.current;
        if (!trigger) return;
        const event = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            button: 2,
            clientX: contextMenuPosition.left,
            clientY: contextMenuPosition.top,
        });
        trigger.dispatchEvent(event);
    }, [contextMenu, contextMenuPosition]);

    if (!contextMenu || !contextMenuPosition) return null;

    return (
        <div
            className="fixed z-panel-overlay pointer-events-none"
            style={{ left: contextMenuPosition.left, top: contextMenuPosition.top }}
        >
            <ContextMenu modal={false}>
                <ContextMenuTrigger asChild>
                    <div ref={triggerRef} className="h-px w-px" />
                </ContextMenuTrigger>
                <ContextMenuContent
                    ref={contextMenuRef}
                    className="w-56 pointer-events-auto"
                    onCloseAutoFocus={(event: Event) => event.preventDefault()}
                >
                    <ContextMenuItem
                        className={menuItemClass}
                        title={pasteDisabledTitle}
                        disabled={!canPaste}
                        onSelect={onPaste}
                    >
                        Paste
                        <ContextMenuShortcut>Ctrl+V</ContextMenuShortcut>
                    </ContextMenuItem>
                    <ContextMenuItem
                        className={menuItemClass}
                        title={copyDisabledTitle}
                        disabled={!canCopy}
                        onSelect={onCopy}
                    >
                        Copy
                        <ContextMenuShortcut>Ctrl+C</ContextMenuShortcut>
                    </ContextMenuItem>

                    <ContextMenuSub>
                        <ContextMenuSubTrigger
                            className={menuItemClass}
                            title="Choose copy format"
                            disabled={!canCopy}
                        >
                            Copy as
                        </ContextMenuSubTrigger>
                        <ContextMenuSubContent className="w-56">
                            {copyAsActions.map((action) => (
                                <ContextMenuItem
                                    key={action.id}
                                    className={menuItemClass}
                                    title={action.title}
                                    disabled={action.disabled}
                                    onSelect={() => runCopyAs(action)}
                                >
                                    <span>{action.label}</span>
                                    <span className="ml-auto text-label text-muted-foreground">
                                        {action.id === lastUsedCopyAs ? 'Last used' : ''}
                                    </span>
                                </ContextMenuItem>
                            ))}
                        </ContextMenuSubContent>
                    </ContextMenuSub>

                    <ContextMenuItem
                        className={menuItemClass}
                        title={whereAction?.title ?? 'Generate WHERE IN from selected values'}
                        disabled={!whereAction || whereAction.disabled}
                        onSelect={() => whereAction?.onSelect?.()}
                    >
                        Generate WHERE (IN)
                    </ContextMenuItem>
                    <ContextMenuItem
                        className={menuItemClass}
                        title={openRowQueryDisabledTitle}
                        disabled={!canOpenRowInNewQueryTab}
                        onSelect={onOpenRowInNewQueryTab}
                    >
                        Open Row in New Query Tab
                    </ContextMenuItem>
                    <ContextMenuItem
                        className={menuItemClass}
                        title={duplicateDisabledTitle}
                        disabled={!canDuplicateRows}
                        onSelect={onDuplicateRow}
                    >
                        Duplicate Row
                    </ContextMenuItem>
                    <ContextMenuItem
                        className={menuItemClass}
                        title={setNullDisabledTitle}
                        disabled={!canSetNull}
                        onSelect={onSetNull}
                    >
                        Set NULL
                    </ContextMenuItem>
                    <ContextMenuItem
                        title={deleteDisabledTitle}
                        disabled={!canDeleteRows}
                        className={`${menuItemClass} text-destructive focus:text-destructive`}
                        onSelect={onDeleteRow}
                    >
                        Delete Row
                        <ContextMenuShortcut>Del</ContextMenuShortcut>
                    </ContextMenuItem>
                    <ContextMenuItem
                        className={menuItemClass}
                        title={undoDisabledTitle}
                        disabled={!canUndoLastContextAction}
                        onSelect={onUndoLastContextAction}
                    >
                        Undo Last Context Action
                        <ContextMenuShortcut>Ctrl+Z</ContextMenuShortcut>
                    </ContextMenuItem>
                </ContextMenuContent>
            </ContextMenu>
        </div>
    );
};
