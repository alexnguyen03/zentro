import React from 'react';
import { DOM_EVENT } from '../../../lib/constants';
import { onCommand } from '../../../lib/commandBus';
import { onQueryRowCount } from '../../../lib/events';
import { StartFetchTotalRowCount } from '../../../services/queryService';
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
    const isMountedRef = React.useRef(true);
    const countRequestSeqRef = React.useRef(0);
    const focusTimerRef = React.useRef<number | null>(null);

    React.useEffect(() => {
        return () => {
            isMountedRef.current = false;
            if (focusTimerRef.current !== null) {
                window.clearTimeout(focusTimerRef.current);
                focusTimerRef.current = null;
            }
        };
    }, []);

    const handleCountTotal = React.useCallback(async () => {
        if (!tabId) return;
        const requestSeq = countRequestSeqRef.current + 1;
        countRequestSeqRef.current = requestSeq;
        setIsCounting(true);
        void StartFetchTotalRowCount(tabId, requestSeq).catch(() => {
            if (!isMountedRef.current || countRequestSeqRef.current !== requestSeq) return;
            setTotalCount(-1);
            setIsCounting(false);
        });
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
                    if (focusTimerRef.current !== null) {
                        window.clearTimeout(focusTimerRef.current);
                    }
                    focusTimerRef.current = window.setTimeout(() => {
                        containerRef.current?.focus({ preventScroll: true });
                        focusTimerRef.current = null;
                    }, 50);
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
        if (result?.isDone) return;
        countRequestSeqRef.current += 1;
        setIsCounting(false);
    }, [result?.isDone, result?.lastExecutedQuery]);

    React.useEffect(() => onQueryRowCount((payload) => {
        if (payload.tabID !== tabId) return;
        if (payload.requestID !== countRequestSeqRef.current) return;
        if (!isMountedRef.current) return;
        if (payload.error) {
            setTotalCount(-1);
        } else {
            setTotalCount(payload.count);
        }
        setIsCounting(false);
    }), [tabId]);

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
