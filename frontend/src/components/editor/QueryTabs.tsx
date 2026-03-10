import React, { useEffect, useState } from 'react';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import { useEditorStore } from '../../stores/editorStore';
import { useResultStore } from '../../stores/resultStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { QueryGroup } from './QueryGroup';
import { ResultPanel } from './ResultPanel';
import { ExecuteQuery } from '../../../wailsjs/go/app/App';
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

export const QueryTabs: React.FC = () => {
    const { groups, activeGroupId, addTab, removeTab, closeGroup, moveTab, setActiveGroupId, splitGroupFromDrag } = useEditorStore();
    const { results } = useResultStore();
    const { isConnected } = useConnectionStore();
    const { showResultPanel } = useLayoutStore();

    // Global active tab for the shared result panel
    const globalActiveGroup = groups.find(g => g.id === activeGroupId);
    const globalActiveTabId = globalActiveGroup?.activeTabId;
    const globalActiveTab = globalActiveGroup?.tabs.find(t => t.id === globalActiveTabId);
    const globalActiveResult = globalActiveTabId ? results[globalActiveTabId] : undefined;
    const activeTabIsTable = globalActiveTab?.type === 'table';

    const handleRunGlobal = React.useCallback(async () => {
        if (!globalActiveTab || !isConnected) return;
        try {
            await ExecuteQuery(globalActiveTab.id, globalActiveTab.query);
        } catch (err: any) {
            console.error('ExecuteQuery error:', err);
        }
    }, [globalActiveTab, isConnected]);

    // Drag overlay state
    const [activeDragTab, setActiveDragTab] = useState<any>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        })
    );

    // ── Keyboard shortcuts ────────────────────────────────────────────────
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            const mod = e.ctrlKey || e.metaKey;
            if (mod && e.key === 't') { e.preventDefault(); addTab(undefined, activeGroupId || undefined); }
            if (mod && e.key === 'w') {
                e.preventDefault();
                if (activeGroupId) {
                    const activeGroup = groups.find(g => g.id === activeGroupId);
                    if (activeGroup && activeGroup.activeTabId) {
                        const tab = activeGroup.tabs.find(t => t.id === activeGroup.activeTabId);
                        if (tab?.query && !confirm(`Close "${tab.name}"? Query text will be lost.`)) return;
                        removeTab(activeGroup.activeTabId, activeGroupId);
                    }
                }
            }
            if (mod && e.key === 's') {
                e.preventDefault();
                if (activeGroupId) {
                    const activeGroup = groups.find(g => g.id === activeGroupId);
                    if (activeGroup && activeGroup.activeTabId) {
                        window.dispatchEvent(new CustomEvent('zentro:save-script', { detail: activeGroup.activeTabId }));
                    }
                }
            }
            if (e.key === 'F2' && activeGroupId) {
                e.preventDefault();
                const activeGroup = groups.find(g => g.id === activeGroupId);
                if (activeGroup && activeGroup.activeTabId) {
                    window.dispatchEvent(new CustomEvent('zentro:rename-tab', { detail: activeGroup.activeTabId }));
                }
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [activeGroupId, addTab, groups, removeTab]);

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
    if (groups.length === 0 || (groups.length === 1 && groups[0].tabs.length === 0)) {
        return (
            <div className="flex items-center justify-center h-full text-text-secondary">
                <div className="text-center max-w-[320px]">
                    <h2 className="text-base font-medium mb-2 text-text-primary">No open queries</h2>
                    <p className="text-[13px] my-1.5">Press <kbd className="bg-bg-tertiary border border-border rounded-[3px] px-1.5 py-[1px] text-[11px] font-mono">Ctrl+T</kbd> or click <strong>+</strong> to open a new query tab.</p>
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

                    <Allotment.Pane preferredSize="35%" minSize={100} visible={showResultPanel && !activeTabIsTable}>
                        <div className="h-full border-t border-border">
                            <ResultPanel tabId={globalActiveTabId ?? ''} result={globalActiveResult} onRun={handleRunGlobal} />
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
