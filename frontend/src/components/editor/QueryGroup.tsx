import React, { useRef, useEffect, useCallback } from 'react';
import { useEditorStore, TabGroup } from '../../stores/editorStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useScriptStore } from '../../stores/scriptStore';
import { useResultStore } from '../../stores/resultStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { useProjectStore } from '../../stores/projectStore';
import { TabBar } from './TabBar';
import { MonacoEditorWrapper } from './MonacoEditor';
import { TableInfo } from './TableInfo';
import { SettingsView } from '../layout/SettingsView';
import { ShortcutsView } from '../layout/ShortcutsView';
import { ExecuteQuery, CancelQuery, ExplainQuery } from '../../services/queryService';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '../../lib/cn';
import { getErrorMessage } from '../../lib/errors';
import { DOM_EVENT, TAB_TYPE } from '../../lib/constants';
import { onCommand } from '../../lib/commandBus';
import { applyPreExecuteFilterPolicy, resolveExecuteQuery } from '../../features/query/executionRouting';
import { useToast } from '../layout/Toast';
import { useWriteSafetyGuard } from '../../features/query/useWriteSafetyGuard';

interface QueryGroupProps {
    group: TabGroup;
    isActiveGroup: boolean;
}

export const QueryGroup: React.FC<QueryGroupProps> = ({ group, isActiveGroup }) => {
    const { id: groupId, tabs, activeTabId } = group;
    const {
        removeTab,
        setActiveTabId,
        setActiveGroupId,
        renameTab,
        updateTabQuery,
        updateTabContext,
        addTab,
        splitGroup,
    } = useEditorStore();
    const { isConnected, activeProfile } = useConnectionStore();
    const activeEnvironmentKey = useEnvironmentStore((state) => state.activeEnvironmentKey);
    const activeProject = useProjectStore((state) => state.activeProject);
    const { saveScript } = useScriptStore();
    const { toast } = useToast();
    const writeSafety = useWriteSafetyGuard(activeEnvironmentKey);

    const activeTab = tabs.find(t => t.id === activeTabId);

    // Edge drop zones for splitting
    const { setNodeRef: setLeftNodeRef, isOver: isLeftOver, active: dragActive } = useDroppable({
        id: `split-left-${groupId}`,
        data: { type: 'SplitLeft', groupId }
    });
    const { setNodeRef: setRightNodeRef, isOver: isRightOver } = useDroppable({
        id: `split-right-${groupId}`,
        data: { type: 'SplitRight', groupId }
    });

    const isDraggingTab = dragActive?.data.current?.type === 'Tab';

    const getLatestQueryTab = useCallback((tabId: string) => {
        const state = useEditorStore.getState();
        const activeGroupTab = state.groups.find((g) => g.id === groupId)?.tabs.find((t) => t.id === tabId);
        if (activeGroupTab?.type === TAB_TYPE.QUERY) {
            return activeGroupTab;
        }
        for (const groupItem of state.groups) {
            const candidate = groupItem.tabs.find((t) => t.id === tabId);
            if (candidate?.type === TAB_TYPE.QUERY) {
                return candidate;
            }
        }
        return null;
    }, [groupId]);

    const autoSaveQueryTab = useCallback(async (tabId: string) => {
        const tab = getLatestQueryTab(tabId);
        if (!tab || !tab.query?.trim()) return;

        const fallbackProject = useProjectStore.getState().activeProject;
        const fallbackEnvironmentKey = useEnvironmentStore.getState().activeEnvironmentKey
            || fallbackProject?.last_active_environment_key
            || fallbackProject?.default_environment_key;
        const fallbackConnection = fallbackProject?.connections?.find((item) => item.environment_key === fallbackEnvironmentKey);
        const fallbackConnectionName = fallbackConnection?.advanced_meta?.profile_name || fallbackConnection?.name || null;
        const projectId =
            activeProject?.id ||
            useProjectStore.getState().activeProject?.id ||
            tab.context?.scriptProjectId ||
            null;
        const profileName =
            activeProfile?.name ||
            useConnectionStore.getState().activeProfile?.name ||
            tab.context?.scriptConnectionName ||
            fallbackConnectionName ||
            null;

        if (projectId && profileName) {
            try {
                const savedScriptId = await saveScript(projectId, profileName, tab.name, tab.query, tab.context?.savedScriptId);
                const latestTab = getLatestQueryTab(tabId);
                if (latestTab) {
                    updateTabContext(tabId, {
                        savedScriptId,
                        scriptProjectId: projectId,
                        scriptConnectionName: profileName,
                    });
                }
            } catch (e) {
                console.error('Auto save failed', e);
            }
        } else {
            console.warn('Auto save skipped: missing project/profile context', {
                tabId,
                projectId,
                profileName,
            });
        }
    }, [activeProfile?.name, activeProject?.id, getLatestQueryTab, saveScript, updateTabContext]);

    useEffect(() => {
        if (!activeProject?.id || !activeProfile?.name) return;
        for (const tab of tabs) {
            if (tab.type !== TAB_TYPE.QUERY) continue;
            if (
                tab.context?.scriptProjectId === activeProject.id &&
                tab.context?.scriptConnectionName === activeProfile.name
            ) {
                continue;
            }
            updateTabContext(tab.id, {
                scriptProjectId: activeProject.id,
                scriptConnectionName: activeProfile.name,
            });
        }
    }, [activeProfile?.name, activeProject?.id, tabs, updateTabContext]);

    const handleClose = useCallback(async (id: string) => {
        const tab = tabs.find(t => t.id === id);
        try {
            if (tab?.type === TAB_TYPE.QUERY) {
                await autoSaveQueryTab(tab.id);
            }
        } finally {
            removeTab(id, groupId);
        }
    }, [autoSaveQueryTab, tabs, removeTab, groupId]);

    useEffect(() => {
        const off = onCommand(DOM_EVENT.SAVE_TAB_ACTION, (detail) => {
            if (!detail) return;
            autoSaveQueryTab(detail);
        });
        return off;
    }, [autoSaveQueryTab]);

    const executeQueryNow = useCallback(async (queryToRun: string) => {
        if (!activeTab || !isConnected || activeTab.readOnly) return;
        const resultStore = useResultStore.getState();
        applyPreExecuteFilterPolicy({
            source: 'editor',
            sourceTabId: activeTab.id,
            resultTabIds: Object.keys(resultStore.results),
            clearResultFilterExpr: (tabId) => resultStore.setFilterExpr(tabId, ''),
            updateTabContext,
        });

        try {
            await ExecuteQuery(activeTab.id, resolveExecuteQuery({
                source: 'editor',
                editorQuery: queryToRun,
            }));
        } catch (err: unknown) {
            console.error('ExecuteQuery error:', getErrorMessage(err));
        }
    }, [activeTab, isConnected, updateTabContext]);

    const handleRun = useCallback(async (queryToRun: string) => {
        const guardResult = await writeSafety.guardSql(queryToRun, 'Run Query');
        if (!guardResult.allowed) {
            if (guardResult.blockedReason) {
                toast.error(guardResult.blockedReason);
            }
            return;
        }

        await executeQueryNow(queryToRun);
    }, [executeQueryNow, toast, writeSafety]);

    const handleExplain = useCallback(async (queryToExplain: string, analyze: boolean) => {
        if (!activeTab || !isConnected || activeTab.readOnly) return;

        const explainTabId = `${activeTab.id}::explain:${analyze ? 'analyze' : 'plan'}`;
        try {
            await ExplainQuery(explainTabId, queryToExplain, analyze);
        } catch (err: unknown) {
            console.error('ExplainQuery error:', getErrorMessage(err));
        }
    }, [activeTab, isConnected]);

    const handleCancel = useCallback(async () => {
        if (!activeTabId) return;
        try { await CancelQuery(activeTabId); } catch { /* swallow */ }
    }, [activeTabId]);

    const handleSplit = useCallback((tabId: string) => {
        splitGroup(groupId, tabId);
    }, [groupId, splitGroup]);

    const handleGroupClick = useCallback(() => {
        if (!isActiveGroup) {
            setActiveGroupId(groupId);
        }
    }, [isActiveGroup, setActiveGroupId, groupId]);

    return (
        <div
            className={cn('flex flex-col h-full w-full', isActiveGroup && 'active-group')}
            onClickCapture={handleGroupClick}
        >
            <TabBar
                groupId={groupId}
                tabs={tabs}
                activeTabId={activeTabId}
                onActivate={(tabId) => setActiveTabId(tabId, groupId)}
                onClose={handleClose}
                onNewTab={() => addTab(undefined, groupId)}
                onRename={renameTab}
                onSplit={handleSplit}
            />

            <div className={cn('flex-1 relative flex flex-col overflow-hidden', isActiveGroup && 'active-group-body')}>
                {isDraggingTab && (
                    <>
                        <div ref={setLeftNodeRef} className="absolute top-0 bottom-0 left-0 z-popover w-1/4" />
                        <div ref={setRightNodeRef} className="absolute top-0 bottom-0 right-0 z-popover w-1/4" />
                    </>
                )}
                {isLeftOver && <div className="split-snap-preview left" />}
                {isRightOver && <div className="split-snap-preview right" />}

                {tabs.length === 0 ? (
                    <div className="p-5 text-center text-[#888]">
                        No open tabs in this group.
                    </div>
                ) : (
                    <div className="flex-1 overflow-hidden" style={{ height: '100%' }}>
                        {tabs.map(tab => (
                            <div
                                key={tab.id}
                                className={cn('h-full flex-col bg-bg-primary', tab.id === activeTabId ? 'flex' : 'hidden')}
                            >
                                {tab.type === 'table' ? (
                                    <TableInfo tabId={tab.id} tableName={tab.content || ''} />
                                ) : tab.type === 'settings' ? (
                                    <SettingsView tabId={tab.id} />
                                ) : tab.type === 'shortcuts' ? (
                                    <ShortcutsView />
                                ) : (
                                    <MonacoEditorWrapper
                                        tabId={tab.id}
                                        value={tab.query}
                                        onChange={(v) => updateTabQuery(tab.id, v)}
                                        onRun={handleRun}
                                        onExplain={handleExplain}
                                        isActive={isActiveGroup && tab.id === activeTabId}
                                        onFocus={() => setActiveTabId(tab.id, groupId)}
                                        readOnly={tab.readOnly}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {writeSafety.modals}
        </div>
    );
};
