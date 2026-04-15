import React from 'react';
import { Button } from '../../ui';
import type { ResultContextMenuPayload } from './types';

interface ResultContextMenuProps {
    contextMenu: ResultContextMenuPayload | null;
    contextMenuRef: React.RefObject<HTMLDivElement>;
    contextMenuPosition: { left: number; top: number } | null;
    hasEditableCellSelection: boolean;
    canMutateCells: boolean;
    canMutateRows: boolean;
    canDeleteRows: boolean;
    canDuplicateRows: boolean;
    hasTableName: boolean;
    onCopyCellValue: () => void;
    onCopy: () => void;
    onCopyWithHeaders: () => void;
    onCopyAsJson: () => void;
    onCopyAsInsert: () => void;
    onCopyAsUpdate: () => void;
    onSetNull: () => void;
    onPaste: () => void;
    onDeleteRow: () => void;
    onDuplicateRow: () => void;
}

export const ResultContextMenu: React.FC<ResultContextMenuProps> = ({
    contextMenu,
    contextMenuRef,
    contextMenuPosition,
    hasEditableCellSelection,
    canMutateCells,
    canMutateRows,
    canDeleteRows,
    canDuplicateRows,
    hasTableName,
    onCopyCellValue,
    onCopy,
    onCopyWithHeaders,
    onCopyAsJson,
    onCopyAsInsert,
    onCopyAsUpdate,
    onSetNull,
    onPaste,
    onDeleteRow,
    onDuplicateRow,
}) => {
    if (!contextMenu || !contextMenuPosition) return null;

    return (
        <div
            ref={contextMenuRef}
            className="fixed z-panel-overlay w-45 rounded-sm border border-border bg-background py-1 shadow-lg"
            style={{ left: contextMenuPosition.left, top: contextMenuPosition.top }}
            onClick={(event) => event.stopPropagation()}
        >
            <Button
                type="button"
                variant="ghost"
                className="h-auto w-full justify-start rounded-none px-3 py-1.5 text-left text-[12px] text-foreground hover:bg-muted"
                onClick={onCopyCellValue}
            >
                Copy Cell Value
            </Button>
            <Button
                type="button"
                variant="ghost"
                className={`h-auto w-full justify-start rounded-none px-3 py-1.5 text-left text-[12px] ${hasEditableCellSelection ? 'text-foreground hover:bg-muted' : 'text-muted-foreground cursor-not-allowed'}`}
                disabled={!hasEditableCellSelection}
                onClick={onCopy}
            >
                Copy (TSV)
            </Button>
            <Button
                type="button"
                variant="ghost"
                className={`h-auto w-full justify-start rounded-none px-3 py-1.5 text-left text-[12px] ${hasEditableCellSelection ? 'text-foreground hover:bg-muted' : 'text-muted-foreground cursor-not-allowed'}`}
                disabled={!hasEditableCellSelection}
                onClick={onCopyWithHeaders}
            >
                Copy with Headers
            </Button>
            <Button
                type="button"
                variant="ghost"
                className={`h-auto w-full justify-start rounded-none px-3 py-1.5 text-left text-[12px] ${hasEditableCellSelection ? 'text-foreground hover:bg-muted' : 'text-muted-foreground cursor-not-allowed'}`}
                disabled={!hasEditableCellSelection}
                onClick={onCopyAsJson}
            >
                Copy as JSON
            </Button>
            {hasTableName && (
                <>
                    <Button
                        type="button"
                        variant="ghost"
                        className={`h-auto w-full justify-start rounded-none px-3 py-1.5 text-left text-[12px] ${hasEditableCellSelection ? 'text-foreground hover:bg-muted' : 'text-muted-foreground cursor-not-allowed'}`}
                        disabled={!hasEditableCellSelection}
                        onClick={onCopyAsInsert}
                    >
                        Copy as INSERT
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        className={`h-auto w-full justify-start rounded-none px-3 py-1.5 text-left text-[12px] ${hasEditableCellSelection ? 'text-foreground hover:bg-muted' : 'text-muted-foreground cursor-not-allowed'}`}
                        disabled={!hasEditableCellSelection}
                        onClick={onCopyAsUpdate}
                    >
                        Copy as UPDATE
                    </Button>
                </>
            )}
            <div className="my-1 h-px bg-border/70" />
            <Button
                type="button"
                variant="ghost"
                className={`h-auto w-full justify-start rounded-none px-3 py-1.5 text-left text-[12px] ${canMutateCells && hasEditableCellSelection ? 'text-foreground hover:bg-muted' : 'text-muted-foreground cursor-not-allowed'}`}
                disabled={!canMutateCells || !hasEditableCellSelection}
                onClick={onSetNull}
            >
                Set NULL
            </Button>
            <Button
                type="button"
                variant="ghost"
                className={`h-auto w-full justify-start rounded-none px-3 py-1.5 text-left text-[12px] ${canMutateCells && hasEditableCellSelection ? 'text-foreground hover:bg-muted' : 'text-muted-foreground cursor-not-allowed'}`}
                disabled={!canMutateCells || !hasEditableCellSelection}
                onClick={onPaste}
            >
                Paste
            </Button>
            <div className="my-1 h-px bg-border/70" />
            <Button
                type="button"
                variant="ghost"
                className={`h-auto w-full justify-start rounded-none px-3 py-1.5 text-left text-[12px] ${canMutateRows && canDeleteRows ? 'text-destructive hover:bg-muted' : 'text-muted-foreground cursor-not-allowed'}`}
                disabled={!canMutateRows || !canDeleteRows}
                onClick={onDeleteRow}
            >
                Delete Row
            </Button>
            <Button
                type="button"
                variant="ghost"
                className={`h-auto w-full justify-start rounded-none px-3 py-1.5 text-left text-[12px] ${canMutateRows && canDuplicateRows ? 'text-foreground hover:bg-muted' : 'text-muted-foreground cursor-not-allowed'}`}
                disabled={!canMutateRows || !canDuplicateRows}
                onClick={onDuplicateRow}
            >
                Duplicate Row
            </Button>
        </div>
    );
};
