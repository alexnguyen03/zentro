import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import { Tab, useEditorStore } from '../../stores/editorStore';
import { useResultStore } from '../../stores/resultStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { QueryGroup } from './QueryGroup';
import { ResultPanel } from './ResultPanel';
import { ExecuteQuery } from '../../services/queryService';
import { DOM_EVENT, TAB_TYPE } from '../../lib/constants';
import { onCommand } from '../../lib/commandBus';
import {
    DndContext,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    PointerSensor,
    useSensor,
    useSensors,
    closestCenter
} from '@dnd-kit/core';
import { cn } from '../../lib/cn';
import { splitLastQuery } from '../../lib/queryBuilder';
import { getErrorMessage } from '../../lib/errors';
import { applyPreExecuteFilterPolicy, type QueryExecutionSource, resolveExecuteQuery } from '../../features/query/executionRouting';
import { saveQueryTabById } from '../../features/editor/scriptAutosave';
import { Button } from '../ui';

export const QueryTabs: React.FC = () => {
    const {
        groups,
        activeGroupId,
        addTab,
        removeTab,
        closeGroup,
        moveTab,
        setActiveGroupId,
        setActiveTabId,
        splitGroupFromDrag,
        updateTabQuery,
        updateTabContext,
    } = useEditorStore();
    const { results } = useResultStore();
    const { isConnected } = useConnectionStore();
    const viewMode = useSettingsStore((state) => state.viewMode);
    const { showResultPanel } = useLayoutStore();

    // Global active tab for the shared result panel
    const globalActiveGroup = groups.find(g => g.id === activeGroupId);
    const globalActiveTabId = globalActiveGroup?.activeTabId;
    const globalActiveTab = globalActiveGroup?.tabs.find(t => t.id === globalActiveTabId);
    const globalActiveResult = globalActiveTabId ? results[globalActiveTabId] : undefined;
    const activeTabIsQuery = globalActiveTab?.type === TAB_TYPE.QUERY;

    const executeActiveTabQuery = React.useCallback(async (
        source: QueryExecutionSource,
        options?: { filterExpr?: string; orderByExpr?: string; filterBaseQuery?: string },
    ) => {
        if (!isConnected) return;

        const editorState = useEditorStore.getState();
        const latestActiveGroup = editorState.groups.find((group) => group.id === editorState.activeGroupId);
        const latestActiveTab = latestActiveGroup?.tabs.find((tab) => tab.id === latestActiveGroup.activeTabId);
        if (!latestActiveTab) return;

        const resultStore = useResultStore.getState();
        applyPreExecuteFilterPolicy({
            source,
            sourceTabId: latestActiveTab.id,
            resultTabIds: Object.keys(resultStore.results),
            clearResultFilterExpr: (tabId) => resultStore.setFilterExpr(tabId, ''),
            clearResultOrderByExpr: (tabId) => resultStore.setOrderByExpr(tabId, ''),
            updateTabContext,
        });

        const queryToRun = resolveExecuteQuery({
            source,
            editorQuery: latestActiveTab.query,
            filterExpr: options?.filterExpr,
            orderByExpr: options?.orderByExpr,
            filterBaseQuery: options?.filterBaseQuery,
        });

        try {
            await ExecuteQuery(latestActiveTab.id, queryToRun);
        } catch (err: unknown) {
            console.error(source === 'filter' ? 'ExecuteQuery (filter) error:' : 'ExecuteQuery error:', getErrorMessage(err));
        }
    }, [isConnected, updateTabContext]);

    const handleRunGlobal = React.useCallback(async () => {
        await executeActiveTabQuery('editor');
    }, [executeActiveTabQuery]);

    const handleFilterRunGlobal = React.useCallback(async (filter: string, orderByExpr = '', filterBaseQuery = '') => {
        if (!isConnected) return;

        const editorState = useEditorStore.getState();
        const latestActiveGroup = editorState.groups.find((group) => group.id === editorState.activeGroupId);
        const latestActiveTab = latestActiveGroup?.tabs.find((tab) => tab.id === latestActiveGroup.activeTabId);
        if (!latestActiveTab) return;

        // Filter should target the current executable statement, not the whole script.
        const baseForFilter =
            filterBaseQuery.trim()
            || globalActiveResult?.lastExecutedQuery?.trim()
            || splitLastQuery(latestActiveTab.query || '').base.trim()
            || latestActiveTab.query;
        updateTabContext(latestActiveTab.id, { resultFilterBaseQuery: baseForFilter });
        await executeActiveTabQuery('filter', {
            filterExpr: filter,
            orderByExpr,
            filterBaseQuery: baseForFilter,
        });
    }, [executeActiveTabQuery, globalActiveResult?.lastExecutedQuery, isConnected, updateTabContext]);

    const handleAppendToQuery = React.useCallback((fullQuery: string) => {
        if (!globalActiveTabId) return;
        const currentQuery = globalActiveGroup?.tabs.find(t => t.id === globalActiveTabId)?.query ?? '';
        const sep = currentQuery.trimEnd() ? '\n\n' : '';
        updateTabQuery(globalActiveTabId, currentQuery.trimEnd() + sep + fullQuery);
    }, [globalActiveTabId, globalActiveGroup, updateTabQuery]);

    const handleOpenFilterInNewTab = React.useCallback((fullQuery: string) => {
        addTab({ name: 'New Query', query: fullQuery });
    }, [addTab]);

    // Drag overlay state
    const [activeDragTab, setActiveDragTab] = useState<Tab | null>(null);
    const [activeSubTabId, setActiveSubTabId] = useState<string | null>(null);
    const [isResultMaximized, setIsResultMaximized] = useState(false);
    const recentTabIdsRef = useRef<string[]>([]);
    const [tabSwitcher, setTabSwitcher] = useState<{ open: boolean; orderedIds: string[]; index: number }>({
        open: false,
        orderedIds: [],
        index: 0,
    });

    const allTabs = useMemo(
        () => groups.flatMap((group) => group.tabs.map((tab) => ({ tab, groupId: group.id }))),
        [groups],
    );
    const tabMetaById = useMemo(
        () => new Map(allTabs.map((item) => [item.tab.id, item])),
        [allTabs],
    );

    const activateTabById = React.useCallback((tabId: string) => {
        const meta = tabMetaById.get(tabId);
        if (!meta) return;
        setActiveGroupId(meta.groupId);
        setActiveTabId(tabId, meta.groupId);
    }, [setActiveGroupId, setActiveTabId, tabMetaById]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        })
    );

    const closeActiveTabWithSave = React.useCallback(async () => {
        const editorState = useEditorStore.getState();
        const groupId = editorState.activeGroupId;
        const activeGroup = editorState.groups.find(g => g.id === groupId);
        const activeTabId = activeGroup?.activeTabId;
        const activeTab = activeGroup?.tabs.find((tab) => tab.id === activeTabId);
        if (!groupId || !activeTabId || !activeTab) return;

        if (activeTab.type === TAB_TYPE.QUERY && activeTab.query?.trim()) {
            try {
                await saveQueryTabById(activeTabId);
            } catch (error) {
                console.error('Shortcut close autosave failed', error);
            }
        }

        removeTab(activeTabId, groupId);
    }, [removeTab]);

    // Global event listener for command palette's 'close-active-tab'
    useEffect(() => {
        const off = onCommand(DOM_EVENT.CLOSE_ACTIVE_TAB, () => {
            void closeActiveTabWithSave();
        });
        return off;
    }, [closeActiveTabWithSave]);

    useEffect(() => {
        const alive = new Set(allTabs.map((item) => item.tab.id));
        recentTabIdsRef.current = recentTabIdsRef.current.filter((id) => alive.has(id));
    }, [allTabs]);

    useEffect(() => {
        if (!globalActiveTabId) return;
        recentTabIdsRef.current = [
            globalActiveTabId,
            ...recentTabIdsRef.current.filter((id) => id !== globalActiveTabId),
        ];
    }, [globalActiveTabId]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!e.ctrlKey || e.key !== 'Tab') return;
            if (e.repeat) return;

            const availableIds = recentTabIdsRef.current.filter((id) => tabMetaById.has(id));
            if (availableIds.length < 2) return;
            e.preventDefault();

            setTabSwitcher((prev) => {
                if (!prev.open) {
                    const current = globalActiveTabId || availableIds[0];
                    const ordered = [current, ...availableIds.filter((id) => id !== current)];
                    const direction = e.shiftKey ? -1 : 1;
                    const nextIndex = (direction + ordered.length) % ordered.length;
                    return { open: true, orderedIds: ordered, index: nextIndex };
                }

                const direction = e.shiftKey ? -1 : 1;
                const nextIndex = (prev.index + direction + prev.orderedIds.length) % prev.orderedIds.length;
                return { ...prev, index: nextIndex };
            });
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Control') {
                setTabSwitcher((prev) => {
                    if (prev.open && prev.orderedIds.length > 0) {
                        const targetTabId = prev.orderedIds[prev.index];
                        if (targetTabId) {
                            activateTabById(targetTabId);
                        }
                    }
                    return { ...prev, open: false };
                });
                return;
            }
            if (!e.ctrlKey) {
                setTabSwitcher((prev) => ({ ...prev, open: false }));
            }
        };

        const handleWindowBlur = () => {
            setTabSwitcher((prev) => ({ ...prev, open: false }));
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', handleWindowBlur);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', handleWindowBlur);
        };
    }, [activateTabById, globalActiveTabId, tabMetaById]);

    useEffect(() => {
        if (!showResultPanel || !activeTabIsQuery) {
            setIsResultMaximized(false);
        }
    }, [activeTabIsQuery, showResultPanel]);

    // Handle automatically closing groups when they are empty
    useEffect(() => {
        groups.forEach(g => {
            if (g.tabs.length === 0 && groups.length > 1) {
                closeGroup(g.id);
            }
        });
    }, [groups, closeGroup]);

    // ── Drag and Drop handlers ─────────────────────────────────────────────
    const handleDragStart = (e: DragStartEvent) => {
        const { active } = e;
        if (active.data.current?.type === 'Tab') {
            setActiveDragTab(active.data.current.tab);
            // Optionally focus the group where drag started
            setActiveGroupId(active.data.current.groupId);
        }
    };

    const handleDragEnd = (e: DragEndEvent) => {
        setActiveDragTab(null);
        const { active, over } = e;
        if (!over) return;

        const activeId = active.id as string;
        const overId = over.id as string;

        if (activeId === overId) return;

        const activeData = active.data.current;
        const overData = over.data.current;

        if (!activeData || !overData) return;

        const sourceGroupId = activeData.groupId;

        if (overData.type === 'Tab') {
            const targetGroupId = overData.groupId;
            const targetGroup = groups.find(g => g.id === targetGroupId);
            if (!targetGroup) return;

            const newIndex = targetGroup.tabs.findIndex(t => t.id === overId);
            moveTab(activeId, sourceGroupId, targetGroupId, newIndex);
        }
        else if (overData.type === 'Group') {
            const targetGroupId = overData.groupId;
            const targetGroup = groups.find(g => g.id === targetGroupId);
            if (!targetGroup) return;

            const newIndex = targetGroup.tabs.length;
            moveTab(activeId, sourceGroupId, targetGroupId, newIndex);
        }
        else if (overData.type === 'SplitLeft' || overData.type === 'SplitRight') {
            const targetGroupId = overData.groupId;
            const direction = overData.type === 'SplitLeft' ? 'left' : 'right';
            splitGroupFromDrag(sourceGroupId, activeId, targetGroupId, direction);
        }
    };

    // ── Empty state ───────────────────────────────────────────────────────
    // Reset sub-tab selection when the main tab changes
    useEffect(() => {
        setActiveSubTabId(null);
    }, [globalActiveTabId]);

    const globalActiveResultKeys = React.useMemo(() => {
        if (!globalActiveTabId) return [];
        return Object.keys(results)
            .filter((k) => k === globalActiveTabId || k.startsWith(`${globalActiveTabId}::result:`) || k.startsWith(`${globalActiveTabId}::explain:`))
            .sort((a, b) => {
                if (a === globalActiveTabId) return -1;
                if (b === globalActiveTabId) return 1;
                return a.localeCompare(b);
            });
    }, [globalActiveTabId, results]);

    const currentResultTabId =
        activeSubTabId && globalActiveResultKeys.includes(activeSubTabId)
            ? activeSubTabId
            : globalActiveResultKeys.length > 0
            ? globalActiveResultKeys[0]
            : globalActiveTabId;

    const currentResult = currentResultTabId ? results[currentResultTabId] : undefined;
    const isMainResult = currentResultTabId === globalActiveTabId;
    const isExplainResult = currentResultTabId?.includes('::explain:');
    const isReadOnlySubTab = !isMainResult;
    const generatedKind = isExplainResult ? 'explain' : (isMainResult ? undefined : 'result');
    const getResultSubTabLabel = React.useCallback((subTabId: string) => {
        const subResult = results[subTabId];
        if (subTabId.includes('::explain:analyze')) return 'Explain Analyze';
        if (subTabId.includes('::explain:plan')) return 'Explain Plan';
        if (subResult?.statementLabel?.trim()) return subResult.statementLabel.trim();

        if (subTabId === globalActiveTabId) {
            const mainQuery = splitLastQuery(globalActiveTab?.query || '').base.trim() || globalActiveTab?.query || '';
            const preview = mainQuery.replace(/\s+/g, ' ').replace(/;+\s*$/, '').trim();
            if (!preview) return '#1 Statement';
            return `#1 ${preview.length > 56 ? `${preview.slice(0, 56).trimEnd()}...` : preview}`;
        }

        const match = subTabId.match(/::result:(\d+)/);
        const ordinal = match ? parseInt(match[1], 10) + 1 : 1;
        return `#${ordinal} Statement`;
    }, [globalActiveTabId, globalActiveTab?.query, results]);

    if (groups.length === 0 || (groups.length === 1 && groups[0].tabs.length === 0)) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center max-w-[320px]">
                    <h2 className="text-base font-medium mb-2 text-foreground">No open queries</h2>
                    <p className="text-[13px] my-1.5">Press <kbd className="bg-muted border border-border rounded-sm px-1.5 py-px text-[11px] font-mono">Ctrl+T</kbd> or click <strong>+</strong> to open a new query tab.</p>
                    {!isConnected && (
                        <p className="text-xs">Connect to a database using the sidebar first.</p>
                    )}
                    <Button
                        type="button"
                        variant="default"
                        className="mt-4 h-8 px-3 text-[13px]"
                        onClick={() => addTab()}
                    >
                        New Query
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="flex flex-col h-full w-full overflow-hidden">
                {tabSwitcher.open && tabSwitcher.orderedIds.length > 0 && (
                    <div className="fixed left-1/2 top-40 z-topmost -translate-x-1/2 pointer-events-none">
                        <div className="min-w-70 max-w-140 max-h-70 overflow-auto rounded-sm border border-border/60 bg-card/95 shadow-elevation-sm backdrop-blur-sm pointer-events-auto p-2">
                            {tabSwitcher.orderedIds.map((id, index) => {
                                const meta = tabMetaById.get(id);
                                if (!meta) return null;
                                const isSelected = index === tabSwitcher.index;
                                return (
                                    <div
                                        key={id}
                                        className={cn(
                                            'flex items-center gap-2 rounded-sm px-2 py-1.5 text-[12px]',
                                            isSelected ? 'bg-accent/25 text-foreground' : 'text-muted-foreground',
                                        )}
                                    >
                                        <span className="truncate flex-1">{meta.tab.name}</span>
                                        <span className="text-[10px] text-muted-foreground">{meta.tab.type || 'query'}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
                <Allotment vertical>
                    <Allotment.Pane visible={!isResultMaximized}>
                        <Allotment separator={false}>
                            {groups.map((group, index) => (
                                <Allotment.Pane key={group.id} minSize={300}>
                                    <div className={cn(
                                        "flex flex-col h-full",
                                        index > 0 && "border-l border-border"
                                    )}>
                                        <QueryGroup
                                            group={group}
                                            isActiveGroup={group.id === activeGroupId}
                                        />
                                    </div>
                                </Allotment.Pane>
                            ))}
                        </Allotment>
                    </Allotment.Pane>

                    <Allotment.Pane 
                        preferredSize={isResultMaximized ? '100%' : '35%'} 
                        minSize={100} 
                        visible={showResultPanel && activeTabIsQuery}
                    >
                        <div className="h-full flex flex-col">
                            {globalActiveResultKeys.length > 1 && (
                                <div className="flex items-center bg-card h-8 shrink-0 overflow-hidden border-b border-border">
                                    <div className="flex h-full items-stretch flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:h-px [&::-webkit-scrollbar]:opacity-0 transition-opacity [&:hover::-webkit-scrollbar]:opacity-100 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-sm [&:hover::-webkit-scrollbar-thumb]:bg-border">
                                    {globalActiveResultKeys.map((subTabId) => {
                                        const label = getResultSubTabLabel(subTabId);
                                        const subResult = results[subTabId];
                                        const isActive = subTabId === currentResultTabId;
                                        return (
                                            <Button
                                                key={subTabId}
                                                type="button"
                                                variant="ghost"
                                                onClick={() => setActiveSubTabId(subTabId)}
                                                className={cn(
                                                    'group flex items-center h-full gap-1.5 px-2 cursor-pointer border-r border-r-border text-xs text-muted-foreground select-none whitespace-nowrap border-t-2 border-t-transparent mb-0 shrink-0 hover:text-foreground rounded-none',
                                                    isActive && 'bg-background -mb-px text-primary',
                                                )}
                                                title={subResult?.lastExecutedQuery || label}
                                            >
                                                <span className="overflow-hidden text-ellipsis">{label}</span>
                                                {subResult?.executionState === 'running' && (
                                                    <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0 animate-pulse" title="Running" />
                                                )}
                                            </Button>
                                        );
                                    })}
                                    </div>
                                </div>
                            )}
                            <div className="flex-1 overflow-hidden relative bg-card/40">
                                <ResultPanel
                                    tabId={currentResultTabId ?? ''}
                                    contextTabId={globalActiveTabId || undefined}
                                    result={currentResult}
                                    onRun={handleRunGlobal}
                                    onFilterRun={handleFilterRunGlobal}
                                    baseQuery={(splitLastQuery(globalActiveTab?.query || '').base.trim() || globalActiveTab?.query)}
                                    onAppendToQuery={handleAppendToQuery}
                                    onOpenInNewTab={handleOpenFilterInNewTab}
                                    isReadOnlyTab={isReadOnlySubTab || viewMode}
                                    generatedKind={generatedKind}
                                    isMaximized={isResultMaximized}
                                    onToggleMaximize={() => setIsResultMaximized((prev) => !prev)}
                                />
                            </div>
                        </div>
                    </Allotment.Pane>
                </Allotment>
            </div>

            {/* Drag Overlay for smooth visual feedback while dragging outside the flow */}
            <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
                {activeDragTab ? (
                    <div className="flex items-center px-[10px] pl-[14px] h-9 gap-1.5 bg-background text-foreground border-t-2 border-t-success border-b border-b-bg-primary text-xs cursor-grabbing opacity-90 w-[120px]">
                        <span className="overflow-hidden text-ellipsis whitespace-nowrap">{activeDragTab.name}</span>
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};

