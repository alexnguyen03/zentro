import React from 'react';
import { models } from '../../../../wailsjs/go/models';
import { DraftRow } from '../../../lib/dataEditing';

export interface FocusCellRequest {
    rowKey: string;
    colIdx: number;
    nonce: number;
}

export interface ResultCellContextMenuPayload {
    x: number;
    y: number;
    rowKey: string;
    colIdx: number;
    cellId: string;
}

export interface ResultTableProps {
    tabId: string;
    columns: string[];
    rows: string[][];
    isDone: boolean;
    editedCells: Map<string, string>;
    setEditedCells: React.Dispatch<React.SetStateAction<Map<string, string>>>;
    selectedCells: Set<string>;
    setSelectedCells: React.Dispatch<React.SetStateAction<Set<string>>>;
    deletedRows?: Set<number>;
    setDeletedRows?: React.Dispatch<React.SetStateAction<Set<number>>>;
    draftRows: DraftRow[];
    setDraftRows: React.Dispatch<React.SetStateAction<DraftRow[]>>;
    columnDefs: models.ColumnDef[];
    focusCellRequest: FocusCellRequest | null;
    onFocusCellRequestHandled: () => void;
    onRemoveDraftRows: (draftIds: string[]) => void;
    readOnlyMode?: boolean;
    quickFilter?: string;
    filterExpr?: string;
    onHeaderFilterRun?: (filterExpr: string) => void;
    onViewStatsChange?: (stats: { visibleRows: number; totalRows: number }) => void;
    onCellContextMenu?: (payload: ResultCellContextMenuPayload) => void;
}

export interface TableMeta {
    selectedCells: Set<string>;
    editedCells: Map<string, string>;
    editingCell: string | null;
    editValue: string;
    handleCellMouseDown: (event: React.MouseEvent, rowKey: string, colIdx: number) => void;
    handleCellMouseEnter: (rowKey: string, colIdx: number) => void;
    handleCellDoubleClick: (rowKey: string, colIdx: number, val: string) => void;
    handleCellContextMenu: (event: React.MouseEvent, rowKey: string, colIdx: number) => void;
    setEditValue: (value: string) => void;
    setEditingCell: (cellId: string | null) => void;
    handleRevertRow: (rowKey: string) => void;
}

export interface DataColumnMeta {
    id: string;
    index: number;
    name: string;
}
