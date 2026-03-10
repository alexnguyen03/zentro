import React, { useEffect, useState, useCallback } from 'react';
import { Clock, Trash2, Search, CheckCircle, AlertCircle, ChevronRight } from 'lucide-react';
import { GetHistory, ClearHistory } from '../../../wailsjs/go/app/App';
import { useEditorStore } from '../../stores/editorStore';
import { EventsOn } from '../../../wailsjs/runtime/runtime';
import './HistoryPanel.css';

interface HistoryEntry {
    id: string;
    query: string;
    profile: string;
    database: string;
    duration_ms: number;
    row_count: number;
    error?: string;
    executed_at: string;
}

function formatTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

export const HistoryPanel: React.FC = () => {
    const [entries, setEntries] = useState<HistoryEntry[]>([]);
    const [search, setSearch] = useState('');
    const [confirmClear, setConfirmClear] = useState(false);
    const { groups, activeGroupId, addTab, setTabQuery } = useEditorStore();

    const load = useCallback(async () => {
        try {
            const data = await GetHistory();
            setEntries((data as HistoryEntry[]) || []);
        } catch { /* ignore */ }
    }, []);

    useEffect(() => {
        load();
        const off = EventsOn('query:done', load);
        return () => { if (typeof off === 'function') off(); };
    }, [load]);

    const pasteQuery = (query: string) => {
        const activeGroup = groups.find(g => g.id === activeGroupId);
        const activeTabId = activeGroup?.activeTabId;

        if (activeTabId && activeGroupId) {
            setTabQuery(activeTabId, query);
        } else {
            addTab({ query });
        }
    };

    const handleClear = async () => {
        if (!confirmClear) { setConfirmClear(true); return; }
        try { await ClearHistory(); setEntries([]); } catch { /* ignore */ }
        setConfirmClear(false);
    };

    const filtered = entries.filter(e =>
        e.query.toLowerCase().includes(search.toLowerCase()) ||
        e.profile.toLowerCase().includes(search.toLowerCase()) ||
        e.database.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="history-panel">
            <div className="history-toolbar">
                <div className="history-search-wrap">
                    <Search size={11} className="history-search-icon" />
                    <input
                        className="history-search"
                        placeholder="Filter history…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Escape' && setSearch('')}
                    />
                </div>
                {entries.length > 0 && (
                    <button
                        className={`history-clear-btn ${confirmClear ? 'confirm' : ''}`}
                        onClick={handleClear}
                        title={confirmClear ? 'Click again to confirm' : 'Clear all history'}
                        onBlur={() => setConfirmClear(false)}
                    >
                        <Trash2 size={12} />
                        {confirmClear ? 'Sure?' : ''}
                    </button>
                )}
            </div>

            <div className="history-list">
                {filtered.length === 0 ? (
                    <div className="history-empty">
                        <Clock size={24} opacity={0.3} />
                        <p>{search ? 'No matches' : 'No history yet'}</p>
                    </div>
                ) : (
                    filtered.map(e => (
                        <div
                            key={e.id}
                            className={`history-item ${e.error ? 'history-item-error' : ''}`}
                            onClick={() => pasteQuery(e.query)}
                            title="Click to paste into editor"
                        >
                            <div className="history-item-header">
                                <span className="history-item-status">
                                    {e.error
                                        ? <AlertCircle size={11} />
                                        : <CheckCircle size={11} />
                                    }
                                </span>
                                <span className="history-item-meta">
                                    {e.profile}{e.database ? `/${e.database}` : ''}
                                </span>
                                <span className="history-item-dur">{formatDuration(e.duration_ms)}</span>
                                <span className="history-item-time">{formatTime(e.executed_at)}</span>
                                <ChevronRight size={11} className="history-item-arrow" />
                            </div>
                            <div className="history-item-query">{e.query}</div>
                            {e.error && (
                                <div className="history-item-err-msg">{e.error}</div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
