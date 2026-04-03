import React, { useState, useEffect, useCallback } from 'react';
import { ChevronRight, ChevronDown, Server, Database, Pencil, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { LoadConnections, LoadDatabasesForProfile } from '../../services/connectionService';
import { cn } from '../../lib/cn';
import { Spinner } from './Spinner';
import type { ConnectionProfile } from '../../types/connection';

interface DatabaseTreePickerProps {
    onSelect: (profile: ConnectionProfile, database: string) => void;
    selectedProfile?: string | null;
    selectedDatabase?: string;
    onAddNew?: () => void;
    onImport?: () => void | Promise<void>;
    importing?: boolean;
    importDisabled?: boolean;
    onEditConnection?: (profile: ConnectionProfile) => void;
    onDeleteConnection?: (profile: ConnectionProfile) => void;
    deletingConnectionName?: string | null;
}

interface ConnectionNode {
    profile: ConnectionProfile;
    databases: string[];
    loadingDatabases: boolean;
    databasesLoaded: boolean;
}

interface VisibleConnectionNode {
    name: string;
    node: ConnectionNode;
    isExpanded: boolean;
    profileSelected: boolean;
    connectionMatched: boolean;
    visibleDatabases: string[];
}

export const DatabaseTreePicker: React.FC<DatabaseTreePickerProps> = ({
    onSelect,
    selectedProfile,
    selectedDatabase,
    onAddNew,
    onImport,
    importing = false,
    importDisabled = false,
    onEditConnection,
    onDeleteConnection,
    deletingConnectionName = null,
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

    const handleImport = useCallback(() => {
        if (!onImport || importing || importDisabled) return;
        void onImport();
    }, [importDisabled, importing, onImport]);

    const handleEditConnection = useCallback((event: React.MouseEvent, profile: ConnectionProfile) => {
        event.stopPropagation();
        onEditConnection?.(profile);
    }, [onEditConnection]);

    const handleDeleteConnection = useCallback((event: React.MouseEvent, profile: ConnectionProfile) => {
        event.stopPropagation();
        onDeleteConnection?.(profile);
    }, [onDeleteConnection]);

    const visibleConnections: VisibleConnectionNode[] = connections.reduce<VisibleConnectionNode[]>((acc, node) => {
        const name = node.profile.name || '';
        if (!name) return acc;

        const connectionHaystack = `${name} ${node.profile.driver || ''} ${node.profile.host || ''} ${node.profile.port || ''}`.toLowerCase();
        const connectionMatched = lowerFilter.length > 0 && connectionHaystack.includes(lowerFilter);
        const filteredDatabases = node.databases.filter((db) => !lowerFilter || db.toLowerCase().includes(lowerFilter));
        const visibleDatabases = lowerFilter && connectionMatched ? node.databases : filteredDatabases;
        const showConnection = !lowerFilter || connectionMatched || filteredDatabases.length > 0;

        if (!showConnection) return acc;

        acc.push({
            name,
            node,
            isExpanded: lowerFilter ? true : expandedConnections.has(name),
            profileSelected: name === selectedProfile,
            connectionMatched,
            visibleDatabases,
        });
        return acc;
    }, []);

    return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <div className="shrink-0 border-b border-border/25 pb-2">
                <div className="flex items-center gap-1.5 rounded-md bg-muted/55 p-1.5">
                    <div className="relative min-w-0 flex-1">
                        <Search size={12} className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-muted-foreground/80" />
                        <input
                            type="text"
                            value={filter}
                            onChange={(event) => setFilter(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Escape') setFilter('');
                            }}
                            placeholder="Filter connections or databases..."
                            className="h-8 w-full rounded-md border border-border/60 bg-background/90 pr-2 pl-7 text-[12px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-success focus-visible:ring-1 focus-visible:ring-accent/45"
                        />
                    </div>
                    {filter && (
                        <button
                            type="button"
                            onClick={() => setFilter('')}
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/45"
                            title="Clear filter"
                        >
                            <X size={13} />
                        </button>
                    )}
                    {onAddNew && (
                        <button
                            type="button"
                            onClick={onAddNew}
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-border/45 bg-background/50 text-muted-foreground transition-colors hover:border-border/80 hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/45"
                            title="Add new connection"
                        >
                            <Plus size={14} />
                        </button>
                    )}
                    {onImport && (
                        <button
                            type="button"
                            onClick={handleImport}
                            disabled={importing || importDisabled}
                            className={cn(
                                'flex h-8 w-8 items-center justify-center rounded-md border border-border/45 bg-background/50 text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/45',
                                importing || importDisabled
                                    ? 'cursor-not-allowed opacity-55'
                                    : 'cursor-pointer hover:border-border/80 hover:bg-background hover:text-foreground',
                            )}
                            title={importDisabled ? 'Import disabled in this context' : 'Import connection package'}
                        >
                            {importing ? <Spinner size={13} /> : <Upload size={14} />}
                        </button>
                    )}
                </div>
            </div>

            <div className="mt-2 min-h-0 flex-1 overflow-y-auto pr-0.5">
                {loading ? (
                    <div className="flex h-40 items-center justify-center gap-2 rounded-md bg-muted/35 text-[12px] text-muted-foreground">
                        <Spinner size={14} /> Loading connections...
                    </div>
                ) : connections.length === 0 ? (
                    <div className="flex h-40 items-center justify-center rounded-md border border-dashed border-border/35 bg-background/20 px-6 text-center text-[12px] leading-5 text-muted-foreground">
                        No saved connections yet.
                    </div>
                ) : visibleConnections.length === 0 ? (
                    <div className="flex h-40 items-center justify-center rounded-md border border-border/25 bg-background/20 px-6 text-center text-[12px] leading-5 text-muted-foreground">
                        No matches found.
                    </div>
                ) : (
                    visibleConnections.map(({ name, node, isExpanded, profileSelected, connectionMatched, visibleDatabases }) => {
                        const hostLabel = node.profile.host
                            ? `${node.profile.host}${node.profile.port ? `:${node.profile.port}` : ''}`
                            : '';
                        return (
                            <div key={name} className="mb-1">
                                <div className="group relative">
                                    <button
                                        type="button"
                                        onClick={() => toggleConnection(name)}
                                        className={cn(
                                            'w-full rounded-md border px-2.5 py-1.5 pr-14 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/45',
                                            profileSelected
                                                ? 'border-accent/25 bg-accent/8'
                                                : 'border-transparent hover:bg-muted/65',
                                        )}
                                        title={name}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            {isExpanded ? (
                                                <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
                                            ) : (
                                                <ChevronRight size={14} className="shrink-0 text-muted-foreground" />
                                            )}
                                            <Server
                                                size={13}
                                                className={cn(
                                                    'shrink-0',
                                                    profileSelected || connectionMatched ? 'text-accent' : 'text-success',
                                                )}
                                            />
                                            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground">
                                                {name}
                                            </span>
                                            {node.loadingDatabases && <Spinner size={12} className="shrink-0 text-muted-foreground" />}
                                        </div>
                                        <div className="mt-0.5 flex items-center gap-1.5 pl-5 text-[11px] text-muted-foreground">
                                            <span className="truncate">{node.profile.driver || 'unknown driver'}</span>
                                            {hostLabel && (
                                                <>
                                                    <span className="opacity-65">|</span>
                                                    <span className="truncate">{hostLabel}</span>
                                                </>
                                            )}
                                        </div>
                                    </button>

                                    {(onEditConnection || onDeleteConnection) && (
                                        <div className="pointer-events-none absolute top-2 right-2 flex items-center gap-1 opacity-0 transition-opacity duration-100 group-hover:opacity-100">
                                            {onEditConnection && (
                                                <button
                                                    type="button"
                                                    className="pointer-events-auto flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-border/45 bg-background/70 text-muted-foreground transition-colors hover:border-border/80 hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/45"
                                                    title={`Edit ${name}`}
                                                    onClick={(event) => handleEditConnection(event, node.profile)}
                                                >
                                                    <Pencil size={12} />
                                                </button>
                                            )}
                                            {onDeleteConnection && (
                                                <button
                                                    type="button"
                                                    className="pointer-events-auto flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-border/45 bg-background/70 text-muted-foreground transition-colors hover:border-destructive/50 hover:bg-destructive/12 hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/45"
                                                    title={`Delete ${name}`}
                                                    onClick={(event) => handleDeleteConnection(event, node.profile)}
                                                    disabled={deletingConnectionName === name}
                                                >
                                                    {deletingConnectionName === name ? <Spinner size={12} /> : <Trash2 size={12} />}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {isExpanded && (
                                    <div className="mt-1 ml-[14px] border-l border-border/35 pl-3">
                                        {node.loadingDatabases ? (
                                            <div className="flex items-center gap-2 px-2 py-1 text-[12px] text-muted-foreground">
                                                <Spinner size={12} /> Loading databases...
                                            </div>
                                        ) : visibleDatabases.length === 0 && node.databasesLoaded ? (
                                            <div className="px-2 py-1 text-[12px] text-muted-foreground">
                                                {node.databases.length === 0 ? 'No databases found' : 'No matches'}
                                            </div>
                                        ) : (
                                            visibleDatabases.map((dbName) => {
                                                const isDbSelected = profileSelected && dbName === selectedDatabase;
                                                return (
                                                    <button
                                                        key={dbName}
                                                        type="button"
                                                        onClick={() => handleSelect(name, dbName)}
                                                        className={cn(
                                                            'mt-1 flex w-full cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/45',
                                                            isDbSelected
                                                                ? 'border-accent/35 bg-accent/10 text-foreground'
                                                                : 'border-transparent text-foreground hover:bg-muted/70',
                                                        )}
                                                    >
                                                        <Database size={12} className={cn('shrink-0', isDbSelected ? 'text-accent' : 'text-success opacity-85')} />
                                                        <span className="truncate">{dbName}</span>
                                                        {dbName === node.profile.db_name && (
                                                            <span className="ml-auto shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
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
                    })
                )}
            </div>
        </div>
    );
};


