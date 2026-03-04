import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useEditorStore } from '../../stores/editorStore';
import { useResultStore } from '../../stores/resultStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { TabBar } from './TabBar';
import { MonacoEditorWrapper } from './MonacoEditor';
import { ResultPanel } from './ResultPanel';
import { ExecuteQuery, CancelQuery } from '../../../wailsjs/go/app/App';

const DIVIDER_MIN_TOP = 80;   // px — Monaco min height
const DIVIDER_MIN_BOT = 80;   // px — ResultPanel min height

export const QueryTabs: React.FC = () => {
    const { tabs, activeTabId, addTab, removeTab, setActiveTabId, updateTabQuery, renameTab } = useEditorStore();
    const { results } = useResultStore();
    const isConnected = useConnectionStore(s => s.isConnected);

    // VSplit divider state
    const containerRef = useRef<HTMLDivElement>(null);
    const [splitPct, setSplitPct] = useState(55); // monaco takes 55% by default
    const isDragging = useRef(false);

    const activeTab = tabs.find(t => t.id === activeTabId);
    const activeResult = activeTabId ? results[activeTabId] : undefined;

    // ── Keyboard shortcuts ────────────────────────────────────────────────
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            const mod = e.ctrlKey || e.metaKey;
            if (mod && e.key === 't') { e.preventDefault(); addTab(); }
            if (mod && e.key === 'w') { e.preventDefault(); if (activeTabId) handleClose(activeTabId); }
            // F2 → rename active tab
            if (e.key === 'F2' && activeTabId) {
                e.preventDefault();
                // TabBar will handle the rename via its own state,
                // but we trigger it by dispatching a custom event
                window.dispatchEvent(new CustomEvent('zentro:rename-tab', { detail: activeTabId }));
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [activeTabId, addTab]);

    // ── Tab open/close ────────────────────────────────────────────────────
    const handleClose = useCallback((id: string) => {
        const tab = tabs.find(t => t.id === id);
        if (tab?.query && !confirm(`Close "${tab.name}"? Query text will be lost.`)) return;
        removeTab(id);
    }, [tabs, removeTab]);

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

    // ── Empty state ───────────────────────────────────────────────────────
    if (tabs.length === 0) {
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
        <div className="query-tabs-root">
            <TabBar
                tabs={tabs}
                activeTabId={activeTabId}
                onActivate={setActiveTabId}
                onClose={handleClose}
                onNewTab={addTab}
                onRename={renameTab}
            />

            <div className="query-tabs-body" ref={containerRef}>
                {/* Monaco editors — all rendered but only active one visible */}
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
            </div>
        </div>
    );
};
