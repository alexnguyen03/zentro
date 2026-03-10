import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useEditorStore, TabGroup } from '../../stores/editorStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useScriptStore } from '../../stores/scriptStore';
import { TabBar } from './TabBar';
import { MonacoEditorWrapper } from './MonacoEditor';
import { TableInfo } from './TableInfo';
import { ExecuteQuery, CancelQuery } from '../../../wailsjs/go/app/App';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '../../lib/cn';

interface QueryGroupProps {
    group: TabGroup;
    isActiveGroup: boolean;
}

export const QueryGroup: React.FC<QueryGroupProps> = ({ group, isActiveGroup }) => {
    const { id: groupId, tabs, activeTabId } = group;
    const { removeTab, setActiveTabId, setActiveGroupId, renameTab, updateTabQuery, addTab, splitGroup } = useEditorStore();
    const { isConnected, activeProfile } = useConnectionStore();
    const { saveScript } = useScriptStore();

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

    // ── Tab open/close ────────────────────────────────────────────────────
    const handleClose = useCallback((id: string) => {
        const tab = tabs.find(t => t.id === id);
        if (tab?.query && !confirm(`Close "${tab.name}"? Query text will be lost.`)) return;
        removeTab(id, groupId);
    }, [tabs, removeTab, groupId]);

    // ── Run / Cancel ──────────────────────────────────────────────────────
    const handleRun = useCallback(async () => {
        if (!activeTab || !isConnected) return;
        try {
            await ExecuteQuery(activeTab.id, activeTab.query);
        } catch (err: any) {
            console.error('ExecuteQuery error:', err);
        }
    }, [activeTab, isConnected]);

    const handleCancel = useCallback(async () => {
        if (!activeTabId) return;
        try { await CancelQuery(activeTabId); } catch { /* swallow */ }
    }, [activeTabId]);

    const handleSaveScript = useCallback(async (tabId: string, scriptName: string) => {
        const tab = tabs.find(t => t.id === tabId);
        const connectionName = activeProfile?.name;
        if (!tab || !connectionName) return;
        try {
            await saveScript(connectionName, scriptName, tab.query);
        } catch (e) {
            console.error('Save script failed', e);
        }
    }, [tabs, activeProfile, saveScript]);

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
                onSaveScript={handleSaveScript}
                onSplit={handleSplit}
            />

            <div className={cn('flex-1 relative flex flex-col overflow-hidden', isActiveGroup && 'active-group-body')}>
                {isDraggingTab && (
                    <>
                        <div ref={setLeftNodeRef} className="absolute top-0 bottom-0 left-0 w-1/4 z-[1000]" />
                        <div ref={setRightNodeRef} className="absolute top-0 bottom-0 right-0 w-1/4 z-[1000]" />
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
                                ) : (
                                    <MonacoEditorWrapper
                                        tabId={tab.id}
                                        value={tab.query}
                                        onChange={(v) => updateTabQuery(tab.id, v)}
                                        onRun={handleRun}
                                        isActive={isActiveGroup && tab.id === activeTabId}
                                        onFocus={handleGroupClick}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
