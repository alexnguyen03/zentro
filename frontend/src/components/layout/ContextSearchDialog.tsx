import React from 'react';
import { ChevronsDownUp, ChevronsUpDown, Database, Eye, Hash, Layers, Link2, List, Sigma, Table2, Type, Zap } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useConnectionStore } from '../../stores/connectionStore';
import { useSchemaStore, type SchemaNode } from '../../stores/schemaStore';
import { FetchDatabaseSchema, FetchTableColumns } from '../../services/schemaService';
import { onSchemaLoaded } from '../../lib/events';
import { useEditorStore } from '../../stores/editorStore';
import { TAB_TYPE } from '../../lib/constants';
import { useToast } from './Toast';
import { getErrorMessage } from '../../lib/errors';
import { models } from '../../../wailsjs/go/models';
import {
    Button,
    Command,
    CommandEmpty,
    CommandInput,
    CommandItem,
    CommandList,
    OverlayDialog,
} from '../ui';

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

type ItemAction = 'browse' | 'select' | 'insert' | 'update' | 'alter' | 'open';

interface ItemContextMenu {
    x: number;
    y: number;
    item: SearchItem;
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

const DEFAULT_ENABLED_KINDS: ObjectKind[] = ['table', 'view', 'index', 'function'];
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

function buildSelectTemplate(item: SearchItem, driver: string | undefined): string {
    const s = quoteIdent(item.schema, driver);
    const n = quoteIdent(item.name, driver);
    return `SELECT *\nFROM ${s}.${n}\nLIMIT 100;\n`;
}

function buildInsertTemplate(item: SearchItem, columns: models.ColumnDef[], driver: string | undefined): string {
    const s = quoteIdent(item.schema, driver);
    const n = quoteIdent(item.name, driver);
    if (columns.length === 0) {
        return [
            `INSERT INTO ${s}.${n} (`,
            '    -- column1, column2',
            ') VALUES (',
            '    -- value1, value2',
            ');',
            '',
        ].join('\n');
    }
    const cols = columns.map((c) => quoteIdent(c.Name, driver)).join(', ');
    const vals = columns.map((c) => `-- ${c.Name} (${c.DataType})`).join(',\n    ');
    return [
        `INSERT INTO ${s}.${n} (${cols})`,
        `VALUES (`,
        `    ${vals}`,
        `);`,
        '',
    ].join('\n');
}

function buildUpdateTemplate(item: SearchItem, columns: models.ColumnDef[], driver: string | undefined): string {
    const s = quoteIdent(item.schema, driver);
    const n = quoteIdent(item.name, driver);
    const sets = columns
        .filter((c) => !c.IsPrimaryKey)
        .map((c) => `    ${quoteIdent(c.Name, driver)} = -- ${c.DataType}`)
        .join(',\n');
    const pkCols = columns.filter((c) => c.IsPrimaryKey);
    const where = pkCols.length > 0
        ? pkCols.map((c) => `    ${quoteIdent(c.Name, driver)} = -- ${c.DataType}`).join('\n    AND ')
        : '    -- add condition here';
    return [
        `UPDATE ${s}.${n}`,
        `SET`,
        sets || '    -- col = value',
        `WHERE`,
        where,
        `;`,
        '',
    ].join('\n');
}

function buildAlterTemplate(item: SearchItem, driver: string | undefined): string {
    const s = quoteIdent(item.schema, driver);
    const n = quoteIdent(item.name, driver);

    return [
        `ALTER TABLE ${s}.${n}`,
        'ADD COLUMN -- new_column data_type;',
        '',
    ].join('\n');
}

const isTableLike = (kind: ObjectKind) =>
    kind === 'table' || kind === 'view' || kind === 'materialized_view' || kind === 'foreign_table';

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
    const { toast } = useToast();

    const { activeProfile, isConnected } = useConnectionStore();
    const setTree = useSchemaStore((state) => state.setTree);
    const setLoading = useSchemaStore((state) => state.setLoading);
    const addTab = useEditorStore((state) => state.addTab);

    const profileName = activeProfile?.name || '';
    const dbName = activeProfile?.db_name || '';
    const schemaKey = `${profileName}:${dbName}`;
    const schemas = useSchemaStore((state) => state.trees[schemaKey]);
    const isLoading = useSchemaStore((state) => state.loadingKeys.has(schemaKey));

    const [query, setQuery] = React.useState('');
    const [enabledKinds, setEnabledKinds] = React.useState<Set<ObjectKind>>(new Set(DEFAULT_ENABLED_KINDS));
    const [showAllKinds, setShowAllKinds] = React.useState(false);
    const [contextMenu, setContextMenu] = React.useState<ItemContextMenu | null>(null);

    React.useEffect(() => {
        if (!isConnected || !profileName || !dbName || schemas || isLoading) return;
        setLoading(profileName, dbName, true);
        FetchDatabaseSchema(profileName, dbName).catch((error) => {
            setLoading(profileName, dbName, false);
            toast.error(`Failed to load schema: ${getErrorMessage(error)}`);
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
        const closeContextMenu = () => setContextMenu(null);
        window.addEventListener('click', closeContextMenu);
        window.addEventListener('scroll', closeContextMenu, true);
        return () => {
            window.removeEventListener('click', closeContextMenu);
            window.removeEventListener('scroll', closeContextMenu, true);
        };
    }, []);

    const runItemAction = React.useCallback(
        async (item: SearchItem, action: ItemAction) => {
            const displayName = `${item.schema}.${item.name}`;
            if (isTableLike(item.kind)) {
                const driver = activeProfile?.driver;

                if (action === 'browse' || action === 'open') {
                    addTab({ type: TAB_TYPE.TABLE, name: displayName, content: displayName, query: '' });
                    onClose();
                    return;
                }

                if (action === 'select') {
                    addTab({ type: TAB_TYPE.QUERY, name: displayName, query: buildSelectTemplate(item, driver) });
                    onClose();
                    return;
                }

                if (action === 'alter') {
                    addTab({
                        type: TAB_TYPE.QUERY,
                        name: `ALTER ${displayName}`,
                        query: buildAlterTemplate(item, driver),
                    });
                    onClose();
                    return;
                }

                const columns = await FetchTableColumns(item.schema, item.name).catch(() => []);
                if ((action === 'insert' || action === 'update') && columns.length === 0) {
                    toast.info(`Could not load columns for ${displayName}. Generated a generic template.`);
                }

                if (action === 'insert') {
                    addTab({
                        type: TAB_TYPE.QUERY,
                        name: `INSERT ${displayName}`,
                        query: buildInsertTemplate(item, columns, driver),
                    });
                    onClose();
                    return;
                }

                if (action === 'update') {
                    addTab({
                        type: TAB_TYPE.QUERY,
                        name: `UPDATE ${displayName}`,
                        query: buildUpdateTemplate(item, columns, driver),
                    });
                    onClose();
                    return;
                }

                return;
            }

            if (item.kind === 'function' && (action === 'browse' || action === 'open')) {
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
        },
        [activeProfile?.driver, addTab, onClose, toast],
    );

    const handleEnterBrowseFirst = React.useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key !== 'Enter') return;
        if (filtered.length === 0) return;
        event.preventDefault();
        event.stopPropagation();
        void runItemAction(filtered[0], 'browse');
    }, [filtered, runItemAction]);

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
        <OverlayDialog onClose={onClose} className="items-start pt-[15vh]">
            <div
                className="w-[720px] max-h-[560px] flex flex-col bg-card border border-border rounded-sm shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden animate-in slide-in-from-top-3 duration-150"
                onClick={(event) => event.stopPropagation()}
            >
                <Command shouldFilter={false} loop className="h-full bg-card text-foreground">
                    <div className="relative border-b border-border">
                        <CommandInput
                            value={query}
                            onValueChange={setQuery}
                            placeholder="Search tables, views, functions..."
                            hideIcon
                            className="pr-56"
                            onKeyDown={handleEnterBrowseFirst}
                        />
                        <div className="absolute top-1/2 right-3 -translate-y-1/2 inline-flex items-center gap-1">
                            <Button
                                type="button"
                                variant="secondary"
                                title={showAllKinds ? 'Show fewer object types' : 'Show more object types'}
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
                            >
                                {showAllKinds ? <ChevronsDownUp size={13} /> : <ChevronsUpDown size={13} />}
                            </Button>
                            <span className="pointer-events-none text-xs text-muted-foreground inline-flex items-center gap-1">
                                <Database size={11} />
                                {dbName || 'No DB'}
                            </span>
                        </div>
                    </div>

                    <div className="px-3 py-2 border-b border-border bg-background/40 flex items-center gap-2 flex-wrap">
                        {(showAllKinds ? (Object.keys(KIND_LABEL) as ObjectKind[]) : PRIMARY_VISIBLE_KINDS).map((kind) => {
                            const active = enabledKinds.has(kind);
                            return (
                                <Button
                                    key={kind}
                                    type="button"
                                    variant={active ? 'secondary' : 'ghost'}
                                    className={cn(
                                        'h-7 gap-1.5 px-2 text-[11px] border whitespace-nowrap',
                                        active ? 'border-primary/40 bg-primary/15 text-foreground' : 'text-muted-foreground',
                                    )}
                                    onClick={() => toggleKind(kind)}
                                >
                                    {KIND_ICON[kind]}
                                    <span>{KIND_LABEL[kind]}</span>
                                </Button>
                            );
                        })}
                    </div>

                    <CommandList className="max-h-[430px] py-1">
                        <CommandEmpty>{emptyMessage}</CommandEmpty>
                        {filtered.map((item) => (
                            <CommandItem
                                key={item.id}
                                value={`${item.qualifiedName} ${KIND_LABEL[item.kind]} ${item.schema}`}
                                onSelect={() => void runItemAction(item, 'browse')}
                                onContextMenu={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setContextMenu({ x: event.clientX, y: event.clientY, item });
                                }}
                                className="group flex items-center justify-between px-4 py-2 text-[13px] data-[selected=true]:bg-primary/10"
                            >
                                <span className="flex min-w-0 items-center gap-2">
                                    <span className="shrink-0 group-data-[selected=true]:text-primary">{KIND_ICON[item.kind]}</span>
                                    <span className="truncate font-medium">{item.name}</span>
                                </span>
                                <span className="ml-4 flex shrink-0 items-center gap-2">
                                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                        {KIND_LABEL[item.kind]}
                                    </span>
                                    <span className="text-[11px] text-muted-foreground">{item.schema}</span>
                                </span>
                            </CommandItem>
                        ))}
                    </CommandList>
                </Command>
            </div>
            {contextMenu && (
                <div
                    className="fixed z-popover w-40 rounded-sm border border-border bg-card py-1 shadow-[0_8px_24px_rgba(0,0,0,0.32)]"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={(event) => event.stopPropagation()}
                >
                    {isTableLike(contextMenu.item.kind) ? (
                        <>
                            <Button
                                type="button"
                                variant="ghost"
                                className="h-auto w-full justify-start rounded-none px-3 py-1.5 text-[12px]"
                                onClick={() => {
                                    setContextMenu(null);
                                    void runItemAction(contextMenu.item, 'browse');
                                }}
                            >
                                Browse
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                className="h-auto w-full justify-start rounded-none px-3 py-1.5 text-[12px]"
                                onClick={() => {
                                    setContextMenu(null);
                                    void runItemAction(contextMenu.item, 'select');
                                }}
                            >
                                Select
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                className="h-auto w-full justify-start rounded-none px-3 py-1.5 text-[12px]"
                                onClick={() => {
                                    setContextMenu(null);
                                    void runItemAction(contextMenu.item, 'insert');
                                }}
                            >
                                Insert
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                className="h-auto w-full justify-start rounded-none px-3 py-1.5 text-[12px]"
                                onClick={() => {
                                    setContextMenu(null);
                                    void runItemAction(contextMenu.item, 'update');
                                }}
                            >
                                Update
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                className="h-auto w-full justify-start rounded-none px-3 py-1.5 text-[12px]"
                                onClick={() => {
                                    setContextMenu(null);
                                    void runItemAction(contextMenu.item, 'alter');
                                }}
                            >
                                Alter
                            </Button>
                        </>
                    ) : (
                        <Button
                            type="button"
                            variant="ghost"
                            className="h-auto w-full justify-start rounded-none px-3 py-1.5 text-[12px]"
                            onClick={() => {
                                setContextMenu(null);
                                void runItemAction(contextMenu.item, 'open');
                            }}
                        >
                            Open
                        </Button>
                    )}
                </div>
            )}
        </OverlayDialog>
    );
};
