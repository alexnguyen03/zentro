import React, { useState, useEffect, useCallback } from 'react';
import { ChevronRight, ChevronDown, Database, Pencil, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { LoadConnections, LoadDatabasesForProfile } from '../../services/connectionService';
import { cn } from '../../lib/cn';
import { getProvider } from '../../lib/providers';
import { Button, Input, Spinner } from '../ui';
import type { ConnectionProfile } from '../../types/connection';

interface DatabaseTreePickerProps {
    onSelect: (profile: ConnectionProfile, database: string) => void;
    selectedProfile?: string | null;
    selectedDatabase?: string;
    connectionsOverride?: ConnectionProfile[];
    disableAutoLoad?: boolean;
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
    connectionsOverride,
    disableAutoLoad = false,
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

    const toConnectionNodes = useCallback((profiles: ConnectionProfile[], previous: ConnectionNode[] = []): ConnectionNode[] => {
        const previousByName = new Map(previous.map((node) => [node.profile.name, node]));
        return (profiles || []).map((profile: ConnectionProfile) => {
            const existing = profile.name ? previousByName.get(profile.name) : undefined;
            return {
                profile,
                databases: existing?.databases || [],
                loadingDatabases: false,
                databasesLoaded: existing?.databasesLoaded || false,
            };
        });
    }, []);

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
        if (connectionsOverride) {
            setConnections((prev) => toConnectionNodes(connectionsOverride, prev));
            setLoading(false);
            return;
        }
        if (disableAutoLoad) {
            setConnections([]);
            setLoading(false);
            return;
        }

        let cancelled = false;
        setLoading(true);

        LoadConnections()
            .then((loaded) => {
                if (cancelled) return;

                setConnections((prev) => toConnectionNodes(loaded || [], prev));
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
    }, [connectionsOverride, disableAutoLoad, toConnectionNodes]);

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
            const shouldLoad = expandedConnections.has(name) || name === selectedProfile;
            if (shouldLoad && !node.databasesLoaded && !node.loadingDatabases) {
                void loadDatabasesForConnection(name);
            }
        });
    }, [connections, expandedConnections, loadDatabasesForConnection, selectedProfile]);

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
            isExpanded: expandedConnections.has(name),
            profileSelected: name === selectedProfile,
            connectionMatched,
            visibleDatabases,
        });
        return acc;
    }, []);

    return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <div className="shrink-0">
                <div className="flex items-center gap-1.5 p-1.5">
                    <div className="relative min-w-0 flex-1">
                        <Search size={12} className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-muted-foreground/80" />
                        <Input
                            type="text"
                            value={filter}
                            onChange={(event) => setFilter(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Escape') setFilter('');
                            }}
                            placeholder="Filter connections or databases..."
                            className="w-full  pr-2 pl-7 placeholder:text-muted-foreground/70"
                        />
                    </div>
                    {filter && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setFilter('')}
                            className="text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            title="Clear filter"
                        >
                            <X size={13} />
                        </Button>
                    )}
                    {onImport && (
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={handleImport}
                            disabled={importing || importDisabled}
                            className={cn(
                                'bg-muted/50 text-muted-foreground transition-colors',
                                importing || importDisabled
                                    ? 'cursor-not-allowed opacity-55'
                                    : 'cursor-pointer hover:bg-muted hover:text-foreground',
                            )}
                            title={importDisabled ? 'Import disabled in this context' : 'Import connection package'}
                        >
                            {importing ? <Spinner size={13} /> : <Upload size={14} />}
                        </Button>
                    )}
                    {onAddNew && (
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={onAddNew}
                            className="bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                            title="Add new connection"
                        >
                            <Plus size={14} />
                        </Button>
                    )}
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
                {loading ? (
                    <div className="flex h-40 items-center justify-center gap-2 rounded-sm bg-muted/35 text-small text-muted-foreground">
                        <Spinner size={14} /> Loading connections...
                    </div>
                ) : connections.length === 0 ? (
                    <div className="flex h-40 flex-col items-center justify-center gap-2.5 rounded-sm bg-muted/30 px-6 text-center text-small leading-5 text-muted-foreground">
                        <span>No saved connections yet.</span>
                        {onAddNew && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={onAddNew}
                                className="gap-1.5 rounded-sm bg-muted/60 text-label"
                            >
                                <Plus size={12} /> Add connection
                            </Button>
                        )}
                    </div>
                ) : visibleConnections.length === 0 ? (
                    <div className="flex h-40 items-center justify-center rounded-sm bg-muted/30 px-6 text-center text-small leading-5 text-muted-foreground">
                        No matches found.
                    </div>
                ) : (
                    visibleConnections.map(({ name, node, isExpanded, profileSelected, connectionMatched, visibleDatabases }) => {
                        const hostLabel = node.profile.host
                            ? `${node.profile.host}${node.profile.port ? `:${node.profile.port}` : ''}`
                            : '';
                        const provider = getProvider(node.profile.driver || '');
                        return (
                            <div
                                key={name}
                                className={cn(
                                    'group mb-2 rounded-sm mx-2 transition-colors',
                                    profileSelected ? 'bg-accent/8' : 'bg-muted/40 hover:bg-muted/60',
                                )}
                            >
                                {/* Card header — click anywhere to toggle */}
                                <Button
                                    type="button"
                                    onClick={() => toggleConnection(name)}
                                    className={cn(
                                        'flex h-9 w-full border-none items-center gap-2.5 px-3 py-2.5 text-left bg-transparent hover:bg-transparent hover:opacity-80' ,
                                        
                                    )}
                                    title={name}
                                >
                                    <img
                                        src={provider.icon}
                                        alt={provider.label}
                                        className="h-5 w-5 shrink-0 object-contain"
                                        title={provider.label}
                                    />
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-small font-semibold text-foreground">{name}</div>
                                        {hostLabel && (
                                            <div className="truncate text-label text-muted-foreground">{hostLabel}</div>
                                        )}
                                    </div>

                                    {/* Edit / Delete — visible on group hover, stop propagation so they don't toggle */}
                                    {(onEditConnection || onDeleteConnection) && (
                                        <div
                                            className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {onEditConnection && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="rounded-sm p-1 text-muted-foreground hover:bg-accent/10 hover:text-accent"
                                                    title={`Edit ${name}`}
                                                    onClick={(event) => handleEditConnection(event, node.profile)}
                                                >
                                                    <Pencil size={12} />
                                                </Button>
                                            )}
                                            {onDeleteConnection && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="rounded-sm p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                                                    title={`Delete ${name}`}
                                                    onClick={(event) => handleDeleteConnection(event, node.profile)}
                                                    disabled={deletingConnectionName === name}
                                                >
                                                    {deletingConnectionName === name ? <Spinner size={11} /> : <Trash2 size={12} />}
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </Button>

                                {/* Databases — only rendered when expanded */}
                                {isExpanded && (
                                    <div className="px-2 pb-2 pt-1">
                                        {node.loadingDatabases ? (
                                            <div className="flex items-center gap-2 px-2 py-1.5 text-small text-muted-foreground">
                                                <Spinner size={12} /> Loading databases...
                                            </div>
                                        ) : visibleDatabases.length === 0 && node.databasesLoaded ? (
                                            <div className="px-2 py-1.5 text-label text-muted-foreground">
                                                {node.databases.length === 0 ? 'No databases found' : 'No matches'}
                                            </div>
                                        ) : (
                                            visibleDatabases.map((dbName) => {
                                                const isDbSelected = profileSelected && dbName === selectedDatabase;
                                                return (
                                                    <Button
                                                        key={dbName}
                                                        type="button"
                                                        variant="ghost"
                                                        onClick={() => handleSelect(name, dbName)}
                                                        className={cn(
                                                            'mt-0.5 w-full justify-start gap-1.5 rounded-sm px-2 py-1.5 text-left text-small transition-colors',
                                                            isDbSelected
                                                                ? 'bg-accent/15 text-foreground'
                                                                : 'text-foreground hover:bg-muted/70',
                                                        )}
                                                    >
                                                        <Database size={12} className={cn('shrink-0', isDbSelected ? 'text-accent' : 'text-success opacity-85')} />
                                                        <span className="truncate">{dbName}</span>
                                                        {dbName === node.profile.db_name && (
                                                            <span className="ml-auto shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-label text-muted-foreground">
                                                                default
                                                            </span>
                                                        )}
                                                    </Button>
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


