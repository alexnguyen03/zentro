import React from 'react';
import { Database, Eye, Hash, Layers, Link2, List, Search, Sigma, Table2, Type, Zap } from 'lucide-react';
import { ModalBackdrop } from '../ui';
import { cn } from '../../lib/cn';
import { useConnectionStore } from '../../stores/connectionStore';
import { useSchemaStore, type SchemaNode } from '../../stores/schemaStore';
import { FetchDatabaseSchema } from '../../services/schemaService';
import { onSchemaLoaded } from '../../lib/events';
import { useEditorStore } from '../../stores/editorStore';
import { TAB_TYPE } from '../../lib/constants';
import { useToast } from './Toast';
import { getErrorMessage } from '../../lib/errors';

type ObjectKind =
    | 'table'
    | 'foreign_table'
    | 'view'
    | 'materialized_view'
    | 'function'
    | 'index'
    | 'sequence'
    | 'data_type'
    | 'aggregate_function';

interface SearchItem {
    id: string;
    kind: ObjectKind;
    schema: string;
    name: string;
    qualifiedName: string;
    keywords: string;
}

const KIND_LABEL: Record<ObjectKind, string> = {
    table: 'Table',
    foreign_table: 'Foreign Table',
    view: 'View',
    materialized_view: 'Materialized View',
    function: 'Function / SP',
    index: 'Index',
    sequence: 'Sequence',
    data_type: 'Data Type',
    aggregate_function: 'Aggregate Function',
};

const KIND_ICON: Record<ObjectKind, React.ReactNode> = {
    table: <Table2 size={14} />,
    foreign_table: <Link2 size={14} />,
    view: <Eye size={14} />,
    materialized_view: <Layers size={14} />,
    function: <Zap size={14} />,
    index: <Hash size={14} />,
    sequence: <List size={14} />,
    data_type: <Type size={14} />,
    aggregate_function: <Sigma size={14} />,
};

const DEFAULT_ENABLED_KINDS: ObjectKind[] = [
    'table',
    'view',
    'index',
    'function',
];

const PRIMARY_VISIBLE_KINDS: ObjectKind[] = ['table', 'index', 'view', 'function'];

interface Props {
    onClose: () => void;
}

function quoteIdent(name: string, driver: string | undefined): string {
    if (driver === 'mysql') return `\`${name.replace(/`/g, '``')}\``;
    if (driver === 'sqlserver') return `[${name.replace(/]/g, ']]')}]`;
    return `"${name.replace(/"/g, '""')}"`;
}

function buildFunctionTemplate(item: SearchItem, driver: string | undefined): string {
    const s = quoteIdent(item.schema, driver);
    const n = quoteIdent(item.name, driver);

    if (driver === 'sqlserver') {
        return [
            `-- ${item.qualifiedName} (${KIND_LABEL[item.kind]})`,
            '-- TODO: adjust arguments',
            `EXEC ${s}.${n} @param1 = NULL;`,
            '',
        ].join('\n');
    }

    if (driver === 'mysql') {
        return [
            `-- ${item.qualifiedName} (${KIND_LABEL[item.kind]})`,
            '-- TODO: adjust arguments',
            `CALL ${s}.${n}(/* args */);`,
            '',
        ].join('\n');
    }

    if (driver === 'sqlite') {
        return [
            `-- ${item.qualifiedName} (${KIND_LABEL[item.kind]})`,
            '-- SQLite may not support stored procedures the same way as server databases.',
            `-- Try adapting to: SELECT * FROM ${s}.${n}(/* args */);`,
            '-- Or use your DB-specific CALL/EXEC syntax if available.',
            '',
        ].join('\n');
    }

    return [
        `-- ${item.qualifiedName} (${KIND_LABEL[item.kind]})`,
        '-- TODO: adjust arguments',
        `SELECT * FROM ${s}.${n}(/* args */);`,
        '',
    ].join('\n');
}

function buildInfoTemplate(item: SearchItem): string {
    return [`-- ${KIND_LABEL[item.kind]}: ${item.qualifiedName}`, '-- Add query here'].join('\n');
}

function buildItems(schemas: SchemaNode[] | undefined): SearchItem[] {
    if (!schemas) return [];

    const out: SearchItem[] = [];
    const idCount = new Map<string, number>();
    for (const s of schemas) {
        const pushItems = (kind: ObjectKind, names?: string[]) => {
            (names || []).forEach((name) => {
                const qualifiedName = `${s.Name}.${name}`;
                const idBase = `${kind}:${qualifiedName}`;
                const nextCount = (idCount.get(idBase) ?? 0) + 1;
                idCount.set(idBase, nextCount);
                out.push({
                    id: `${idBase}:${nextCount}`,
                    kind,
                    schema: s.Name,
                    name,
                    qualifiedName,
                    keywords: `${name} ${qualifiedName} ${kind} ${KIND_LABEL[kind]}`.toLowerCase(),
                });
            });
        };

        pushItems('table', s.Tables);
        pushItems('foreign_table', s.ForeignTables);
        pushItems('view', s.Views);
        pushItems('materialized_view', s.MaterializedViews);
        pushItems('function', s.Functions);
        pushItems('index', s.Indexes);
        pushItems('sequence', s.Sequences);
        pushItems('data_type', s.DataTypes);
        pushItems('aggregate_function', s.AggregateFunctions);
    }

    return out;
}

function fuzzyScore(needle: string, haystack: string): number {
    if (!needle) return 1;
    if (haystack.includes(needle)) return 1000 - haystack.indexOf(needle);

    let score = 0;
    let hIdx = 0;
    let streak = 0;

    for (let i = 0; i < needle.length; i++) {
        const ch = needle[i];
        let found = false;
        while (hIdx < haystack.length) {
            if (haystack[hIdx] === ch) {
                found = true;
                streak++;
                score += 10 + streak * 2;
                hIdx++;
                break;
            }
            streak = 0;
            hIdx++;
        }
        if (!found) return 0;
    }

    return score;
}

export const ContextSearchDialog: React.FC<Props> = ({ onClose }) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const activeItemRef = React.useRef<HTMLButtonElement>(null);
    const { toast } = useToast();

    const { activeProfile, isConnected } = useConnectionStore();
    const setTree = useSchemaStore((s) => s.setTree);
    const setLoading = useSchemaStore((s) => s.setLoading);
    const addTab = useEditorStore((s) => s.addTab);

    const profileName = activeProfile?.name || '';
    const dbName = activeProfile?.db_name || '';
    const schemaKey = `${profileName}:${dbName}`;
    const schemas = useSchemaStore((s) => s.trees[schemaKey]);
    const isLoading = useSchemaStore((s) => s.loadingKeys.has(schemaKey));

    const [query, setQuery] = React.useState('');
    const [activeIndex, setActiveIndex] = React.useState(0);
    const [enabledKinds, setEnabledKinds] = React.useState<Set<ObjectKind>>(new Set(DEFAULT_ENABLED_KINDS));
    const [showAllKinds, setShowAllKinds] = React.useState(false);

    React.useEffect(() => {
        inputRef.current?.focus();
    }, []);

    React.useEffect(() => {
        if (!isConnected || !profileName || !dbName || schemas || isLoading) return;
        setLoading(profileName, dbName, true);
        FetchDatabaseSchema(profileName, dbName).catch((err) => {
            setLoading(profileName, dbName, false);
            toast.error(`Failed to load schema: ${getErrorMessage(err)}`);
        });
    }, [dbName, isConnected, isLoading, profileName, schemas, setLoading, toast]);

    React.useEffect(() => {
        const offLoaded = onSchemaLoaded((payload) => {
            if (payload.profileName !== profileName || payload.dbName !== dbName) return;
            setTree(profileName, dbName, payload.schemas);
            setLoading(profileName, dbName, false);
        });

        return () => {
            if (typeof offLoaded === 'function') offLoaded();
        };
    }, [dbName, profileName, setLoading, setTree]);

    const allItems = React.useMemo(() => buildItems(schemas), [schemas]);

    const filtered = React.useMemo(() => {
        const q = query.trim().toLowerCase();
        const base = allItems.filter((item) => enabledKinds.has(item.kind));
        if (!q) return base.slice(0, 400);

        return base
            .map((item) => ({ item, score: fuzzyScore(q, item.keywords) }))
            .filter((entry) => entry.score > 0)
            .sort((a, b) => b.score - a.score)
            .map((entry) => entry.item)
            .slice(0, 400);
    }, [allItems, enabledKinds, query]);

    React.useEffect(() => {
        setActiveIndex(0);
    }, [query, enabledKinds, schemas]);

    React.useEffect(() => {
        activeItemRef.current?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex]);

    const openItem = React.useCallback((item: SearchItem) => {
        const displayName = `${item.schema}.${item.name}`;
        if (
            item.kind === 'table' ||
            item.kind === 'view' ||
            item.kind === 'materialized_view' ||
            item.kind === 'foreign_table'
        ) {
            addTab({
                type: TAB_TYPE.TABLE,
                name: displayName,
                content: displayName,
                query: '',
            });
            onClose();
            return;
        }

        if (item.kind === 'function') {
            addTab({
                type: TAB_TYPE.QUERY,
                name: displayName,
                query: buildFunctionTemplate(item, activeProfile?.driver),
            });
            onClose();
            return;
        }

        addTab({
            type: TAB_TYPE.QUERY,
            name: displayName,
            query: buildInfoTemplate(item),
            readOnly: true,
        });
        onClose();
    }, [activeProfile?.driver, addTab, onClose]);

    React.useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
                return;
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex((i) => Math.max(i - 1, 0));
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                const item = filtered[activeIndex];
                if (item) openItem(item);
            }
        };

        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [activeIndex, filtered, onClose, openItem]);

    const toggleKind = (kind: ObjectKind) => {
        setEnabledKinds((prev) => {
            const next = new Set(prev);
            if (next.has(kind)) next.delete(kind);
            else next.add(kind);
            if (next.size === 0) next.add(kind);
            return next;
        });
    };

    const emptyMessage = React.useMemo(() => {
        if (!isConnected || !activeProfile) return 'No active connection';
        if (isLoading && !schemas) return 'Loading schema...';
        if (!schemas) return 'No schema loaded';
        return `No matches for "${query}"`;
    }, [activeProfile, isConnected, isLoading, query, schemas]);

    return (
        <ModalBackdrop onClose={onClose} className="items-start pt-[15vh]">
            <div
                className="w-[720px] max-h-[560px] flex flex-col bg-bg-secondary border border-border rounded-md shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden animate-in slide-in-from-top-3 duration-150"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border bg-bg-secondary shrink-0">
                    <Search size={15} className="text-text-muted shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search tables, views, functions..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="flex-1 bg-transparent border-none outline-none text-sm text-text-primary placeholder:text-text-muted"
                        autoComplete="off"
                        spellCheck={false}
                    />
                    <span className=" text-xs text-text-muted shrink-0 inline-flex items-center gap-1">
                        <Database size={11} />
                        {dbName || 'No DB'}
                    </span>
                </div>

                <div className="px-3 py-2 border-b border-border bg-bg-primary/40 flex items-center gap-2 flex-wrap">
                    {(showAllKinds ? (Object.keys(KIND_LABEL) as ObjectKind[]) : PRIMARY_VISIBLE_KINDS).map((kind) => {
                        const active = enabledKinds.has(kind);
                        return (
                            <button
                                key={kind}
                                onClick={() => toggleKind(kind)}
                                className={cn(
                                    'flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] border transition-colors cursor-pointer whitespace-nowrap',
                                    active
                                        ? 'bg-success/15 text-text-primary border-success/40'
                                        : 'bg-bg-secondary text-text-secondary border-border hover:bg-bg-tertiary',
                                )}
                            >
                                {KIND_ICON[kind]}
                                <span>{KIND_LABEL[kind]}</span>
                            </button>
                        );
                    })}
                    <button
                        onClick={() =>
                            setShowAllKinds((prev) => {
                                const next = !prev;
                                if (!next) {
                                    setEnabledKinds((current) => {
                                        const filteredSet = new Set(
                                            [...current].filter((kind) => PRIMARY_VISIBLE_KINDS.includes(kind)),
                                        );
                                        if (filteredSet.size === 0) {
                                            PRIMARY_VISIBLE_KINDS.forEach((kind) => filteredSet.add(kind));
                                        }
                                        return filteredSet;
                                    });
                                }
                                return next;
                            })
                        }
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] border transition-colors cursor-pointer whitespace-nowrap bg-bg-secondary text-text-secondary border-border hover:bg-bg-tertiary"
                    >
                        <span>{showAllKinds ? 'Less' : 'More'}</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto py-1">
                    {filtered.length === 0 ? (
                        <div className="px-4 py-8 text-center text-[12px] text-text-muted">
                            {emptyMessage}
                        </div>
                    ) : (
                        filtered.map((item, idx) => {
                            const isActive = idx === activeIndex;
                            return (
                                <button
                                    key={item.id}
                                    ref={isActive ? activeItemRef : undefined}
                                    className={cn(
                                        'w-full flex items-center justify-between px-4 py-2 text-left transition-colors duration-75 text-[13px] group cursor-pointer border-none bg-transparent',
                                        isActive
                                            ? 'bg-success/10 text-text-primary'
                                            : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary',
                                    )}
                                    onClick={() => openItem(item)}
                                    onMouseEnter={() => setActiveIndex(idx)}
                                >
                                    <span className="flex items-center gap-2 min-w-0">
                                        <span className={cn('shrink-0', isActive && 'text-success')}>{KIND_ICON[item.kind]}</span>
                                        <span className="truncate font-medium">{item.name}</span>
                                    </span>
                                    <span className="flex items-center gap-2 ml-4 shrink-0">
                                        <span className="text-[10px] uppercase tracking-wide text-text-muted">{KIND_LABEL[item.kind]}</span>
                                        <span className="text-[11px] text-text-muted">{item.schema}</span>
                                    </span>
                                </button>
                            );
                        })
                    )}
                </div>

            </div>
        </ModalBackdrop>
    );
};
