import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useEditorStore, TabGroup } from '../../stores/editorStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useScriptStore } from '../../stores/scriptStore';
import { TabBar } from './TabBar';
import { MonacoEditorWrapper } from './MonacoEditor';
import { TableInfo } from './TableInfo';
import { ExecuteQuery, CancelQuery } from '../../../wailsjs/go/app/App';
import { useDroppable } from '@dnd-kit/core';

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
            className={`query-group ${isActiveGroup ? 'active-group' : ''}`}
            onClickCapture={handleGroupClick}
            style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}
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

            <div className={`query-tabs-body ${isActiveGroup ? 'active-group-body' : ''}`} style={{ flex: 1, position: 'relative' }}>
                {isDraggingTab && (
                    <>
                        <div ref={setLeftNodeRef} className="split-drop-zone left" />
                        <div ref={setRightNodeRef} className="split-drop-zone right" />
                    </>
                )}
                {isLeftOver && <div className="split-snap-preview left" />}
                {isRightOver && <div className="split-snap-preview right" />}

                {tabs.length === 0 ? (
                    <div style={{ padding: 20, textAlign: 'center', color: '#888' }}>
                        No open tabs in this group.
                    </div>
                ) : (
                    <div className="editor-pane" style={{ height: '100%' }}>
                        {tabs.map(tab => (
                            <div
                                key={tab.id}
                                style={{ display: tab.id === activeTabId ? 'flex' : 'none', height: '100%', flexDirection: 'column', backgroundColor: 'var(--bg-main)' }}
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
