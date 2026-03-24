import React, { useState, useEffect, useCallback } from 'react';
import { ChevronRight, ChevronDown, Server, Database, Loader, Search } from 'lucide-react';
import { LoadConnections, LoadDatabasesForProfile } from '../../../wailsjs/go/app/App';
import { cn } from '../../lib/cn';
import { Spinner } from './Spinner';
import type { ConnectionProfile } from '../../types/connection';

interface DatabaseTreePickerProps {
    onSelect: (profile: ConnectionProfile, database: string) => void;
    selectedProfile?: string | null;
    selectedDatabase?: string;
}

interface ConnectionNode {
    profile: ConnectionProfile;
    databases: string[];
    loadingDatabases: boolean;
    databasesLoaded: boolean;
}

export const DatabaseTreePicker: React.FC<DatabaseTreePickerProps> = ({
    onSelect,
    selectedProfile,
    selectedDatabase,
}) => {
    const [connections, setConnections] = useState<ConnectionNode[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedConnections, setExpandedConnections] = useState<Set<string>>(new Set());
    const [filter, setFilter] = useState('');

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        LoadConnections()
            .then((loaded) => {
                if (cancelled) return;
                const conns = (loaded || []).map((profile: ConnectionProfile) => ({
                    profile,
                    databases: [],
                    loadingDatabases: false,
                    databasesLoaded: false,
                }));
                setConnections(conns);
                const defaultExpanded = new Set<string>();
                conns.forEach((c) => {
                    if (c.profile.name === selectedProfile || conns.length === 1) {
                        defaultExpanded.add(c.profile.name || '');
                    }
                });
                setExpandedConnections(defaultExpanded);
            })
            .catch(() => {
                if (!cancelled) setConnections([]);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [selectedProfile]);

    const toggleConnection = useCallback((name: string | undefined) => {
        if (!name) return;
        setExpandedConnections((prev) => {
            const next = new Set(prev);
            if (next.has(name)) {
                next.delete(name);
            } else {
                next.add(name);
            }
            return next;
        });
        setConnections((prev) => {
            const idx = prev.findIndex((c) => c.profile.name === name);
            if (idx === -1) return prev;
            const node = prev[idx];
            if (node.databasesLoaded || node.loadingDatabases) return prev;
            const next = [...prev];
            next[idx] = { ...node, loadingDatabases: true };
            return next;
        });
        LoadDatabasesForProfile(name)
            .then((dbs) => {
                setConnections((prev) => {
                    const idx = prev.findIndex((c) => c.profile.name === name);
                    if (idx === -1) return prev;
                    const next = [...prev];
                    next[idx] = {
                        ...next[idx],
                        databases: dbs || [],
                        loadingDatabases: false,
                        databasesLoaded: true,
                    };
                    return next;
                });
            })
            .catch(() => {
                setConnections((prev) => {
                    const idx = prev.findIndex((c) => c.profile.name === name);
                    if (idx === -1) return prev;
                    const next = [...prev];
                    next[idx] = {
                        ...next[idx],
                        databases: [],
                        loadingDatabases: false,
                        databasesLoaded: true,
                    };
                    return next;
                });
            });
    }, []);

    const handleSelect = useCallback(
        (profileName: string, database: string) => {
            const node = connections.find((item) => item.profile.name === profileName);
            if (!node) return;
            onSelect(node.profile, database);
        },
        [connections, onSelect],
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-48 text-[12px] text-text-secondary gap-2">
                <Spinner size={14} /> Loading connections...
            </div>
        );
    }

    if (connections.length === 0) {
        return (
            <div className="flex items-center justify-center h-48 rounded-[22px] border border-dashed border-border/35 bg-bg-primary/20 px-6 text-center text-[12px] leading-5 text-text-secondary">
                No saved connections yet.
            </div>
        );
    }

    const lowerFilter = filter.toLowerCase();

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 mb-3 px-1">
                <Search size={12} className="text-text-secondary shrink-0" />
                <input
                    type="text"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Filter connections or databases..."
                    className="flex-1 bg-bg-secondary border border-border/30 rounded-lg px-2 py-1.5 text-[12px] text-text-primary placeholder:text-text-secondary/50 outline-none focus:border-accent/40 transition-colors"
                />
                {filter && (
                    <button
                        onClick={() => setFilter('')}
                        className="text-text-secondary hover:text-text-primary text-[11px]"
                    >
                        Clear
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
                {connections.map((node) => {
                    const name = node.profile.name || '';
                    const isExpanded = expandedConnections.has(name);
                    const isSelected = name === selectedProfile;
                    const filteredDbs = node.databases.filter(
                        (db) => !lowerFilter || db.toLowerCase().includes(lowerFilter),
                    );
                    const showConnection = !lowerFilter || name.toLowerCase().includes(lowerFilter);

                    if (!showConnection && filteredDbs.length === 0) return null;

                    return (
                        <div key={name} className="rounded-xl overflow-hidden">
                            <button
                                type="button"
                                onClick={() => toggleConnection(name)}
                                className={cn(
                                    'w-full flex items-center gap-2 px-3 py-2 text-left transition-colors rounded-xl',
                                    isSelected
                                        ? 'bg-accent/10 border border-accent/30'
                                        : 'hover:bg-bg-tertiary border border-transparent',
                                )}
                            >
                                {isExpanded ? (
                                    <ChevronDown size={14} className="shrink-0 text-text-secondary" />
                                ) : (
                                    <ChevronRight size={14} className="shrink-0 text-text-secondary" />
                                )}
                                <Server size={14} className="shrink-0 text-accent" />
                                <div className="min-w-0 flex-1">
                                    <div className="text-[13px] font-semibold text-text-primary truncate">{name}</div>
                                    <div className="text-[11px] text-text-secondary truncate">
                                        {node.profile.driver}
                                        {node.profile.host ? ` / ${node.profile.host}:${node.profile.port}` : ''}
                                    </div>
                                </div>
                                {node.loadingDatabases && <Spinner size={12} className="shrink-0" />}
                                {isSelected && (
                                    <span className="shrink-0 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
                                        Active
                                    </span>
                                )}
                            </button>

                            {isExpanded && (
                                <div className="ml-6 mt-1 space-y-0.5">
                                    {node.loadingDatabases ? (
                                        <div className="flex items-center gap-2 px-3 py-2 text-[12px] text-text-secondary">
                                            <Spinner size={12} /> Loading databases...
                                        </div>
                                    ) : filteredDbs.length === 0 && node.databasesLoaded ? (
                                        <div className="px-3 py-2 text-[12px] text-text-secondary">
                                            {node.databases.length === 0 ? 'No databases found' : 'No matches'}
                                        </div>
                                    ) : (
                                        filteredDbs.map((dbName) => {
                                            const isDbSelected = isSelected && dbName === selectedDatabase;
                                            return (
                                                <button
                                                    key={dbName}
                                                    type="button"
                                                    onClick={() => handleSelect(name, dbName)}
                                                    className={cn(
                                                        'w-full flex items-center gap-2 px-3 py-2 text-left transition-colors rounded-lg',
                                                        isDbSelected
                                                            ? 'bg-accent/15 border border-accent/35'
                                                            : 'hover:bg-bg-tertiary border border-transparent',
                                                    )}
                                                >
                                                    <Database size={12} className="shrink-0 text-success" />
                                                    <span className="text-[12px] text-text-primary truncate">{dbName}</span>
                                                    {dbName === node.profile.db_name && (
                                                        <span className="ml-auto shrink-0 rounded-full bg-bg-tertiary px-1.5 py-0.5 text-[10px] text-text-secondary">
                                                            default
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
