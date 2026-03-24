import React, { useEffect, useState } from 'react';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import { useEditorStore } from '../../stores/editorStore';
import { useResultStore } from '../../stores/resultStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { QueryGroup } from './QueryGroup';
import { ResultPanel } from './ResultPanel';
import { ExecuteQuery } from '../../../wailsjs/go/app/App';
import { DOM_EVENT, TAB_TYPE } from '../../lib/constants';
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
import { buildFilterQuery } from '../../lib/queryBuilder';

export const QueryTabs: React.FC = () => {
    const { groups, activeGroupId, addTab, removeTab, closeGroup, moveTab, setActiveGroupId, splitGroupFromDrag, updateTabQuery } = useEditorStore();
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

    const handleRunGlobal = React.useCallback(async () => {
        if (!globalActiveTab || !isConnected) return;
        useResultStore.getState().setFilterExpr(globalActiveTab.id, '');
        try {
            await ExecuteQuery(globalActiveTab.id, globalActiveTab.query);
        } catch (err: any) {
            console.error('ExecuteQuery error:', err);
        }
    }, [globalActiveTab, isConnected]);

    const handleFilterRunGlobal = React.useCallback(async (filter: string) => {
        if (!globalActiveTab || !isConnected) return;

        // Use lastExecutedQuery (= the query the backend actually ran) as filter base
        const baseForFilter = globalActiveResult?.lastExecutedQuery || globalActiveTab.query;
        const queryToRun = filter.trim() !== ''
            ? buildFilterQuery(baseForFilter, filter)
            : baseForFilter;

        try {
            await ExecuteQuery(globalActiveTab.id, queryToRun);
        } catch (err: any) {
            console.error('ExecuteQuery (filter) error:', err);
        }
    }, [globalActiveTab, isConnected, globalActiveResult]);

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
    const [activeDragTab, setActiveDragTab] = useState<any>(null);
    const [activeSubTabId, setActiveSubTabId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        })
    );

    // Global event listener for command palette's 'close-active-tab'
    useEffect(() => {
        const handler = () => {
            if (activeGroupId) {
                const activeGroup = groups.find(g => g.id === activeGroupId);
                if (activeGroup && activeGroup.activeTabId) {
                    removeTab(activeGroup.activeTabId, activeGroupId);
                }
            }
        };
        window.addEventListener(DOM_EVENT.CLOSE_ACTIVE_TAB, handler);
        return () => window.removeEventListener(DOM_EVENT.CLOSE_ACTIVE_TAB, handler);
    }, [activeGroupId, groups, removeTab]);

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

    if (groups.length === 0 || (groups.length === 1 && groups[0].tabs.length === 0)) {
        return (
            <div className="flex items-center justify-center h-full text-text-secondary">
                <div className="text-center max-w-[320px]">
                    <h2 className="text-base font-medium mb-2 text-text-primary">No open queries</h2>
                    <p className="text-[13px] my-1.5">Press <kbd className="bg-bg-tertiary border border-border rounded-sm px-1.5 py-px text-[11px] font-mono">Ctrl+T</kbd> or click <strong>+</strong> to open a new query tab.</p>
                    {!isConnected && (
                        <p className="text-xs">Connect to a database using the sidebar first.</p>
                    )}
                    <button
                        className="mt-4 bg-success text-white px-3 py-1.5 rounded text-[13px] cursor-pointer hover:opacity-90 transition-opacity border-none"
                        onClick={() => addTab()}
                    >
                        New Query
                    </button>
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
                <Allotment vertical>
                    <Allotment.Pane>
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
                        preferredSize="35%" 
                        minSize={100} 
                        visible={showResultPanel && activeTabIsQuery}
                    >
                        <div className="h-full border-t border-border flex flex-col">
                            {globalActiveResultKeys.length > 1 && (
                                <div className="flex bg-bg-secondary border-b border-border overflow-x-auto">
                                    {globalActiveResultKeys.map((subTabId) => {
                                        let label = 'Result 1';
                                        if (subTabId !== globalActiveTabId) {
                                            if (subTabId.includes('::explain:analyze')) label = 'Explain Analyze';
                                            else if (subTabId.includes('::explain:plan')) label = 'Explain Plan';
                                            else {
                                                const match = subTabId.match(/::result:(\d+)/);
                                                if (match) label = `Result ${parseInt(match[1], 10) + 1}`;
                                            }
                                        }

                                        const isActive = subTabId === currentResultTabId;
                                        return (
                                            <button
                                                key={subTabId}
                                                onClick={() => setActiveSubTabId(subTabId)}
                                                className={cn(
                                                    "px-3 py-1.5 text-[11px] whitespace-nowrap border-r border-border truncate max-w-[150px] transition-colors focus:outline-none",
                                                    isActive 
                                                        ? "bg-bg-primary text-text-primary border-t-[3px] border-t-success font-medium" 
                                                        : "bg-bg-tertiary text-text-secondary hover:bg-bg-primary hover:text-text-primary border-t-[3px] border-t-transparent"
                                                )}
                                                title={label}
                                            >
                                                {label}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                            <div className="flex-1 overflow-hidden relative">
                                <ResultPanel
                                    tabId={currentResultTabId ?? ''}
                                    result={currentResult}
                                    onRun={handleRunGlobal}
                                    onFilterRun={handleFilterRunGlobal}
                                    baseQuery={currentResult?.lastExecutedQuery || globalActiveTab?.query}
                                    onAppendToQuery={handleAppendToQuery}
                                    onOpenInNewTab={handleOpenFilterInNewTab}
                                    isReadOnlyTab={isReadOnlySubTab || viewMode}
                                    generatedKind={generatedKind as 'result' | 'explain'}
                                />
                            </div>
                        </div>
                    </Allotment.Pane>
                </Allotment>
            </div>

            {/* Drag Overlay for smooth visual feedback while dragging outside the flow */}
            <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
                {activeDragTab ? (
                    <div className="flex items-center px-[10px] pl-[14px] h-9 gap-1.5 bg-bg-primary text-text-primary border-t-2 border-t-success border-b border-b-bg-primary text-xs cursor-grabbing opacity-90 w-[120px]">
                        <span className="overflow-hidden text-ellipsis whitespace-nowrap">{activeDragTab.name}</span>
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};
