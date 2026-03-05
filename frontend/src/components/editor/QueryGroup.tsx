import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useEditorStore, TabGroup } from '../../stores/editorStore';
import { useResultStore } from '../../stores/resultStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useScriptStore } from '../../stores/scriptStore';
import { TabBar } from './TabBar';
import { MonacoEditorWrapper } from './MonacoEditor';
import { ResultPanel } from './ResultPanel';
import { ExecuteQuery, CancelQuery } from '../../../wailsjs/go/app/App';
import { useDroppable } from '@dnd-kit/core';

interface QueryGroupProps {
    group: TabGroup;
    isActiveGroup: boolean;
}

const DIVIDER_MIN_TOP = 80;
const DIVIDER_MIN_BOT = 80;

export const QueryGroup: React.FC<QueryGroupProps> = ({ group, isActiveGroup }) => {
    const { id: groupId, tabs, activeTabId } = group;
    const { removeTab, setActiveTabId, setActiveGroupId, renameTab, updateTabQuery, addTab, splitGroup } = useEditorStore();
    const { results } = useResultStore();
    const { isConnected, activeProfile } = useConnectionStore();
    const { saveScript } = useScriptStore();

    // VSplit divider state
    const containerRef = useRef<HTMLDivElement>(null);
    const [splitPct, setSplitPct] = useState(55); // monaco takes 55% by default
    const isDragging = useRef(false);

    const activeTab = tabs.find(t => t.id === activeTabId);
    const activeResult = activeTabId ? results[activeTabId] : undefined;

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

    // ── VSplit drag ───────────────────────────────────────────────────────
    const startDrag = useCallback(() => { isDragging.current = true; }, []);

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (!isDragging.current || !containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const totalH = rect.height;
            const offsetY = e.clientY - rect.top;
            const pct = (offsetY / totalH) * 100;
            const minPct = (DIVIDER_MIN_TOP / totalH) * 100;
            const maxPct = ((totalH - DIVIDER_MIN_BOT) / totalH) * 100;
            setSplitPct(Math.min(maxPct, Math.max(minPct, pct)));
        };
        const onUp = () => { isDragging.current = false; };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    }, []);

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

            <div className={`query-tabs-body ${isActiveGroup ? 'active-group-body' : ''}`} ref={containerRef} style={{ flex: 1, position: 'relative' }}>
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
                    <>
                        <div className="editor-pane" style={{ height: `${splitPct}%` }}>
                            {tabs.map(tab => (
                                <div
                                    key={tab.id}
                                    style={{ display: tab.id === activeTabId ? 'flex' : 'none', height: '100%', flexDirection: 'column' }}
                                >
                                    <MonacoEditorWrapper
                                        tabId={tab.id}
                                        value={tab.query}
                                        onChange={(v) => updateTabQuery(tab.id, v)}
                                        onRun={handleRun}
                                    />
                                </div>
                            ))}
                        </div>

                        <div
                            className="vsplit-divider"
                            onMouseDown={startDrag}
                        />

                        <div className="result-pane" style={{ height: `calc(${100 - splitPct}% - 4px)` }}>
                            <ResultPanel tabId={activeTabId ?? ''} result={activeResult} onRun={handleRun} />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
