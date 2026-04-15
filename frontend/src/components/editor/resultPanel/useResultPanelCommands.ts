import React from 'react';
import { DOM_EVENT } from '../../../lib/constants';
import { onCommand } from '../../../lib/commandBus';
import { FetchTotalRowCount } from '../../../services/queryService';
import type { ResultPanelCommandDeps } from './types';

interface UseResultPanelCommandsOptions extends ResultPanelCommandDeps {
    keepFilterFocusRef: React.MutableRefObject<boolean>;
    containerRef: React.RefObject<HTMLDivElement>;
    resetEditState: () => void;
    hasColumns: boolean;
    openExportModal: () => void;
}

export function useResultPanelCommands({
    tabId,
    result,
    viewMode,
    hasPendingChanges,
    isSavingDraftRows,
    onSaveRequest,
    onRun,
    keepFilterFocusRef,
    containerRef,
    resetEditState,
    hasColumns,
    openExportModal,
}: UseResultPanelCommandsOptions) {
    const [totalCount, setTotalCount] = React.useState<number | null>(null);
    const [isCounting, setIsCounting] = React.useState(false);
    const [pendingOpenExportModal, setPendingOpenExportModal] = React.useState(false);

    const handleCountTotal = React.useCallback(async () => {
        if (!tabId) return;
        setIsCounting(true);
        try {
            const count = await FetchTotalRowCount(tabId);
            setTotalCount(count);
        } catch {
            setTotalCount(-1);
        } finally {
            setIsCounting(false);
        }
    }, [tabId]);

    const prevIsDone = React.useRef(result?.isDone);
    React.useEffect(() => {
        if (!result) return;
        if (prevIsDone.current !== result.isDone) {
            if (!result.isDone) {
                setTotalCount(null);
                setIsCounting(false);
                resetEditState();
                void handleCountTotal();
                if (!keepFilterFocusRef.current) {
                    setTimeout(() => containerRef.current?.focus({ preventScroll: true }), 50);
                }
            } else {
                keepFilterFocusRef.current = false;
                if (result.hasMore && result.isSelect) {
                    void handleCountTotal();
                }
            }
            prevIsDone.current = result.isDone;
        }
    }, [containerRef, handleCountTotal, keepFilterFocusRef, resetEditState, result]);

    React.useEffect(() => {
        const off = onCommand(DOM_EVENT.SAVE_TAB_ACTION, (detail) => {
            if (detail && detail !== tabId) return;
            if (viewMode || !hasPendingChanges || isSavingDraftRows) return;
            void onSaveRequest();
        });
        return off;
    }, [hasPendingChanges, isSavingDraftRows, onSaveRequest, tabId, viewMode]);

    React.useEffect(() => {
        const off = onCommand(DOM_EVENT.OPEN_RESULT_EXPORT, (detail) => {
            if (!detail || detail.tabId !== tabId) return;
            if (hasColumns) {
                openExportModal();
                return;
            }
            setPendingOpenExportModal(true);
            onRun?.();
        });
        return off;
    }, [hasColumns, onRun, openExportModal, tabId]);

    React.useEffect(() => {
        if (!pendingOpenExportModal) return;
        if (!hasColumns) return;
        openExportModal();
        setPendingOpenExportModal(false);
    }, [hasColumns, openExportModal, pendingOpenExportModal]);

    return {
        totalCount,
        isCounting,
        setTotalCount,
        setIsCounting,
        handleCountTotal,
    };
}
