import { TAB_TYPE, TRANSACTION_STATUS } from '../../lib/constants';
import { useConnectionStore } from '../../stores/connectionStore';
import { useEditorStore } from '../../stores/editorStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useStatusStore } from '../../stores/statusStore';
import type { ShortcutWhenContext } from './whenExpression';

function elementFromTarget(target: EventTarget | null): HTMLElement | null {
    return target instanceof HTMLElement ? target : null;
}

export function buildShortcutWhenContext(target: EventTarget | null): ShortcutWhenContext {
    const el = elementFromTarget(target);
    const editorState = useEditorStore.getState();
    const settings = useSettingsStore.getState();
    const layout = useLayoutStore.getState();
    const status = useStatusStore.getState();
    const connection = useConnectionStore.getState();

    const activeGroup = editorState.groups.find((group) => group.id === editorState.activeGroupId);
    const activeTab = activeGroup?.tabs.find((tab) => tab.id === activeGroup.activeTabId);

    const inSqlMonaco = Boolean(el?.closest('.zentro-sql-editor .monaco-editor'));
    const inFilterMonaco = Boolean(el?.closest('.zentro-filter-monaco .monaco-editor'));
    const inResultTable = Boolean(el?.closest('.result-table-tanstack, .rt-cell-input, .rt-th-filter-popover, .rt-th-filter-input'));
    const inInput = Boolean(el?.closest('input, textarea, [contenteditable="true"]'));
    const inCapture = Boolean(el?.closest('[data-shortcut-capture=\"true\"]'));
    const modalOpen = Boolean(document.querySelector('.z-modal, .z-modal-confirm'));

    const viewMode = settings.viewMode === true;
    const txActive = status.transactionStatus === TRANSACTION_STATUS.ACTIVE;
    const queryTabActive = activeTab?.type === TAB_TYPE.QUERY;

    return {
        sqlEditorFocus: inSqlMonaco,
        editorFocus: inSqlMonaco,
        filterFocus: inFilterMonaco || Boolean(el?.closest('.rt-th-filter-input, .rt-th-filter-popover')),
        resultTableFocus: inResultTable,
        inputFocus: inInput,
        captureFocus: inCapture,
        modalOpen,
        commandPaletteVisible: layout.showCommandPalette,
        queryTabActive,
        viewMode,
        readOnlyMode: viewMode,
        connectionActive: connection.isConnected,
        transactionActive: txActive,
        sidebarVisible: layout.showSidebar,
        rightSidebarVisible: layout.showRightSidebar,
        resultPanelVisible: layout.showResultPanel,
        appReady: true,
    };
}
