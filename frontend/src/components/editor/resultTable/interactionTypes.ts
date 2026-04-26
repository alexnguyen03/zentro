import React from 'react';

import { DraftRow, DisplayRow } from '../../../lib/dataEditing';

import { FocusCellRequest, ResultCellContextMenuPayload, TableMeta } from './types';

export interface UseResultTableInteractionsArgs {
    tabId: string;
    isDone: boolean;
    columns: string[];
    rows: string[][];
    selectedCells: Set<string>;
    setSelectedCells: React.Dispatch<React.SetStateAction<Set<string>>>;
    selectedRowKeys: Set<string>;
    setSelectedRowKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
    editedCells: Map<string, string>;
    setEditedCells: React.Dispatch<React.SetStateAction<Map<string, string>>>;
    deletedRows?: Set<number>;
    setDeletedRows?: React.Dispatch<React.SetStateAction<Set<number>>>;
    setDraftRows: React.Dispatch<React.SetStateAction<DraftRow[]>>;
    displayRows: DisplayRow[];
    displayRowsByKey: Map<string, DisplayRow>;
    rowOrder: Map<string, number>;
    isEditable: boolean;
    focusCellRequest: FocusCellRequest | null;
    onFocusCellRequestHandled: () => void;
    onRemoveDraftRows: (draftIds: string[]) => void;
    onCellContextMenu?: (payload: ResultCellContextMenuPayload) => void;
    onRowHeaderContextMenu?: (payload: ResultCellContextMenuPayload) => void;
    onReadOnlyEditAttempt?: () => void;
}

export interface ResultTableInteractions {
    editingCell: string | null;
    editValue: string;
    setEditValue: React.Dispatch<React.SetStateAction<string>>;
    setEditingCell: React.Dispatch<React.SetStateAction<string | null>>;
    commitEdit: (options?: { nextDirection?: 1 | -1 }) => Promise<void>;
    emitSaveShortcut: () => void;
    handleRevertRow: (rowKey: string) => void;
    tableMeta: TableMeta;
}
