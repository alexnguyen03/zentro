import React from 'react';
import { Columns, Copy, Loader, Maximize2, Minimize2, Plus, RotateCcw, Save, Sparkles, Trash2, Upload } from 'lucide-react';
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui';
import { cn } from '../../../lib/cn';
import { LIMIT_OPTIONS } from '../resultPanelUtils';
import { listResultActionContributions } from '../../../features/query/contributionRegistry';
import type { ResultPanelToolbarDeps, ResultPanelAction } from './types';

const RESULT_TOOLBAR_ICON_SIZE = 12;

export function useResultPanelToolbar({
    tabId,
    result,
    onActionsChange,
    canManageDraftRows,
    isSavingDraftRows,
    hasPendingChanges,
    viewMode,
    selectedPersistedRowIndices,
    selectedDraftIds,
    defaultLimit,
    canUseResultExport,
    showMaximizeControl,
    isMaximized,
    onToggleMaximize,
    exportRunningSignature,
    handleAddRow,
    handleDuplicateRows,
    requestDeleteSelectedRows,
    resetEditState,
    setSelectedCells,
    handleSaveRequest,
    handleLimitChange,
    handleOpenExportModal,
    cancelExport,
    columnVisibility,
    setColumnVisibility,
    showColumnsPopover,
    setShowColumnsPopover,
    columnsPopoverRef,
}: ResultPanelToolbarDeps) {
    const actionsSignatureRef = React.useRef<string>('');

    const renderPanelAction = React.useCallback((action: ResultPanelAction) => {
        if (action.render) return <React.Fragment key={action.id}>{action.render()}</React.Fragment>;
        if (!action.onClick) return null;
        return (
            <Button
                key={action.id}
                variant="ghost"
                size="icon"
                onClick={() => action.onClick?.()}
                disabled={action.disabled || action.loading}
                title={action.title || action.label}
                className={action.danger ? 'h-7 w-7 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive' : 'h-7 w-7 p-0'}
            >
                {action.loading ? <Loader size={RESULT_TOOLBAR_ICON_SIZE} className="animate-spin" /> : action.icon}
            </Button>
        );
    }, []);

    const panelActions = React.useMemo(() => {
        const actions: ResultPanelAction[] = [];
        const shouldAlwaysShowRowActions = !onActionsChange;
        const showRowActions = canManageDraftRows || shouldAlwaysShowRowActions;
        const rowActionsBlocked = !canManageDraftRows || isSavingDraftRows;
        const rowActionDisabledReason = !canManageDraftRows
            ? 'Row actions require editable table result with primary keys.'
            : undefined;

        if (showRowActions) {
            actions.push({
                id: 'add-row',
                icon: <Plus size={RESULT_TOOLBAR_ICON_SIZE} />,
                label: 'Add Row',
                title: rowActionDisabledReason || 'Add Row',
                onClick: handleAddRow,
                disabled: rowActionsBlocked,
            });
            actions.push({
                id: 'duplicate-rows',
                icon: <Copy size={RESULT_TOOLBAR_ICON_SIZE} />,
                label: 'Duplicate',
                title: rowActionDisabledReason || 'Duplicate Selected Rows',
                onClick: handleDuplicateRows,
                disabled: rowActionsBlocked || selectedPersistedRowIndices.length === 0,
            });
            actions.push({
                id: 'delete-rows',
                icon: <Trash2 size={RESULT_TOOLBAR_ICON_SIZE} />,
                label: 'Delete',
                title: rowActionDisabledReason || 'Delete Selected Rows',
                danger: true,
                onClick: requestDeleteSelectedRows,
                disabled: rowActionsBlocked || (selectedPersistedRowIndices.length === 0 && selectedDraftIds.length === 0),
            });
        }
        if (hasPendingChanges) {
            actions.push({
                id: 'discard', icon: <RotateCcw size={RESULT_TOOLBAR_ICON_SIZE} />, label: 'Discard', title: 'Discard', danger: true,
                onClick: () => { resetEditState(); setSelectedCells(new Set()); },
            });
            if (!viewMode) {
                actions.push({
                    id: 'save',
                    icon: <Save size={RESULT_TOOLBAR_ICON_SIZE} />,
                    label: 'Save',
                    title: 'Save',
                    onClick: () => { void handleSaveRequest(); },
                    loading: isSavingDraftRows,
                });
            }
        }

        const resultActionContext = {
            tabId,
            rowCount: result?.rows.length || 0,
            columnCount: result?.columns.length || 0,
        };
        const extensionActions = listResultActionContributions()
            .filter((contribution) => (contribution.isAvailable ? contribution.isAvailable(resultActionContext) : true))
            .map<ResultPanelAction>((contribution) => ({
                id: `ext:${contribution.id}`,
                icon: <Sparkles size={RESULT_TOOLBAR_ICON_SIZE} />,
                label: contribution.title,
                title: contribution.title,
                onClick: () => contribution.run(resultActionContext),
            }));
        actions.push(...extensionActions);

        actions.push({
            id: 'row-limit',
            signature: `limit:${defaultLimit}`,
            render: () => (
                <Select value={String(defaultLimit)} onValueChange={(value) => { void handleLimitChange(value); }}>
                    <SelectTrigger
                        className="h-7 w-15 border-border/40 bg-transparent px-2 py-0 text-[11px] text-muted-foreground hover:bg-muted/70"
                        title="Row limit for next query"
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {LIMIT_OPTIONS.map((value) => (
                            <SelectItem key={value} value={String(value)}>
                                {value.toLocaleString()}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            ),
        });

        if (result && result.columns.length > 0) {
            const hiddenCount = Object.values(columnVisibility).filter((v) => v === false).length;
            actions.push({
                id: 'columns-toggle',
                signature: `cols:${hiddenCount}:${showColumnsPopover ? 1 : 0}`,
                render: () => (
                    <div className="relative" ref={columnsPopoverRef}>
                        <Button
                            type="button"
                            variant={hiddenCount > 0 ? 'secondary' : 'ghost'}
                            className={cn('h-7 gap-1 px-2 text-[11px] border', hiddenCount > 0 ? 'border-success/40 bg-success/15' : 'border-transparent')}
                            title="Toggle column visibility"
                            onClick={() => setShowColumnsPopover((prev) => !prev)}
                        >
                            <Columns size={RESULT_TOOLBAR_ICON_SIZE} />
                            {hiddenCount > 0 && <span className="text-[10px]">-{hiddenCount}</span>}
                        </Button>
                        {showColumnsPopover && (
                            <div className="absolute right-0 top-full mt-1 z-panel-overlay min-w-[180px] max-h-[320px] overflow-y-auto rounded-sm border border-border bg-popover shadow-lg py-1">
                                <div className="px-3 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide border-b border-border mb-1">
                                    Columns
                                </div>
                                {result.columns.map((col) => {
                                    const isVisible = columnVisibility[col] !== false;
                                    return (
                                        <Button
                                            key={col}
                                            type="button"
                                            variant="ghost"
                                            className="flex w-full items-center gap-2 px-3 py-1.5 text-[12px] text-left transition-colors h-auto justify-start"
                                            onClick={() => setColumnVisibility((prev) => ({ ...prev, [col]: !isVisible }))}
                                        >
                                            <span className={cn('w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center', isVisible ? 'bg-success border-success text-white' : 'border-border')}>
                                                {isVisible && <span className="text-[8px] leading-none">✓</span>}
                                            </span>
                                            <span className="truncate">{col}</span>
                                        </Button>
                                    );
                                })}
                                {Object.values(columnVisibility).some((v) => v === false) && (
                                    <div className="border-t border-border mt-1 pt-1 px-2 pb-1">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            className="h-6 w-full text-[11px] text-muted-foreground"
                                            onClick={() => setColumnVisibility({})}
                                        >
                                            Show all
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ),
            });
        }

        actions.push({
            id: 'export',
            icon: <Upload size={RESULT_TOOLBAR_ICON_SIZE} />,
            label: 'Export',
            title: 'Export',
            onClick: handleOpenExportModal,
            disabled: !canUseResultExport,
        });

        if (showMaximizeControl) {
            actions.push({
                id: 'toggle-maximize',
                icon: isMaximized ? <Minimize2 size={RESULT_TOOLBAR_ICON_SIZE} /> : <Maximize2 size={RESULT_TOOLBAR_ICON_SIZE} />,
                title: isMaximized ? 'Restore result panel size' : 'Maximize result panel',
                onClick: onToggleMaximize,
                disabled: !onToggleMaximize,
                signature: `maximize:${isMaximized ? 1 : 0}:${onToggleMaximize ? 1 : 0}`,
            });
        }

        if (exportRunningSignature) {
            actions.push({
                id: 'cancel-export',
                icon: <Loader size={RESULT_TOOLBAR_ICON_SIZE} className="animate-spin" />,
                title: 'Cancel export',
                onClick: cancelExport,
                signature: exportRunningSignature,
            });
        }

        return actions;
    }, [
        canManageDraftRows,
        isSavingDraftRows,
        handleAddRow,
        handleDuplicateRows,
        requestDeleteSelectedRows,
        hasPendingChanges,
        resetEditState,
        setSelectedCells,
        viewMode,
        handleSaveRequest,
        tabId,
        result?.rows.length,
        result?.columns.length,
        defaultLimit,
        handleLimitChange,
        columnVisibility,
        showColumnsPopover,
        setShowColumnsPopover,
        setColumnVisibility,
        columnsPopoverRef,
        handleOpenExportModal,
        canUseResultExport,
        showMaximizeControl,
        isMaximized,
        onToggleMaximize,
        exportRunningSignature,
        cancelExport,
        onActionsChange,
        selectedPersistedRowIndices.length,
        selectedDraftIds.length,
        result,
    ]);

    React.useEffect(() => {
        if (!onActionsChange) return;
        const signature = panelActions
            .map((action) => `${action.id}:${action.disabled ? 1 : 0}:${action.loading ? 1 : 0}:${action.danger ? 1 : 0}:${action.label || ''}:${action.title || ''}:${action.signature || ''}:${action.render ? 1 : 0}`)
            .join('|');
        if (actionsSignatureRef.current === signature) return;
        actionsSignatureRef.current = signature;
        onActionsChange(panelActions);
    }, [onActionsChange, panelActions]);

    return {
        panelActions,
        renderPanelAction,
    };
}
