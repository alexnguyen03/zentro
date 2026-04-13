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
import {
    Button,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../../ui';
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

type EditField = 'name' | 'columns' | 'refSchema' | 'refTable' | 'refColumns' | 'onDelete' | 'onUpdate';

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
const normalizeIdent = (value: string) => value.trim().toLowerCase();

// --- FKSelectCell -------------------------------------------------------------
// Renders a Select that auto-opens when mounted (edit mode).
// Uses a ref to programmatically click the trigger after mount so that
// Radix can measure and position the dropdown correctly.

interface FKSelectCellProps {
    value: string | undefined;
    options: string[];
    placeholder?: string;
    disabled?: boolean;
    onValueChange: (value: string) => void;
    onClose: () => void;
}

const FKSelectCell: React.FC<FKSelectCellProps> = ({
    value, options, placeholder, disabled, onValueChange, onClose,
}) => {
    const triggerRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        // Defer one frame so the trigger is painted before we open it
        const id = requestAnimationFrame(() => {
            triggerRef.current?.click();
        });
        return () => cancelAnimationFrame(id);
    }, []);

    return (
        <Select
            value={value}
            onValueChange={(v) => { onValueChange(v); onClose(); }}
            onOpenChange={(open) => { if (!open) onClose(); }}
            disabled={disabled}
        >
            <SelectTrigger ref={triggerRef} className="h-6 font-mono text-[11px] border-accent w-full">
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
                {options.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
};

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
    const [editCell, setEditCell] = useState<{ rowId: string; field: EditField } | null>(null);
    const [refColumnCache, setRefColumnCache] = useState<Record<string, string[]>>({});
    const refColumnCacheRef = useRef<Record<string, string[]>>({});
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [dragStartRowId, setDragStartRowId] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const { activeProfile } = useConnectionStore();
    const activeEnvironmentKey = useEnvironmentStore((s) => s.activeEnvironmentKey);
    const treeMap = useSchemaStore((s) => s.trees);
    const checkAndFetchColumns = useSchemaStore((s) => s.checkAndFetchColumns);
    const { toast } = useToast();
    const writeSafetyGuard = useWriteSafetyGuard(activeEnvironmentKey);

    // Schema/table options
    const schemaNodes = useMemo(() => {
        if (!activeProfile?.name || !activeProfile?.db_name) return [];
        return treeMap[`${activeProfile.name}:${activeProfile.db_name}`] ?? [];
    }, [activeProfile?.db_name, activeProfile?.name, treeMap]);

    const schemaOptions = useMemo(() => {
        const byNormalized = new Map<string, string>();

        schemaNodes.forEach((node) => {
            const name = node.Name?.trim() || '';
            if (!name) return;
            byNormalized.set(normalizeIdent(name), name);
        });

        // Fallback: keep referenced schemas visible even when schema tree is stale/partial.
        rows.forEach((row) => {
            const name = row.current.refSchema?.trim() || '';
            if (!name) return;
            const key = normalizeIdent(name);
            if (!byNormalized.has(key)) byNormalized.set(key, name);
        });

        return [...byNormalized.values()].sort((a, b) => a.localeCompare(b));
    }, [rows, schemaNodes]);

    const tablesBySchema = useMemo(() => {
        const tableSetsBySchema = new Map<string, Set<string>>();

        const ensureSet = (schemaName: string): Set<string> => {
            const key = normalizeIdent(schemaName);
            const existing = tableSetsBySchema.get(key);
            if (existing) return existing;
            const next = new Set<string>();
            tableSetsBySchema.set(key, next);
            return next;
        };

        schemaNodes.forEach((node) => {
            const schemaName = node.Name?.trim() || '';
            if (!schemaName) return;
            const targetSet = ensureSet(schemaName);
            [...(node.Tables || []), ...(node.ForeignTables || [])]
                .filter(Boolean)
                .forEach((tableName) => targetSet.add(tableName));
        });

        // Fallback: keep referenced tables visible even when schema tree is stale/partial.
        rows.forEach((row) => {
            const refSchema = row.current.refSchema?.trim() || '';
            const refTable = row.current.refTable?.trim() || '';
            if (!refSchema || !refTable) return;
            ensureSet(refSchema).add(refTable);
        });

        const map = new Map<string, string[]>();
        tableSetsBySchema.forEach((tableSet, normalizedSchema) => {
            map.set(normalizedSchema, [...tableSet].sort((a, b) => a.localeCompare(b)));
        });
        return map;
    }, [rows, schemaNodes]);

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
            setEditCell(null);
            setSelectedRows(new Set());
            setRefColumnCache({});
            refColumnCacheRef.current = {};

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

    // -- Row mutations ---------------------------------------------------------

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

    const discardRow = useCallback((id: string) => {
        setRows((prev) => prev.map((r) =>
            r.id === id
                ? { ...r, current: cloneFKDraft(r.original), deleted: false }
                : r,
        ));
        setEditCell(null);
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
        setEditCell(null);
        setSelectedRows(new Set());
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

    // -- Selection -------------------------------------------------------------

    const rowIds = useMemo(() => rows.map((r) => r.id), [rows]);

    const handleRowMouseDown = useCallback((e: React.MouseEvent, rowId: string) => {
        if (e.button !== 0) return;
        setIsDragging(true);
        setDragStartRowId(rowId);
        if (e.ctrlKey || e.metaKey) {
            setSelectedRows((prev) => {
                const next = new Set(prev);
                if (next.has(rowId)) next.delete(rowId);
                else next.add(rowId);
                return next;
            });
        } else if (e.shiftKey && selectedRows.size > 0) {
            const currentIdx = rowIds.indexOf(rowId);
            if (currentIdx === -1) return;
            const anchorId = dragStartRowId && rowIds.includes(dragStartRowId)
                ? dragStartRowId
                : Array.from(selectedRows)[0];
            const anchorIdx = rowIds.indexOf(anchorId);
            if (anchorIdx === -1) return;
            const min = Math.min(anchorIdx, currentIdx);
            const max = Math.max(anchorIdx, currentIdx);
            const next = new Set<string>();
            for (let i = min; i <= max; i++) next.add(rowIds[i]);
            setSelectedRows(next);
        } else {
            setSelectedRows(new Set([rowId]));
        }
    }, [dragStartRowId, rowIds, selectedRows]);

    const handleRowMouseEnter = useCallback((rowId: string) => {
        if (!isDragging || dragStartRowId === null) return;
        const startIdx = rowIds.indexOf(dragStartRowId);
        const currentIdx = rowIds.indexOf(rowId);
        if (startIdx === -1 || currentIdx === -1) return;
        const min = Math.min(startIdx, currentIdx);
        const max = Math.max(startIdx, currentIdx);
        const next = new Set<string>();
        for (let i = min; i <= max; i++) next.add(rowIds[i]);
        setSelectedRows(next);
    }, [dragStartRowId, rowIds, isDragging]);

    useEffect(() => {
        const h = () => { setIsDragging(false); setDragStartRowId(null); };
        window.addEventListener('mouseup', h);
        return () => window.removeEventListener('mouseup', h);
    }, []);

    const toggleDeleteSelected = useCallback(() => {
        if (readOnlyMode || !selectedRows.size) return;
        setRows((prev) =>
            prev
                .map((r) => {
                    if (!selectedRows.has(r.id)) return r;
                    if (r.isNew) return null as never;
                    return { ...r, deleted: !r.deleted };
                })
                .filter(Boolean) as FKRowState[],
        );
        setSelectedRows(new Set());
        setEditCell(null);
    }, [readOnlyMode, selectedRows]);

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
                    setEditCell({ rowId: row.id, field: 'name' });
                    setSelectedRows(new Set());
                },
            });
        }
        if (selectedRows.size > 0) {
            result.push({
                id: 'fk-delete-selected',
                icon: <Trash2 size={12} />,
                label: 'Delete',
                title: 'Delete selected',
                onClick: toggleDeleteSelected,
                disabled: saving,
                danger: true,
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
    }, [readOnlyMode, saving, hasChanges, schema, selectedRows.size, discard, save, toggleDeleteSelected]);

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
            if (e.key === 'Delete' || (e.key === 'Backspace' && (e.ctrlKey || e.metaKey))) {
                toggleDeleteSelected();
            }
            if (e.key === 'Escape') {
                setSelectedRows(new Set());
                setEditCell(null);
            }
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [isActive, save, toggleDeleteSelected]);

    // -- Render ----------------------------------------------------------------

    if (loading) {
        return <div className="px-3 py-4 text-[11px] text-muted-foreground">Loading...</div>;
    }

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-background">
            {writeSafetyGuard.modals}

            <div className="flex-1 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-auto scrollbar-thin">
                    <Table
                        className="result-table-tanstack border-collapse table-fixed select-none"
                        style={{ width: '100%', minWidth: '900px' }}
                    >
                        <TableHeader className="[&_tr]:border-b-0">
                            <TableRow className="border-b-2 border-border hover:bg-transparent">
                                <TableHead className="rt-th w-10 font-mono text-[10px] text-muted-foreground">
                                    <div className="rt-th-label justify-center">#</div>
                                </TableHead>
                                <TableHead className="rt-th" style={{ width: '160px' }}>
                                    <div className="rt-th-label">Name</div>
                                </TableHead>
                                <TableHead className="rt-th" style={{ width: '160px' }}>
                                    <div className="rt-th-label">Source Columns</div>
                                </TableHead>
                                <TableHead className="rt-th" style={{ width: '110px' }}>
                                    <div className="rt-th-label">Ref Schema</div>
                                </TableHead>
                                <TableHead className="rt-th" style={{ width: '140px' }}>
                                    <div className="rt-th-label">Ref Table</div>
                                </TableHead>
                                <TableHead className="rt-th" style={{ width: '160px' }}>
                                    <div className="rt-th-label">Ref Columns</div>
                                </TableHead>
                                <TableHead className="rt-th" style={{ width: '120px' }}>
                                    <div className="rt-th-label">On Delete</div>
                                </TableHead>
                                <TableHead className="rt-th" style={{ width: '120px' }}>
                                    <div className="rt-th-label">On Update</div>
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-border/20 [&_tr:last-child]:border-b">
                            {rows.map((row, displayIdx) => {
                                const isDeleted = row.deleted;
                                const isNew = row.isNew;
                                const isDirty = isFKDirty(row);
                                const isSelected = selectedRows.has(row.id);

                                const isEditingName = editCell?.rowId === row.id && editCell.field === 'name';
                                const isEditingCols = editCell?.rowId === row.id && editCell.field === 'columns';
                                const isEditingRefSchema = editCell?.rowId === row.id && editCell.field === 'refSchema';
                                const isEditingRefTable = editCell?.rowId === row.id && editCell.field === 'refTable';
                                const isEditingRefCols = editCell?.rowId === row.id && editCell.field === 'refColumns';
                                const isEditingOnDelete = editCell?.rowId === row.id && editCell.field === 'onDelete';
                                const isEditingOnUpdate = editCell?.rowId === row.id && editCell.field === 'onUpdate';

                                const refTableOptions = tablesBySchema.get(normalizeIdent(row.current.refSchema || '')) ?? [];
                                const refColumnOptions = row.current.refSchema && row.current.refTable
                                    ? (refColumnCache[toRefCacheKey(row.current.refSchema, row.current.refTable)] ?? [])
                                    : [];

                                const rowCls = `
                                    group relative transition-all duration-150
                                    ${displayIdx % 2 !== 0 ? 'rt-row-alt' : ''}
                                    ${isSelected ? 'rt-row-selected' : ''}
                                    ${isDeleted ? 'rt-row-deleted' : ''}
                                `;

                                return (
                                    <TableRow
                                        key={row.id}
                                        className={`${rowCls} border-b-0 hover:bg-transparent`}
                                        onMouseDown={(e) => handleRowMouseDown(e, row.id)}
                                        onMouseEnter={() => handleRowMouseEnter(row.id)}
                                    >
                                        {/* # */}
                                        <TableCell className="w-10 text-center border-b border-border">
                                            <div
                                                className="rt-cell-content rt-cell-content--compact row-num-col"
                                                onDoubleClick={() => (isDirty || isDeleted) && !isNew && discardRow(row.id)}
                                                title={(isDirty || isDeleted) && !isNew ? 'Double-click to discard changes' : undefined}
                                            >
                                                {displayIdx + 1}
                                            </div>
                                        </TableCell>

                                        {/* Name */}
                                        <TableCell className="p-0 border-b border-border" style={{ width: '160px' }}>
                                            {isEditingName ? (
                                                <Input
                                                    autoFocus
                                                    onFocus={(e) => e.target.select()}
                                                    placeholder="fk_constraint_name"
                                                    className="rt-cell-input font-mono"
                                                    value={row.current.name}
                                                    onChange={(e) => updateRow(row.id, { name: e.target.value })}
                                                    onBlur={() => setEditCell(null)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                                        if (e.key === 'Escape') setEditCell(null);
                                                    }}
                                                    disabled={saving}
                                                />
                                            ) : (
                                                <div
                                                    className={`rt-cell-content rt-cell-content--compact font-medium
                                                        ${isDeleted ? 'opacity-40' : ''}
                                                        ${!readOnlyMode && !isDeleted ? 'cursor-pointer' : ''}
                                                    `}
                                                    title={row.current.name || '(unnamed)'}
                                                    onDoubleClick={() => !readOnlyMode && !isDeleted && setEditCell({ rowId: row.id, field: 'name' })}
                                                >
                                                    <span className="truncate font-mono text-[11px]">
                                                        {row.current.name || <span className="italic text-muted-foreground/50">untitled</span>}
                                                    </span>
                                                    {isNew && (
                                                        <span className="ml-1.5 text-[9px] font-bold text-success bg-success/10 px-1 py-0.5 rounded shrink-0">NEW</span>
                                                    )}
                                                    {!isNew && isDirty && !isDeleted && (
                                                        <span className="ml-1.5 text-[9px] font-bold text-warning bg-warning/10 px-1 py-0.5 rounded shrink-0">EDITED</span>
                                                    )}
                                                    {isDeleted && (
                                                        <span className="ml-1.5 text-[9px] font-bold text-error bg-error/10 px-1 py-0.5 rounded shrink-0">DROP</span>
                                                    )}
                                                </div>
                                            )}
                                        </TableCell>

                                        {/* Source Columns */}
                                        <TableCell className="p-0 border-b border-border" style={{ width: '160px' }}>
                                            {isEditingCols ? (
                                                <div
                                                    className="px-1.5 py-0.75"
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                >
                                                    <ColumnPickerCell
                                                        columns={tableColumns}
                                                        selected={row.current.columns}
                                                        onChange={(cols) => updateRow(row.id, { columns: cols })}
                                                        onClose={() => setEditCell(null)}
                                                        autoOpen
                                                    />
                                                </div>
                                            ) : (
                                                <div
                                                    className={`rt-cell-content rt-cell-content--compact font-mono text-[11px] text-muted-foreground
                                                        ${isDeleted ? 'opacity-40' : ''}
                                                        ${!readOnlyMode && !isDeleted ? 'cursor-pointer' : ''}
                                                    `}
                                                    title={row.current.columns.join(', ')}
                                                    onDoubleClick={() => !readOnlyMode && !isDeleted && setEditCell({ rowId: row.id, field: 'columns' })}
                                                >
                                                    {row.current.columns.length > 0
                                                        ? row.current.columns.join(', ')
                                                        : <span className="italic text-muted-foreground/40">select cols</span>}
                                                </div>
                                            )}
                                        </TableCell>

                                        {/* Ref Schema */}
                                        <TableCell className="p-0 border-b border-border" style={{ width: '110px' }}>
                                            {isEditingRefSchema ? (
                                                <div
                                                    className="px-1 py-0.5"
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                >
                                                    <FKSelectCell
                                                        value={row.current.refSchema || undefined}
                                                        options={schemaOptions}
                                                        placeholder="schema"
                                                        disabled={saving}
                                                        onValueChange={(value) => updateRow(row.id, { refSchema: value, refTable: '' })}
                                                        onClose={() => setEditCell(null)}
                                                    />
                                                </div>
                                            ) : (
                                                <div
                                                    className={`rt-cell-content rt-cell-content--compact font-mono text-[11px] text-muted-foreground
                                                        ${isDeleted ? 'opacity-40' : ''}
                                                        ${!readOnlyMode && !isDeleted ? 'cursor-pointer' : ''}
                                                    `}
                                                    title={row.current.refSchema}
                                                    onDoubleClick={() => !readOnlyMode && !isDeleted && setEditCell({ rowId: row.id, field: 'refSchema' })}
                                                >
                                                    {row.current.refSchema || <span className="italic text-muted-foreground/40">schema</span>}
                                                </div>
                                            )}
                                        </TableCell>

                                        {/* Ref Table */}
                                        <TableCell className="p-0 border-b border-border" style={{ width: '140px' }}>
                                            {isEditingRefTable ? (
                                                <div
                                                    className="px-1 py-0.5"
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                >
                                                    <FKSelectCell
                                                        value={row.current.refTable || undefined}
                                                        options={refTableOptions}
                                                        placeholder="table"
                                                        disabled={saving}
                                                        onValueChange={(value) => {
                                                            updateRow(row.id, { refTable: value });
                                                            void loadRefColumns(row.current.refSchema, value);
                                                        }}
                                                        onClose={() => setEditCell(null)}
                                                    />
                                                </div>
                                            ) : (
                                                <div
                                                    className={`rt-cell-content rt-cell-content--compact font-mono text-[11px] text-muted-foreground
                                                        ${isDeleted ? 'opacity-40' : ''}
                                                        ${!readOnlyMode && !isDeleted ? 'cursor-pointer' : ''}
                                                    `}
                                                    title={row.current.refTable}
                                                    onDoubleClick={() => !readOnlyMode && !isDeleted && setEditCell({ rowId: row.id, field: 'refTable' })}
                                                >
                                                    {row.current.refTable || <span className="italic text-muted-foreground/40">table</span>}
                                                </div>
                                            )}
                                        </TableCell>

                                        {/* Ref Columns */}
                                        <TableCell className="p-0 border-b border-border" style={{ width: '160px' }}>
                                            {isEditingRefCols ? (
                                                <div
                                                    className="px-1.5 py-0.75"
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                >
                                                    <ColumnPickerCell
                                                        columns={refColumnOptions}
                                                        selected={row.current.refColumns}
                                                        onChange={(cols) => updateRow(row.id, { refColumns: cols })}
                                                        onClose={() => setEditCell(null)}
                                                        autoOpen
                                                    />
                                                </div>
                                            ) : (
                                                <div
                                                    className={`rt-cell-content rt-cell-content--compact font-mono text-[11px] text-muted-foreground
                                                        ${isDeleted ? 'opacity-40' : ''}
                                                        ${!readOnlyMode && !isDeleted ? 'cursor-pointer' : ''}
                                                    `}
                                                    title={row.current.refColumns.join(', ')}
                                                    onDoubleClick={() => {
                                                        if (readOnlyMode || isDeleted) return;
                                                        if (!row.current.refTable) {
                                                            setEditCell({ rowId: row.id, field: 'refTable' });
                                                        } else {
                                                            setEditCell({ rowId: row.id, field: 'refColumns' });
                                                        }
                                                    }}
                                                >
                                                    {row.current.refColumns.length > 0
                                                        ? row.current.refColumns.join(', ')
                                                        : <span className="italic text-muted-foreground/40">select cols</span>}
                                                </div>
                                            )}
                                        </TableCell>

                                        {/* On Delete */}
                                        <TableCell className="p-0 border-b border-border" style={{ width: '120px' }}>
                                            {isEditingOnDelete ? (
                                                <div
                                                    className="px-1 py-0.5"
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                >
                                                    <FKSelectCell
                                                        value={row.current.onDelete}
                                                        options={FK_RULE_OPTIONS}
                                                        disabled={saving}
                                                        onValueChange={(value) => updateRow(row.id, { onDelete: normalizeFKRule(value) })}
                                                        onClose={() => setEditCell(null)}
                                                    />
                                                </div>
                                            ) : (
                                                <div
                                                    className={`rt-cell-content rt-cell-content--compact font-mono text-[11px] text-muted-foreground
                                                        ${isDeleted ? 'opacity-40' : ''}
                                                        ${!readOnlyMode && !isDeleted ? 'cursor-pointer' : ''}
                                                    `}
                                                    onDoubleClick={() => !readOnlyMode && !isDeleted && setEditCell({ rowId: row.id, field: 'onDelete' })}
                                                >
                                                    {row.current.onDelete}
                                                </div>
                                            )}
                                        </TableCell>

                                        {/* On Update */}
                                        <TableCell className="p-0 border-b border-border" style={{ width: '120px' }}>
                                            {isEditingOnUpdate ? (
                                                <div
                                                    className="px-1 py-0.5"
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                >
                                                    <FKSelectCell
                                                        value={row.current.onUpdate}
                                                        options={FK_RULE_OPTIONS}
                                                        disabled={saving}
                                                        onValueChange={(value) => updateRow(row.id, { onUpdate: normalizeFKRule(value) })}
                                                        onClose={() => setEditCell(null)}
                                                    />
                                                </div>
                                            ) : (
                                                <div
                                                    className={`rt-cell-content rt-cell-content--compact font-mono text-[11px] text-muted-foreground
                                                        ${isDeleted ? 'opacity-40' : ''}
                                                        ${!readOnlyMode && !isDeleted ? 'cursor-pointer' : ''}
                                                    `}
                                                    onDoubleClick={() => !readOnlyMode && !isDeleted && setEditCell({ rowId: row.id, field: 'onUpdate' })}
                                                >
                                                    {row.current.onUpdate}
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}

                            {rows.length === 0 && !loading && (
                                <TableRow className="hover:bg-transparent">
                                    <TableCell colSpan={8} className="py-24 text-center text-muted-foreground italic bg-background/50 text-sm">
                                        {readOnlyMode
                                            ? 'No foreign keys defined for this table.'
                                            : 'No foreign keys yet. Click "Add FK" to create one.'}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
};
