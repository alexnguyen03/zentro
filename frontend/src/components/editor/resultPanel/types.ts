import type React from 'react';
import type { DraftRow, DisplayRow } from '../../../lib/dataEditing';
import type { TabResult } from '../../../stores/resultStore';
import type { FocusCellRequest } from '../useResultEditing';
import type { UiAction } from '../../../types/uiAction';

export type ResultPanelAction = UiAction;

export interface ResultPanelProps {
    tabId: string;
    contextTabId?: string;
    result?: TabResult;
    onRun?: () => void;
    onFilterRun?: (filter: string, orderByExpr?: string, filterBaseQuery?: string) => void;
    onActionsChange?: (actions: ResultPanelAction[]) => void;
    baseQuery?: string;
    onAppendToQuery?: (fullQuery: string) => void;
    onOpenInNewTab?: (fullQuery: string) => void;
    isReadOnlyTab?: boolean;
    generatedKind?: 'result' | 'explain';
    isMaximized?: boolean;
    onToggleMaximize?: () => void;
    showMaximizeControl?: boolean;
    showResultFilterBar?: boolean;
    /** Prefer provided baseQuery over runtime lastExecutedQuery when composing filter SQL */
    preferBaseQueryForFilter?: boolean;
}

export interface ResultContextMenuPayload {
    x: number;
    y: number;
    rowKey: string;
    colIdx: number;
    cellId?: string;
}

export interface ResultContextCopyAsAction {
    id: string;
    label: string;
    onSelect: () => void;
    disabled?: boolean;
    title?: string;
}

export type ResultContextWhereAction = ResultContextCopyAsAction;

export interface ResultContextMenuDeps {
    result: TabResult | undefined;
    driver: string | undefined;
    displayRows: DisplayRow[];
    displayRowsByKey: Map<string, DisplayRow>;
    rowOrder: Map<string, number>;
    editedCells: Map<string, string>;
    selectedCells: Set<string>;
    selectedRowKeys: string[];
    selectedRowKeysFromHeader: string[];
    selectedPersistedRowIndices: number[];
    selectedDraftIds: string[];
    draftRows: DraftRow[];
    deletedRows: Set<number>;
    columnDefsByName: Map<string, { Name: string; IsPrimaryKey: boolean; IsNullable: boolean }>;
    isEditable: boolean;
    canManageDraftRows: boolean;
    isReadOnlyTab: boolean;
    viewMode: boolean;
    isSavingDraftRows: boolean;
    getPersistedRowValues: (rowIndex: number) => string[];
    removeDraftRows: (draftIds: string[]) => void;
    openQueryTab: (query: string, title?: string) => void;
    setEditedCells: React.Dispatch<React.SetStateAction<Map<string, string>>>;
    setDraftRows: React.Dispatch<React.SetStateAction<DraftRow[]>>;
    setSelectedCells: React.Dispatch<React.SetStateAction<Set<string>>>;
    setDeletedRows: React.Dispatch<React.SetStateAction<Set<number>>>;
    setFocusCellRequest: React.Dispatch<React.SetStateAction<FocusCellRequest | null>>;
}

export interface ResultPanelCommandDeps {
    tabId: string;
    result: TabResult | undefined;
    viewMode: boolean;
    hasPendingChanges: boolean;
    hasLegacyChanges: boolean;
    isSavingDraftRows: boolean;
    generatePendingScript: () => string;
    handleDirectExecute: () => Promise<void>;
    onSaveRequest: () => Promise<void>;
    onRun?: () => void;
}

export interface ResultPanelToolbarDeps {
    tabId: string;
    result: TabResult | undefined;
    onActionsChange?: (actions: ResultPanelAction[]) => void;
    canManageDraftRows: boolean;
    isSavingDraftRows: boolean;
    hasPendingChanges: boolean;
    viewMode: boolean;
    selectedPersistedRowIndices: number[];
    selectedDraftIds: string[];
    defaultLimit: number;
    canUseResultExport: boolean;
    showMaximizeControl: boolean;
    isMaximized: boolean;
    onToggleMaximize?: () => void;
    exportRunningSignature?: string;
    handleAddRow: () => void;
    handleDuplicateRows: () => void;
    requestDeleteSelectedRows: () => void;
    resetEditState: () => void;
    setSelectedCells: React.Dispatch<React.SetStateAction<Set<string>>>;
    handleSaveRequest: () => Promise<void>;
    handleLimitChange: (value: string) => Promise<void>;
    handleOpenExportModal: () => void;
    cancelExport: () => void;
    columnVisibility: Record<string, boolean>;
    setColumnVisibility: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    showColumnsPopover: boolean;
    setShowColumnsPopover: React.Dispatch<React.SetStateAction<boolean>>;
    columnsPopoverRef: React.RefObject<HTMLDivElement>;
}
