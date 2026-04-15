import React, { useEffect, useState, useCallback } from 'react';
import { Clock, CheckCircle, AlertCircle, ChevronRight } from 'lucide-react';
import { GetHistory, ClearHistory } from '../../services/historyService';
import { useEditorStore } from '../../stores/editorStore';
import { EventsOn } from '../../../wailsjs/runtime/runtime';
import { cn } from '../../lib/cn';
import { TAB_TYPE } from '../../lib/constants';
import { Button, Input } from '../ui';
import { useSidebarPanelState } from '../../stores/sidebarUiStore';
import { HISTORY_PANEL_STATE_DEFAULT } from './sidebarPanelStateDefaults';

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
    const [confirmClear, setConfirmClear] = useState(false);
    const [historyPanelState, setHistoryPanelState] = useSidebarPanelState('primary', 'history', HISTORY_PANEL_STATE_DEFAULT);
    const search = historyPanelState.search;
    const { groups, activeGroupId, addTab, setTabQuery } = useEditorStore();

    const load = useCallback(async () => {
        try {
            const data = await GetHistory();
            setEntries((data as HistoryEntry[]) || []);
        } catch {
            // Ignore history loading errors.
        }
    }, []);

    useEffect(() => {
        load();
        const off = EventsOn('query:done', load);
        return () => {
            if (typeof off === 'function') off();
        };
    }, [load]);

    const pasteQuery = (query: string) => {
        const activeGroup = groups.find((group) => group.id === activeGroupId);
        const activeTabId = activeGroup?.activeTabId;
        const activeTab = activeGroup?.tabs.find((tab) => tab.id === activeTabId);

        if (activeTabId && activeGroupId && activeTab?.type === TAB_TYPE.QUERY) {
            const currentQuery = activeTab.query || '';
            const suffix = query.trim();
            if (!suffix) return;
            const separator = currentQuery.trimEnd() ? '\n\n' : '';
            setTabQuery(activeTabId, `${currentQuery.trimEnd()}${separator}${suffix}`);
        } else {
            addTab({ query });
        }
    };

    const handleClear = async () => {
        if (!confirmClear) {
            setConfirmClear(true);
            return;
        }
        try {
            await ClearHistory();
            setEntries([]);
        } catch {
            // Ignore clear errors.
        }
        setConfirmClear(false);
    };

    const filtered = entries.filter(
        (entry) =>
            entry.query.toLowerCase().includes(search.toLowerCase())
            || entry.profile.toLowerCase().includes(search.toLowerCase())
            || entry.database.toLowerCase().includes(search.toLowerCase()),
    );

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex items-center gap-1.5 px-2 py-1.5 shrink-0">
                <div className="flex-1 min-w-0">
                    <Input
                        inputSize="sm"
                        className="w-full px-2"
                        placeholder="Filter history..."
                        value={search}
                        onChange={(event) => setHistoryPanelState((state) => ({ ...state, search: event.target.value }))}
                        onKeyDown={(event) => {
                            if (event.key === 'Escape') setHistoryPanelState((state) => ({ ...state, search: '' }));
                        }}
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 px-4 py-8 text-muted-foreground text-xs">
                        <Clock size={24} className="opacity-30" />
                        <p className="m-0">{search ? 'No matches' : 'No history yet'}</p>
                    </div>
                ) : (
                    filtered.map((entry) => (
                        <Button
                            key={entry.id}
                            type="button"
                            variant="ghost"
                            className={cn(
                                'group h-auto w-full justify-start rounded-none border-b border-white/5 px-2.5 py-1.5 text-left transition-colors duration-100 last:border-none',
                                entry.error ? 'border-l-2 border-l-error' : 'text-foreground',
                            )}
                            onClick={() => pasteQuery(entry.query)}
                            title="Click to paste into editor"
                        >
                            <div className="flex items-center gap-1.5 mb-1">
                                <span className={cn('flex', entry.error ? 'text-error' : 'text-success')}>
                                    {entry.error ? <AlertCircle size={11} /> : <CheckCircle size={11} />}
                                </span>
                                <span className="flex-1 text-[10px] text-muted-foreground font-mono overflow-hidden text-ellipsis whitespace-nowrap">
                                    {entry.profile}
                                    {entry.database ? `/${entry.database}` : ''}
                                </span>
                                <span className="text-[10px] text-muted-foreground shrink-0">{formatDuration(entry.duration_ms)}</span>
                                <span className="text-[10px] text-muted-foreground shrink-0">{formatTime(entry.executed_at)}</span>
                                <ChevronRight size={11} className="text-muted-foreground opacity-0 shrink-0 transition-opacity duration-100 group-hover:opacity-100" />
                            </div>
                            <div className="text-[11px] font-mono text-foreground whitespace-nowrap overflow-hidden text-ellipsis max-w-full">{entry.query}</div>
                            {entry.error && (
                                <div className="text-[10px] text-error mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">{entry.error}</div>
                            )}
                        </Button>
                    ))
                )}
            </div>
        </div>
    );
};
