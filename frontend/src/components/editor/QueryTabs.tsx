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
            <div className="empty-editor-state">
                <div className="empty-editor-content">
                    <h2>No open queries</h2>
                    <p>Press <kbd>Ctrl+T</kbd> or click <strong>+</strong> to open a new query tab.</p>
                    {!isConnected && (
                        <p className="empty-editor-hint">Connect to a database using the sidebar first.</p>
                    )}
                    <button className="btn primary" onClick={() => addTab()} style={{ marginTop: 16 }}>
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
            <div className="query-tabs-root" style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
                <Allotment vertical>
                    <Allotment.Pane>
                        <Allotment separator={false}>
                            {groups.map((group, index) => (
                                <Allotment.Pane key={group.id} minSize={300}>
                                    <div style={{
                                        height: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        borderLeft: index > 0 ? '1px solid var(--border-color)' : 'none'
                                    }}>
                                        <QueryGroup
                                            group={group}
                                            isActiveGroup={group.id === activeGroupId}
                                        />
                                    </div>
                                </Allotment.Pane>
                            ))}
                        </Allotment>
                    </Allotment.Pane>

                    <Allotment.Pane preferredSize="35%" minSize={100} visible={showResultPanel}>
                        <div className="global-result-pane" style={{ height: '100%', borderTop: '1px solid var(--border-color)' }}>
                            <ResultPanel tabId={globalActiveTabId ?? ''} result={globalActiveResult} onRun={handleRunGlobal} />
                        </div>
                    </Allotment.Pane>
                </Allotment>
            </div>

            {/* Drag Overlay for smooth visual feedback while dragging outside the flow */}
            <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
                {activeDragTab ? (
                    <div className="tab-item active" style={{ cursor: 'grabbing', opacity: 0.9, width: 120 }}>
                        <span className="tab-label">{activeDragTab.name}</span>
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};
