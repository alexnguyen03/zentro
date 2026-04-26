import React from 'react';
import { DOM_EVENT } from '../../../lib/constants';
import { onCommand } from '../../../lib/commandBus';
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
    const [pendingOpenExportModal, setPendingOpenExportModal] = React.useState(false);
    const focusTimerRef = React.useRef<number | null>(null);

    React.useEffect(() => {
        return () => {
            if (focusTimerRef.current !== null) {
                window.clearTimeout(focusTimerRef.current);
                focusTimerRef.current = null;
            }
        };
    }, []);

    const prevIsDone = React.useRef(result?.isDone);
    React.useEffect(() => {
        if (!result) return;
        if (prevIsDone.current !== result.isDone) {
            if (!result.isDone) {
                resetEditState();
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
            }
            prevIsDone.current = result.isDone;
        }
    }, [containerRef, keepFilterFocusRef, resetEditState, result]);

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

}
