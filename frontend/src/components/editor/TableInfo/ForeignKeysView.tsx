import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import {
    GetForeignKeys,
    CreateForeignKey,
    DropForeignKey,
    UpdateForeignKey,
} from '../../../services/schemaService';
import { useConnectionStore } from '../../../stores/connectionStore';
import { useEnvironmentStore } from '../../../stores/environmentStore';
import { useSchemaStore } from '../../../stores/schemaStore';
import { useToast } from '../../layout/Toast';
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui';
import { getErrorMessage } from '../../../lib/errors';
import { useWriteSafetyGuard } from '../../../features/query/useWriteSafetyGuard';
import { ColumnPickerCell } from './ColumnPickerCell';
import { type TabAction } from './types';
import type { app } from '../../../../wailsjs/go/models';

// --- Types --------------------------------------------------------------------

type FKRule = 'NO ACTION' | 'RESTRICT' | 'CASCADE' | 'SET NULL' | 'SET DEFAULT';

const FK_RULE_OPTIONS: FKRule[] = ['NO ACTION', 'RESTRICT', 'CASCADE', 'SET NULL', 'SET DEFAULT'];

interface FKDraft {
    name: string;
    columns: string[];
    refSchema: string;
    refTable: string;
    refColumns: string[];
    onDelete: FKRule;
    onUpdate: FKRule;
}

interface FKRowState {
    id: string;
    original: FKDraft;
    current: FKDraft;
    deleted: boolean;
    isNew?: boolean;
}

// --- Helpers ------------------------------------------------------------------

const normalizeFKRule = (value: string | undefined): FKRule => {
    const n = (value || '').trim().toUpperCase().replace(/\s+/g, ' ');
    return FK_RULE_OPTIONS.includes(n as FKRule) ? (n as FKRule) : 'NO ACTION';
};

const cloneFKDraft = (d: FKDraft): FKDraft => ({
    name: d.name,
    columns: [...d.columns],
    refSchema: d.refSchema,
    refTable: d.refTable,
    refColumns: [...d.refColumns],
    onDelete: d.onDelete,
    onUpdate: d.onUpdate,
});

const mapFromFKInfo = (fk: app.ForeignKeyInfo): FKDraft => ({
    name: fk.Name || '',
    columns: [...(fk.Columns || [])],
    refSchema: fk.RefSchema || '',
    refTable: fk.RefTable || '',
    refColumns: [...(fk.RefColumns || [])],
    onDelete: normalizeFKRule(fk.OnDelete),
    onUpdate: normalizeFKRule(fk.OnUpdate),
});

const toFKPayload = (fk: FKDraft): app.ForeignKeyInfo => ({
    Name: fk.name.trim(),
    Columns: [...fk.columns],
    RefSchema: fk.refSchema.trim(),
    RefTable: fk.refTable.trim(),
    RefColumns: [...fk.refColumns],
    OnDelete: fk.onDelete,
    OnUpdate: fk.onUpdate,
});

const isFKDirty = (row: FKRowState): boolean =>
    row.deleted || JSON.stringify(row.original) !== JSON.stringify(row.current);

const isEmptyFKDraft = (fk: FKDraft): boolean =>
    !fk.name.trim() && fk.columns.length === 0 && !fk.refSchema.trim() && !fk.refTable.trim() && fk.refColumns.length === 0;

const toRefCacheKey = (s: string, t: string) => `${s}.${t}`;

// --- Props --------------------------------------------------------------------

interface ForeignKeysViewProps {
    schema: string;
    tableName: string;
    refreshKey: number;
    readOnlyMode?: boolean;
    isActive?: boolean;
    tableColumns?: string[];
    onActionsChange?: (actions: TabAction[]) => void;
    onDirtyCountChange?: (count: number) => void;
}

// --- Component ----------------------------------------------------------------

export const ForeignKeysView: React.FC<ForeignKeysViewProps> = ({
    schema,
    tableName,
    refreshKey,
    readOnlyMode = false,
    isActive = false,
    tableColumns = [],
    onActionsChange,
    onDirtyCountChange,
}) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [rows, setRows] = useState<FKRowState[]>([]);
    const [editingNameId, setEditingNameId] = useState<string | null>(null);
    const [refColumnCache, setRefColumnCache] = useState<Record<string, string[]>>({});
    const refColumnCacheRef = useRef<Record<string, string[]>>({});

    const { activeProfile } = useConnectionStore();
    const activeEnvironmentKey = useEnvironmentStore((s) => s.activeEnvironmentKey);
    const treeMap = useSchemaStore((s) => s.trees);
    const checkAndFetchColumns = useSchemaStore((s) => s.checkAndFetchColumns);
    const { toast } = useToast();
    const writeSafetyGuard = useWriteSafetyGuard(activeEnvironmentKey);

    // Schema/table options for dropdowns
    const schemaNodes = useMemo(() => {
        if (!activeProfile?.name || !activeProfile?.db_name) return [];
        return treeMap[`${activeProfile.name}:${activeProfile.db_name}`] ?? [];
    }, [activeProfile?.db_name, activeProfile?.name, treeMap]);

    const schemaOptions = useMemo(
        () => schemaNodes.map((n) => n.Name).sort((a, b) => a.localeCompare(b)),
        [schemaNodes],
    );

    const tablesBySchema = useMemo(() => {
        const map = new Map<string, string[]>();
        schemaNodes.forEach((node) => {
            const all = [...(node.Tables || []), ...(node.ForeignTables || [])]
                .filter(Boolean)
                .sort((a, b) => a.localeCompare(b));
            map.set(node.Name, all);
        });
        return map;
    }, [schemaNodes]);

    // -- Ref column cache ------------------------------------------------------

    const loadRefColumns = useCallback(async (refSchema: string, refTable: string) => {
        if (!activeProfile?.name || !activeProfile?.db_name || !refSchema || !refTable) return;
        const key = toRefCacheKey(refSchema, refTable);
        if (refColumnCacheRef.current[key]) return;
        try {
            const defs = await checkAndFetchColumns(activeProfile.name, activeProfile.db_name, refSchema, refTable);
            setRefColumnCache((prev) => {
                if (prev[key]) return prev;
                const next = { ...prev, [key]: defs.map((d) => d.Name) };
                refColumnCacheRef.current = next;
                return next;
            });
        } catch {
            setRefColumnCache((prev) => {
                if (prev[key]) return prev;
                const next = { ...prev, [key]: [] };
                refColumnCacheRef.current = next;
                return next;
            });
        }
    }, [activeProfile?.db_name, activeProfile?.name, checkAndFetchColumns]);

    // -- Load ------------------------------------------------------------------

    const load = useCallback(async () => {
        if (!activeProfile?.name) return;
        setLoading(true);
        try {
            const result = await GetForeignKeys(activeProfile.name, schema, tableName).catch(() => []);
            const fkRows = (result ?? []).map((fk, i) => {
                const current = mapFromFKInfo(fk);
                return { id: `fk-${i}-${current.name}`, original: cloneFKDraft(current), current, deleted: false };
            });
            setRows(fkRows);
            setEditingNameId(null);
            setRefColumnCache({});
            refColumnCacheRef.current = {};

            // Pre-load ref columns for existing FKs
            const uniqueTargets = new Set<string>();
            fkRows.forEach((row) => {
                if (row.current.refSchema && row.current.refTable) {
                    uniqueTargets.add(toRefCacheKey(row.current.refSchema, row.current.refTable));
                }
            });
            await Promise.all([...uniqueTargets].map(async (key) => {
                const [s, t] = key.split('.');
                await loadRefColumns(s, t);
            }));
        } catch (error: unknown) {
            toast.error(`Failed to load foreign keys: ${getErrorMessage(error)}`);
        } finally {
            setLoading(false);
        }
    }, [activeProfile?.name, loadRefColumns, schema, tableName, toast]);

    useEffect(() => { void load(); }, [load, refreshKey]);

    // Auto-load ref columns when rows change
    useEffect(() => {
        rows.forEach((row) => {
            if (row.deleted) return;
            if (!row.current.refSchema || !row.current.refTable) return;
            void loadRefColumns(row.current.refSchema, row.current.refTable);
        });
    }, [rows, loadRefColumns]);

    // -- Dirty -----------------------------------------------------------------

    const dirtyCount = useMemo(
        () => rows.filter((row) => row.isNew || row.deleted || isFKDirty(row)).length,
        [rows],
    );
    useEffect(() => { onDirtyCountChange?.(dirtyCount); }, [dirtyCount, onDirtyCountChange]);

    // -- Update row ------------------------------------------------------------

    const updateRow = useCallback((rowId: string, patch: Partial<FKDraft>) => {
        setRows((prev) => prev.map((row) => {
            if (row.id !== rowId) return row;
            const next: FKDraft = { ...row.current, ...patch };
            if (patch.refSchema !== undefined || patch.refTable !== undefined) {
                next.refColumns = [];
            }
            return { ...row, current: next };
        }));
    }, []);

    // -- Validate --------------------------------------------------------------

    const validateDraft = useCallback((fk: FKDraft): string | null => {
        if (!fk.name.trim()) return 'Foreign key name is required';
        if (fk.columns.length === 0) return `"${fk.name}" needs at least one source column`;
        if (!fk.refSchema.trim()) return `"${fk.name}" requires a referenced schema`;
        if (!fk.refTable.trim()) return `"${fk.name}" requires a referenced table`;
        if (fk.refColumns.length === 0) return `"${fk.name}" needs at least one referenced column`;
        if (fk.columns.length !== fk.refColumns.length) {
            return `"${fk.name}" source/ref column counts must match`;
        }
        const cacheKey = toRefCacheKey(fk.refSchema, fk.refTable);
        const available = refColumnCache[cacheKey];
        if (Array.isArray(available) && available.length > 0) {
            const invalid = fk.refColumns.find((c) => !available.includes(c));
            if (invalid) return `"${fk.name}" referenced column "${invalid}" is no longer valid`;
        }
        return null;
    }, [refColumnCache]);

    // -- Discard ---------------------------------------------------------------

    const discard = useCallback(() => {
        setEditingNameId(null);
        setRows((prev) => prev
            .filter((row) => !row.isNew)
            .map((row) => ({ ...row, current: cloneFKDraft(row.original), deleted: false })));
    }, []);

    // -- Save ------------------------------------------------------------------

    const save = useCallback(async () => {
        if (readOnlyMode || !activeProfile?.name) return;

        const toDrop = rows.filter((row) => !row.isNew && row.deleted);
        const toCreate = rows.filter((row) => row.isNew && !row.deleted && !isEmptyFKDraft(row.current));
        const toUpdate = rows.filter((row) => !row.isNew && !row.deleted && isFKDirty(row));
        if (!toDrop.length && !toCreate.length && !toUpdate.length) return;

        for (const row of [...toCreate, ...toUpdate]) {
            const err = validateDraft(row.current);
            if (err) { toast.error(err); return; }
        }

        const ops: Array<'create' | 'drop'> = [
            ...toDrop.map(() => 'drop' as const),
            ...toCreate.map(() => 'create' as const),
            ...toUpdate.flatMap(() => ['drop', 'create'] as const),
        ];

        const summaryLines = [
            ...toDrop.map((r) => `• Drop: ${r.original.name}`),
            ...toCreate.map((r) => `• Create: ${r.current.name} (${r.current.columns.join(', ')}) → ${r.current.refSchema}.${r.current.refTable}(${r.current.refColumns.join(', ')})`),
            ...toUpdate.map((r) => `• Update: ${r.original.name} → ${r.current.name}`),
        ];

        const guard = await writeSafetyGuard.guardOperations(ops, 'Apply Foreign Key Changes', summaryLines);
        if (!guard.allowed) {
            if (guard.blockedReason) toast.error(guard.blockedReason);
            return;
        }

        setSaving(true);
        try {
            for (const row of toDrop) {
                await DropForeignKey(activeProfile.name, schema, tableName, row.original.name);
            }
            for (const row of toCreate) {
                await CreateForeignKey(activeProfile.name, schema, tableName, toFKPayload(row.current));
            }
            for (const row of toUpdate) {
                await UpdateForeignKey(activeProfile.name, schema, tableName, row.original.name, toFKPayload(row.current));
            }
            toast.success('Foreign key changes applied');
            await load();
        } catch (error: unknown) {
            toast.error(`Failed to apply foreign key changes: ${getErrorMessage(error)}`);
        } finally {
            setSaving(false);
        }
    }, [activeProfile?.name, load, readOnlyMode, rows, schema, tableName, toast, validateDraft, writeSafetyGuard]);

    // -- Actions ---------------------------------------------------------------

    const hasChanges = dirtyCount > 0;

    const actions = useMemo<TabAction[]>(() => {
        if (readOnlyMode) return [];
        const result: TabAction[] = [];
        if (!saving) {
            result.push({
                id: 'fk-add',
                icon: <Plus size={12} />,
                label: 'Add FK',
                title: 'Add Foreign Key',
                onClick: () => {
                    const draft: FKDraft = {
                        name: '', columns: [], refSchema: schema, refTable: '',
                        refColumns: [], onDelete: 'NO ACTION', onUpdate: 'NO ACTION',
                    };
                    const row: FKRowState = {
                        id: `fk-new-${Date.now()}`,
                        original: cloneFKDraft(draft),
                        current: draft,
                        deleted: false,
                        isNew: true,
                    };
                    setRows((prev) => [...prev, row]);
                    setEditingNameId(row.id);
                },
            });
        }
        if (hasChanges) {
            result.push({
                id: 'fk-discard',
                icon: <RotateCcw size={12} />,
                label: 'Discard',
                title: 'Discard pending changes',
                onClick: discard,
                disabled: saving,
                danger: true,
            });
            result.push({
                id: 'fk-save',
                icon: <Save size={12} />,
                label: 'Save',
                title: 'Save Foreign Key Changes',
                onClick: () => { void save(); },
                disabled: saving,
                loading: saving,
            });
        }
        return result;
    }, [readOnlyMode, saving, hasChanges, schema, discard, save]);

    useEffect(() => { onActionsChange?.(actions); }, [onActionsChange, actions]);

    // -- Keyboard --------------------------------------------------------------

    useEffect(() => {
        if (!isActive) return;
        const h = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if ((e.key === 's' || e.key === 'S') && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                void save();
            }
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [isActive, save]);

    // -- Render ----------------------------------------------------------------

    if (loading) {
        return <div className="px-3 py-4 text-[11px] text-muted-foreground">Loading...</div>;
    }

    return (
        <div className="flex flex-col min-h-0">
            <div className="px-3 py-2 flex flex-col gap-2">
                {rows.length === 0 && (
                    <p className="text-[11px] text-muted-foreground italic py-2">No foreign keys defined.</p>
                )}
                {rows.map((row) => {
                    const refTableOptions = tablesBySchema.get(row.current.refSchema) ?? [];
                    const refColumnOptions = row.current.refSchema && row.current.refTable
                        ? (refColumnCache[toRefCacheKey(row.current.refSchema, row.current.refTable)] ?? [])
                        : [];
                    const rowDirty = isFKDirty(row);

                    return (
                        <div
                            key={row.id}
                            className={`rounded border px-2.5 py-2 ${row.deleted ? 'border-error/50 bg-error/5 opacity-70' : 'border-border/60 bg-background/60'}`}
                        >
                            {/* Header row: name + badges + delete */}
                            <div className="flex items-center gap-2 mb-2">
                                {editingNameId === row.id && !readOnlyMode && !row.deleted ? (
                                    <Input
                                        autoFocus
                                        placeholder="fk_constraint_name"
                                        value={row.current.name}
                                        onChange={(e) => updateRow(row.id, { name: e.target.value })}
                                        onBlur={() => setEditingNameId(null)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                            if (e.key === 'Escape') setEditingNameId(null);
                                        }}
                                        disabled={saving}
                                        className="rt-cell-input font-mono min-w-45 w-55"
                                    />
                                ) : (
                                    <span
                                        className={`font-mono text-[12px] truncate cursor-pointer hover:text-accent ${row.isNew ? 'text-success' : 'text-foreground font-medium'} ${row.deleted ? 'opacity-50 cursor-default pointer-events-none' : ''}`}
                                        title={row.current.name}
                                        onClick={() => !readOnlyMode && !row.deleted && setEditingNameId(row.id)}
                                        onDoubleClick={() => !readOnlyMode && !row.deleted && setEditingNameId(row.id)}
                                    >
                                        {row.current.name || <span className="italic text-muted-foreground/50">untitled</span>}
                                    </span>
                                )}
                                {row.isNew && <span className="text-[9px] font-bold text-success bg-success/10 px-1 py-0.5 rounded">NEW</span>}
                                {!row.isNew && rowDirty && !row.deleted && (
                                    <span className="text-[9px] font-bold text-warning bg-warning/10 px-1 py-0.5 rounded">EDITED</span>
                                )}
                                {row.deleted && (
                                    <span className="text-[9px] font-bold text-error bg-error/10 px-1 py-0.5 rounded">DROP PENDING</span>
                                )}
                                {!readOnlyMode && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => {
                                            if (row.isNew) {
                                                setRows((prev) => prev.filter((r) => r.id !== row.id));
                                                return;
                                            }
                                            if (row.deleted) {
                                                setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, deleted: false } : r));
                                                return;
                                            }
                                            setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, deleted: true } : r));
                                        }}
                                        disabled={saving}
                                        className="ml-auto h-6 px-2 text-[11px] text-error/70 hover:text-error"
                                    >
                                        <Trash2 size={11} />
                                    </Button>
                                )}
                            </div>

                            {/* Grid fields */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Source Columns</p>
                                    <ColumnPickerCell
                                        columns={tableColumns}
                                        selected={row.current.columns}
                                        onChange={(cols) => updateRow(row.id, { columns: cols })}
                                        onClose={() => {}}
                                        autoOpen={false}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Referenced Schema</p>
                                    <Select
                                        value={row.current.refSchema || undefined}
                                        onValueChange={(value) => updateRow(row.id, { refSchema: value, refTable: '' })}
                                        disabled={readOnlyMode || saving || row.deleted}
                                    >
                                        <SelectTrigger className="h-7 font-mono text-[12px]">
                                            <SelectValue placeholder="Select schema" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {schemaOptions.map((s) => (
                                                <SelectItem key={s} value={s}>{s}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Referenced Table</p>
                                    <Select
                                        value={row.current.refTable || undefined}
                                        onValueChange={(value) => {
                                            updateRow(row.id, { refTable: value });
                                            void loadRefColumns(row.current.refSchema, value);
                                        }}
                                        disabled={readOnlyMode || saving || row.deleted || !row.current.refSchema}
                                    >
                                        <SelectTrigger className="h-7 font-mono text-[12px]">
                                            <SelectValue placeholder="Select table" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {refTableOptions.map((t) => (
                                                <SelectItem key={t} value={t}>{t}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Referenced Columns</p>
                                    <ColumnPickerCell
                                        columns={refColumnOptions}
                                        selected={row.current.refColumns}
                                        onChange={(cols) => updateRow(row.id, { refColumns: cols })}
                                        onClose={() => {}}
                                        autoOpen={false}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">ON DELETE</p>
                                    <Select
                                        value={row.current.onDelete}
                                        onValueChange={(value) => updateRow(row.id, { onDelete: normalizeFKRule(value) })}
                                        disabled={readOnlyMode || saving || row.deleted}
                                    >
                                        <SelectTrigger className="h-7 font-mono text-[12px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {FK_RULE_OPTIONS.map((rule) => (
                                                <SelectItem key={`del-${rule}`} value={rule}>{rule}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">ON UPDATE</p>
                                    <Select
                                        value={row.current.onUpdate}
                                        onValueChange={(value) => updateRow(row.id, { onUpdate: normalizeFKRule(value) })}
                                        disabled={readOnlyMode || saving || row.deleted}
                                    >
                                        <SelectTrigger className="h-7 font-mono text-[12px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {FK_RULE_OPTIONS.map((rule) => (
                                                <SelectItem key={`upd-${rule}`} value={rule}>{rule}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            {writeSafetyGuard.modals}
        </div>
    );
};
