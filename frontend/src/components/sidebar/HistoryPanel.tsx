import React, { useEffect, useState, useCallback } from 'react';
import { Clock, Trash2, Search, CheckCircle, AlertCircle, ChevronRight } from 'lucide-react';
import { GetHistory, ClearHistory } from '../../services/historyService';
import { useEditorStore } from '../../stores/editorStore';
import { EventsOn } from '../../../wailsjs/runtime/runtime';
import { cn } from '../../lib/cn';

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
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border shrink-0 bg-bg-secondary">
                <div className="flex-1 relative flex items-center min-w-0">
                    <Search size={11} className="absolute left-1.5 text-text-secondary pointer-events-none" />
                    <input
                        className="w-full bg-bg-primary border border-border text-text-primary text-[11px] py-1 pl-[22px] pr-1.5 rounded-md outline-none focus:border-success transition-colors"
                        placeholder="Filter history…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Escape' && setSearch('')}
                    />
                </div>
                {entries.length > 0 && (
                    <button
                        className={cn(
                            "bg-transparent border border-transparent text-text-secondary cursor-pointer flex items-center gap-1 px-1.5 py-1 rounded-md text-[11px] transition-all hover:text-error hover:border-error hover:bg-[#f48771]/10 shrink-0",
                            confirmClear && "text-error border-error bg-[#f48771]/10"
                        )}
                        onClick={handleClear}
                        title={confirmClear ? 'Click again to confirm' : 'Clear all history'}
                        onBlur={() => setConfirmClear(false)}
                    >
                        <Trash2 size={12} />
                        {confirmClear ? 'Sure?' : ''}
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto">
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 px-4 py-8 text-text-secondary text-xs">
                        <Clock size={24} className="opacity-30" />
                        <p className="m-0">{search ? 'No matches' : 'No history yet'}</p>
                    </div>
                ) : (
                    filtered.map(e => (
                        <div
                            key={e.id}
                            className={cn(
                                "group px-2.5 py-1.5 border-b border-white/5 cursor-pointer transition-colors duration-100 hover:bg-bg-tertiary",
                                e.error && "border-l-2 border-l-error"
                            )}
                            onClick={() => pasteQuery(e.query)}
                            title="Click to paste into editor"
                        >
                            <div className="flex items-center gap-1.5 mb-1">
                                <span className={cn("flex", e.error ? "text-error" : "text-success")}>
                                    {e.error
                                        ? <AlertCircle size={11} />
                                        : <CheckCircle size={11} />
                                    }
                                </span>
                                <span className="flex-1 text-[10px] text-text-secondary font-mono overflow-hidden text-ellipsis whitespace-nowrap">
                                    {e.profile}{e.database ? `/${e.database}` : ''}
                                </span>
                                <span className="text-[10px] text-text-secondary shrink-0">{formatDuration(e.duration_ms)}</span>
                                <span className="text-[10px] text-text-secondary shrink-0">{formatTime(e.executed_at)}</span>
                                <ChevronRight size={11} className="text-text-secondary opacity-0 shrink-0 transition-opacity duration-100 group-hover:opacity-100" />
                            </div>
                            <div className="text-[11px] font-mono text-text-primary whitespace-nowrap overflow-hidden text-ellipsis max-w-full">{e.query}</div>
                            {e.error && (
                                <div className="text-[10px] text-error mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">{e.error}</div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

