import React, { useRef, useEffect, useCallback } from 'react';
import { useEditorStore, TabGroup } from '../../stores/editorStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useResultStore } from '../../stores/resultStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { useProjectStore } from '../../stores/projectStore';
import { TabBar } from './TabBar';
import { MonacoEditorWrapper } from './MonacoEditor';
import { TableInfo } from './TableInfo';
import { GitDiffView } from './GitDiffView';
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
import { saveQueryTabById } from '../../features/editor/scriptAutosave';
import { SCWriteGitIgnore } from '../../services/sourceControlService';
import { isDuplicateScriptNameError } from '../../stores/scriptStore';

interface QueryGroupProps {
    group: TabGroup;
    isActiveGroup: boolean;
}

export const QueryGroup: React.FC<QueryGroupProps> = ({ group, isActiveGroup }) => {
    const { id: groupId, tabs, activeTabId } = group;

    // Lazy-mount: only render a tab's content after it has been active at least once.
    // This prevents N Monaco instances from being created upfront (each costs ~50-100 MB).
    const mountedTabsRef = useRef<Set<string>>(new Set());
    if (activeTabId) mountedTabsRef.current.add(activeTabId);
    // Evict closed tabs so their IDs don't linger in the set.
    const tabIdSet = new Set(tabs.map(t => t.id));
    for (const id of mountedTabsRef.current) {
        if (!tabIdSet.has(id)) mountedTabsRef.current.delete(id);
    }
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
    const { toast } = useToast();
    const writeSafety = useWriteSafetyGuard(activeEnvironmentKey);

    const activeTab = tabs.find(t => t.id === activeTabId);
    const findTabById = useCallback((tabId: string) => tabs.find((t) => t.id === tabId), [tabs]);

    const saveSourceControlTab = useCallback(async (tabId: string): Promise<boolean> => {
        const tab = findTabById(tabId);
        if (!tab || tab.type !== TAB_TYPE.QUERY) return false;
        if (tab.context?.sourceControlFile !== 'gitignore') return false;
        await SCWriteGitIgnore(tab.query || '');
        toast.success('Saved .gitignore');
        return true;
    }, [findTabById, toast]);

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
                try {
                    const savedBySourceControl = await saveSourceControlTab(tab.id);
                    if (!savedBySourceControl) {
                        await saveQueryTabById(tab.id);
                    }
                } catch (error) {
                    console.error('Auto save failed before close', error);
                }
            }
        } finally {
            removeTab(id, groupId);
        }
    }, [tabs, removeTab, groupId, saveSourceControlTab]);

    useEffect(() => {
        const off = onCommand(DOM_EVENT.SAVE_TAB_ACTION, (detail) => {
            if (!detail) return;
            void (async () => {
                try {
                    const savedBySourceControl = await saveSourceControlTab(detail);
                    if (!savedBySourceControl) {
                        await saveQueryTabById(detail);
                    }
                } catch (error) {
                    if (isDuplicateScriptNameError(error)) {
                        toast.error('Tên script đã tồn tại. Vui lòng đặt tên khác.');
                        return;
                    }
                    toast.error(`Failed to save script: ${getErrorMessage(error)}`);
                }
            })();
        });
        return off;
    }, [saveSourceControlTab, toast]);

    const executeQueryNow = useCallback(async (queryToRun: string) => {
        if (!activeTab || !isConnected || activeTab.readOnly) return;
        const resultStore = useResultStore.getState();
        applyPreExecuteFilterPolicy({
            source: 'editor',
            sourceTabId: activeTab.id,
            resultTabIds: Object.keys(resultStore.results),
            clearResultFilterExpr: (tabId) => resultStore.setFilterExpr(tabId, ''),
            clearResultOrderByExpr: (tabId) => resultStore.setOrderByExpr(tabId, ''),
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
                        {tabs.map(tab => {
                            const isActive = tab.id === activeTabId;
                            const isMounted = mountedTabsRef.current.has(tab.id);
                            if (!isMounted) return null;
                            return (
                                <div
                                    key={tab.id}
                                    className={cn('h-full flex-col bg-background', isActive ? 'flex' : 'hidden')}
                                >
                                    {tab.type === 'table' ? (
                                        <TableInfo tabId={tab.id} tableName={tab.content || ''} />
                                    ) : tab.type === 'settings' ? (
                                        <SettingsView tabId={tab.id} />
                                    ) : tab.type === 'shortcuts' ? (
                                        <ShortcutsView />
                                    ) : tab.type === 'git_diff' ? (
                                        <GitDiffView tab={tab} />
                                    ) : (
                                        <MonacoEditorWrapper
                                            tabId={tab.id}
                                            value={tab.query}
                                            onChange={(v) => updateTabQuery(tab.id, v)}
                                            onRun={handleRun}
                                            onExplain={handleExplain}
                                            isActive={isActiveGroup && isActive}
                                            onFocus={() => setActiveTabId(tab.id, groupId)}
                                            readOnly={tab.readOnly}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            {writeSafety.modals}
        </div>
    );
};
