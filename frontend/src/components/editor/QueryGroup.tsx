import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useEditorStore, TabGroup } from '../../stores/editorStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useScriptStore } from '../../stores/scriptStore';
import { useResultStore } from '../../stores/resultStore';
import { TabBar } from './TabBar';
import { MonacoEditorWrapper } from './MonacoEditor';
import { TableInfo } from './TableInfo';
import { SettingsView } from '../layout/SettingsView';
import { ShortcutsView } from '../layout/ShortcutsView';
import { ExecuteQuery, CancelQuery, ExplainQuery } from '../../../wailsjs/go/app/App';
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
        if (tab?.type === 'query' && tab.query?.trim() && activeProfile?.name) {
            saveScript(activeProfile.name, tab.name, tab.query).catch(e => console.error('Auto save failed', e));
        }
        removeTab(id, groupId);
    }, [tabs, removeTab, groupId, activeProfile, saveScript]);

    // ── Run / Cancel ──────────────────────────────────────────────────────
    const handleRun = useCallback(async (queryToRun: string) => {
        if (!activeTab || !isConnected || activeTab.readOnly) return;
        useResultStore.getState().setFilterExpr(activeTab.id, '');
        try {
            await ExecuteQuery(activeTab.id, queryToRun);
        } catch (err: any) {
            console.error('ExecuteQuery error:', err);
        }
    }, [activeTab, isConnected]);

    const handleExplain = useCallback(async (queryToExplain: string, analyze: boolean) => {
        if (!activeTab || !isConnected || activeTab.readOnly) return;

        const explainTabId = `${activeTab.id}::explain:${analyze ? 'analyze' : 'plan'}`;
        try {
            await ExplainQuery(explainTabId, queryToExplain, analyze);
        } catch (err: any) {
            console.error('ExplainQuery error:', err);
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
        </div>
    );
};
