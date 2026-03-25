import React, { useState, useEffect, useCallback } from 'react';
import { ChevronRight, ChevronDown, Server, Database, Search, X } from 'lucide-react';
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

    const loadDatabasesForConnection = useCallback(async (name: string) => {
        if (!name) return;
        const currentNode = connections.find((c) => c.profile.name === name);
        if (!currentNode || currentNode.databasesLoaded || currentNode.loadingDatabases) return;

        setConnections((prev) => {
            const idx = prev.findIndex((c) => c.profile.name === name);
            if (idx === -1) return prev;
            const node = prev[idx];
            if (node.databasesLoaded || node.loadingDatabases) return prev;

            const next = [...prev];
            next[idx] = { ...node, loadingDatabases: true };
            return next;
        });

        try {
            const dbs = await LoadDatabasesForProfile(name);
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
        } catch {
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
        }
    }, [connections]);

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

                // Keep the tree expanded by default (requested UX).
                const defaultExpanded = new Set<string>();
                conns.forEach((c) => {
                    if (c.profile.name) defaultExpanded.add(c.profile.name);
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
    }, []);

    useEffect(() => {
        if (!selectedProfile) return;
        setExpandedConnections((prev) => {
            if (prev.has(selectedProfile)) return prev;
            const next = new Set(prev);
            next.add(selectedProfile);
            return next;
        });
    }, [selectedProfile]);

    const lowerFilter = filter.trim().toLowerCase();

    useEffect(() => {
        connections.forEach((node) => {
            const name = node.profile.name || '';
            if (!name) return;
            const shouldExpand = lowerFilter ? true : expandedConnections.has(name);
            if (shouldExpand && !node.databasesLoaded && !node.loadingDatabases) {
                void loadDatabasesForConnection(name);
            }
        });
    }, [connections, expandedConnections, lowerFilter, loadDatabasesForConnection]);

    const toggleConnection = useCallback((name: string | undefined) => {
        if (!name) return;
        const isExpanded = expandedConnections.has(name);
        setExpandedConnections((prev) => {
            const next = new Set(prev);
            if (next.has(name)) {
                next.delete(name);
            } else {
                next.add(name);
            }
            return next;
        });
        if (!isExpanded) {
            void loadDatabasesForConnection(name);
        }
    }, [expandedConnections, loadDatabasesForConnection]);

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
            <div className="flex h-48 items-center justify-center gap-2 text-[12px] text-text-secondary">
                <Spinner size={14} /> Loading connections...
            </div>
        );
    }

    if (connections.length === 0) {
        return (
            <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border/35 bg-bg-primary/20 px-6 text-center text-[12px] leading-5 text-text-secondary">
                No saved connections yet.
            </div>
        );
    }

    return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <div className="mb-2 flex items-center gap-1.5 border-b border-border/20 px-2 pb-2">
                <Search size={11} className="shrink-0 text-text-secondary" />
                <input
                    type="text"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Filter connections or databases..."
                    className="w-full rounded-sm border border-border bg-bg-primary px-2 py-1 text-[11px] text-text-primary outline-none transition-colors placeholder:text-text-secondary/60 focus:border-success"
                />
                {filter && (
                    <button
                        type="button"
                        onClick={() => setFilter('')}
                        className="cursor-pointer rounded p-1 text-text-secondary transition-colors hover:bg-error/10 hover:text-error"
                        title="Clear"
                    >
                        <X size={12} />
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-auto p-1">
                {connections.map((node) => {
                    const name = node.profile.name || '';
                    const profileSelected = name === selectedProfile;
                    const isExpanded = lowerFilter ? true : expandedConnections.has(name);
                    const filteredDbs = node.databases.filter((db) => !lowerFilter || db.toLowerCase().includes(lowerFilter));
                    const showConnection = !lowerFilter || name.toLowerCase().includes(lowerFilter) || filteredDbs.length > 0;

                    if (!showConnection) return null;

                    return (
                        <div key={name} className="mb-0.5">
                            <button
                                type="button"
                                onClick={() => toggleConnection(name)}
                                className={cn(
                                    'flex w-full cursor-pointer items-center gap-1.5 rounded-sm px-2 py-1 text-left text-[13px] text-text-primary transition-colors',
                                    'hover:bg-bg-tertiary',
                                    profileSelected && 'bg-accent/8',
                                )}
                                title={name}
                            >
                                {isExpanded ? <ChevronDown size={14} className="shrink-0" /> : <ChevronRight size={14} className="shrink-0" />}
                                <Server size={14} className="shrink-0 text-success" />
                                <span className="truncate font-semibold">{name}</span>
                                <span className="ml-1 truncate text-[11px] text-text-secondary">
                                    {node.profile.driver}
                                    {node.profile.host ? ` / ${node.profile.host}:${node.profile.port}` : ''}
                                </span>
                                {node.loadingDatabases && <Spinner size={12} className="ml-auto shrink-0" />}
                            </button>

                            {isExpanded && (
                                <div className="pl-4">
                                    {node.loadingDatabases ? (
                                        <div className="flex items-center gap-2 px-2 py-1 text-[12px] text-text-secondary">
                                            <Spinner size={12} /> Loading databases...
                                        </div>
                                    ) : filteredDbs.length === 0 && node.databasesLoaded ? (
                                        <div className="px-2 py-1 text-[12px] text-text-secondary">
                                            {node.databases.length === 0 ? 'No databases found' : 'No matches'}
                                        </div>
                                    ) : (
                                        filteredDbs.map((dbName) => {
                                            const isDbSelected = profileSelected && dbName === selectedDatabase;
                                            return (
                                                <button
                                                    key={dbName}
                                                    type="button"
                                                    onClick={() => handleSelect(name, dbName)}
                                                    className={cn(
                                                        'flex w-full cursor-pointer items-center gap-1.5 rounded-sm px-2 py-1 text-left text-[12px] text-text-primary transition-colors',
                                                        isDbSelected
                                                            ? 'border border-accent/35 bg-accent/10'
                                                            : 'border border-transparent hover:bg-bg-tertiary',
                                                    )}
                                                >
                                                    <span className="w-[13px] shrink-0" />
                                                    <Database size={12} className="shrink-0 text-success opacity-85" />
                                                    <span className="truncate">{dbName}</span>
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
