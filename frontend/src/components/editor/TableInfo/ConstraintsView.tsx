import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyRound, Loader, Plus, RotateCcw, Save, ShieldCheck, Trash2 } from 'lucide-react';
import {
    AddPrimaryKey,
    CreateForeignKey,
    CreateCheckConstraint,
    CreateUniqueConstraint,
    DropForeignKey,
    DropCheckConstraint,
    DropPrimaryKey,
    DropUniqueConstraint,
    GetForeignKeys,
    GetCheckConstraints,
    GetPrimaryKey,
    GetUniqueConstraints,
    UpdateForeignKey,
} from '../../../services/schemaService';
import { useConnectionStore } from '../../../stores/connectionStore';
import { useEnvironmentStore } from '../../../stores/environmentStore';
import { useSchemaStore } from '../../../stores/schemaStore';
import { useToast } from '../../layout/Toast';
import { ConfirmationModal } from '../../ui/ConfirmationModal';
import { Button, Input, Popover, PopoverContent, PopoverTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui';
import { getErrorMessage } from '../../../lib/errors';
import { useWriteSafetyGuard } from '../../../features/query/useWriteSafetyGuard';
import { type TabAction } from './types';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import type { app } from '../../../../wailsjs/go/models';

// --- Domain types -------------------------------------------------------------

interface CheckRow {
    id: string;
    name: string;
    expression: string;
    isNew?: boolean;
}

interface UniqueRow {
    id: string;
    name: string;
    columns: string[];
    isNew?: boolean;
}

interface PKState {
    name: string;
    columns: string[];
}

type ForeignKeyRule = 'NO ACTION' | 'RESTRICT' | 'CASCADE' | 'SET NULL' | 'SET DEFAULT';

interface ForeignKeyDraft {
    name: string;
    columns: string[];
    refSchema: string;
    refTable: string;
    refColumns: string[];
    onDelete: ForeignKeyRule;
    onUpdate: ForeignKeyRule;
}

interface ForeignKeyRowState {
    id: string;
    original: ForeignKeyDraft;
    current: ForeignKeyDraft;
    deleted: boolean;
    isNew?: boolean;
}

type DropTarget =
    | { type: 'pk' | 'unique' | 'check'; name: string; mode: 'immediate' }
    | { type: 'fk'; rowId: string; name: string; mode: 'mark' };

const FK_RULE_OPTIONS: ForeignKeyRule[] = ['NO ACTION', 'RESTRICT', 'CASCADE', 'SET NULL', 'SET DEFAULT'];

// --- Props --------------------------------------------------------------------

interface ConstraintsViewProps {
    schema: string;
    tableName: string;
    refreshKey: number;
    readOnlyMode?: boolean;
    isActive?: boolean;
    tableColumns?: string[];
    onActionsChange?: (actions: TabAction[]) => void;
    onDirtyCountChange?: (count: number) => void;
    driver?: string;
}

// --- ColumnPickerCell (reused pattern from IndexInfoView) ---------------------

interface ColumnPickerCellProps {
    columns: string[];
    selected: string[];
    onChange: (cols: string[]) => void;
    onClose: () => void;
    autoOpen?: boolean;
}

const ColumnPickerCell: React.FC<ColumnPickerCellProps> = ({
    columns, selected, onChange, onClose, autoOpen = false,
}) => {
    const [open, setOpen] = useState(autoOpen);
    const selectedRef = useRef(selected);
    selectedRef.current = selected;

    const toggle = (col: string) => {
        const cur = selectedRef.current;
        onChange(cur.includes(col) ? cur.filter((c) => c !== col) : [...cur, col]);
    };

    const handleOpenChange = (next: boolean) => {
        setOpen(next);
        if (!next) setTimeout(onClose, 0);
    };

    const label = selected.length === 0 ? 'Select columns…' : selected.join(', ');

    return (
        <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    onMouseDown={(e) => e.stopPropagation()}
                    className={`
                        flex h-[26px] w-full items-center justify-between rounded border border-border/40
                        bg-background px-2 text-[12px] text-left font-mono transition-colors
                        hover:border-border focus:outline-none focus:ring-1 focus:ring-primary
                        ${open ? 'border-primary ring-1 ring-primary' : ''}
                    `}
                >
                    <span className={`truncate ${selected.length === 0 ? 'text-muted-foreground/50' : 'text-foreground'}`}>
                        {label}
                    </span>
                    {open
                        ? <ChevronUp size={11} className="shrink-0 text-muted-foreground ml-1" />
                        : <ChevronDown size={11} className="shrink-0 text-muted-foreground ml-1" />}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                side="bottom"
                sideOffset={4}
                className="z-panel-overlay w-[var(--radix-popover-trigger-width)] min-w-[200px] rounded-md border border-border bg-popover p-1 shadow-elevation-md"
            >
                <div className="max-h-[220px] overflow-y-auto">
                    {columns.length === 0 && (
                        <div className="px-3 py-2 text-[11px] text-muted-foreground">No columns available</div>
                    )}
                    {columns.map((col) => {
                        const checked = selected.includes(col);
                        return (
                            <Button
                                key={col}
                                type="button"
                                variant="ghost"
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={() => toggle(col)}
                                className={`
                                    flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-[12px] text-left h-auto justify-start
                                    transition-colors hover:bg-accent/10 font-mono
                                    ${checked ? 'text-foreground font-medium' : 'text-muted-foreground'}
                                `}
                            >
                                <div className={`
                                    flex h-3.5 w-3.5 items-center justify-center rounded-sm border transition-colors shrink-0
                                    ${checked ? 'bg-primary border-primary text-primary-foreground' : 'border-border/60 bg-background'}
                                `}>
                                    {checked && <Check size={10} strokeWidth={3} />}
                                </div>
                                <span className="truncate">{col}</span>
                            </Button>
                        );
                    })}
                </div>
            </PopoverContent>
        </Popover>
    );
};

// --- Section header -----------------------------------------------------------

const SectionHeader: React.FC<{
    icon: React.ReactNode;
    label: string;
    onAdd?: () => void;
    addLabel?: string;
    readOnly?: boolean;
    disabled?: boolean;
}> = ({ icon, label, onAdd, addLabel, readOnly, disabled }) => (
    <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            {icon}
            {label}
        </div>
        {!readOnly && onAdd && (
            <Button
                type="button"
                variant="ghost"
                onClick={onAdd}
                disabled={disabled}
                className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
            >
                <Plus size={10} />
                {addLabel}
            </Button>
        )}
    </div>
);

const normalizeForeignKeyRule = (value: string | undefined): ForeignKeyRule => {
    const normalized = (value || '').trim().toUpperCase().replace(/\s+/g, ' ');
    if (FK_RULE_OPTIONS.includes(normalized as ForeignKeyRule)) {
        return normalized as ForeignKeyRule;
    }
    return 'NO ACTION';
};

const cloneForeignKeyDraft = (draft: ForeignKeyDraft): ForeignKeyDraft => ({
    name: draft.name,
    columns: [...draft.columns],
    refSchema: draft.refSchema,
    refTable: draft.refTable,
    refColumns: [...draft.refColumns],
    onDelete: draft.onDelete,
    onUpdate: draft.onUpdate,
});

const mapFromForeignKeyInfo = (fk: app.ForeignKeyInfo): ForeignKeyDraft => ({
    name: fk.Name || '',
    columns: [...(fk.Columns || [])],
    refSchema: fk.RefSchema || '',
    refTable: fk.RefTable || '',
    refColumns: [...(fk.RefColumns || [])],
    onDelete: normalizeForeignKeyRule(fk.OnDelete),
    onUpdate: normalizeForeignKeyRule(fk.OnUpdate),
});

const toForeignKeyPayload = (fk: ForeignKeyDraft): app.ForeignKeyInfo => ({
    Name: fk.name.trim(),
    Columns: [...fk.columns],
    RefSchema: fk.refSchema.trim(),
    RefTable: fk.refTable.trim(),
    RefColumns: [...fk.refColumns],
    OnDelete: fk.onDelete,
    OnUpdate: fk.onUpdate,
});

const isForeignKeyDirty = (row: ForeignKeyRowState): boolean => {
    if (row.deleted) return true;
    return JSON.stringify(row.original) !== JSON.stringify(row.current);
};

const isEmptyForeignKeyDraft = (fk: ForeignKeyDraft): boolean => (
    !fk.name.trim()
    && fk.columns.length === 0
    && !fk.refSchema.trim()
    && !fk.refTable.trim()
    && fk.refColumns.length === 0
);

const toRefCacheKey = (fkSchema: string, fkTable: string) => `${fkSchema}.${fkTable}`;

// --- Main component -----------------------------------------------------------

export const ConstraintsView: React.FC<ConstraintsViewProps> = ({
    schema,
    tableName,
    refreshKey,
    readOnlyMode = false,
    isActive = false,
    tableColumns = [],
    onActionsChange,
    onDirtyCountChange,
    driver,
}) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // PK state
    const [pk, setPk] = useState<PKState | null>(null);
    const [pkDraft, setPkDraft] = useState<PKState | null>(null); // pending new PK to add
    const [pkEditingCols, setPkEditingCols] = useState(false);

    // Unique constraints
    const [uniqueRows, setUniqueRows] = useState<UniqueRow[]>([]);
    const [uniqueEditCell, setUniqueEditCell] = useState<{ id: string; field: 'name' | 'columns' } | null>(null);

    // Check constraints
    const [checkRows, setCheckRows] = useState<CheckRow[]>([]);
    const [checkEditCell, setCheckEditCell] = useState<{ id: string; field: 'name' | 'expression' } | null>(null);

    // Foreign keys
    const [foreignKeyRows, setForeignKeyRows] = useState<ForeignKeyRowState[]>([]);
    const [refColumnCache, setRefColumnCache] = useState<Record<string, string[]>>({});
    const refColumnCacheRef = useRef<Record<string, string[]>>({});

    // Drop confirmation
    const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

    const { activeProfile } = useConnectionStore();
    const activeEnvironmentKey = useEnvironmentStore((state) => state.activeEnvironmentKey);
    const treeMap = useSchemaStore((state) => state.trees);
    const checkAndFetchColumns = useSchemaStore((state) => state.checkAndFetchColumns);
    const { toast } = useToast();
    const writeSafetyGuard = useWriteSafetyGuard(activeEnvironmentKey);

    // SQLite doesn't support ALTER TABLE for PK/Unique constraints
    const supportsAlterConstraints = driver !== 'sqlite';
    const supportsForeignKeys = driver !== 'sqlite';

    const schemaNodes = useMemo(() => {
        if (!activeProfile?.name || !activeProfile?.db_name) return [];
        return treeMap[`${activeProfile.name}:${activeProfile.db_name}`] ?? [];
    }, [activeProfile?.db_name, activeProfile?.name, treeMap]);

    const schemaOptions = useMemo(
        () => schemaNodes.map((node) => node.Name).sort((a, b) => a.localeCompare(b)),
        [schemaNodes],
    );

    const tablesBySchema = useMemo(() => {
        const map = new Map<string, string[]>();
        schemaNodes.forEach((node) => {
            const allTables = [...(node.Tables || []), ...(node.ForeignTables || [])]
                .filter(Boolean)
                .sort((a, b) => a.localeCompare(b));
            map.set(node.Name, allTables);
        });
        return map;
    }, [schemaNodes]);

    const loadReferencedColumns = useCallback(async (refSchema: string, refTable: string) => {
        if (!activeProfile?.name || !activeProfile?.db_name || !refSchema || !refTable) return;
        const cacheKey = toRefCacheKey(refSchema, refTable);
        if (refColumnCacheRef.current[cacheKey]) return;

        try {
            const defs = await checkAndFetchColumns(activeProfile.name, activeProfile.db_name, refSchema, refTable);
            setRefColumnCache((prev) => {
                if (prev[cacheKey]) return prev;
                const next = { ...prev, [cacheKey]: defs.map((d) => d.Name) };
                refColumnCacheRef.current = next;
                return next;
            });
        } catch {
            setRefColumnCache((prev) => {
                if (prev[cacheKey]) return prev;
                const next = { ...prev, [cacheKey]: [] };
                refColumnCacheRef.current = next;
                return next;
            });
        }
    }, [activeProfile?.db_name, activeProfile?.name, checkAndFetchColumns]);

    // -- Load -------------------------------------------------------------------

    const loadAll = useCallback(async () => {
        if (!activeProfile?.name) return;
        setLoading(true);
        try {
            const [pkResult, uniqueResult, checkResult, fkResult] = await Promise.all([
                supportsAlterConstraints
                    ? GetPrimaryKey(activeProfile.name, schema, tableName).catch(() => null)
                    : Promise.resolve(null),
                supportsAlterConstraints
                    ? GetUniqueConstraints(activeProfile.name, schema, tableName).catch(() => [])
                    : Promise.resolve([]),
                GetCheckConstraints(activeProfile.name, schema, tableName).catch(() => []),
                supportsForeignKeys
                    ? GetForeignKeys(activeProfile.name, schema, tableName).catch(() => [])
                    : Promise.resolve([]),
            ]);

            setPk(pkResult ? { name: pkResult.Name, columns: pkResult.Columns ?? [] } : null);
            setPkDraft(null);
            setPkEditingCols(false);

            setUniqueRows((uniqueResult ?? []).map((u, i) => ({
                id: `uq-${i}-${u.Name}`,
                name: u.Name,
                columns: u.Columns ?? [],
            })));
            setUniqueEditCell(null);

            setCheckRows((checkResult ?? []).map((c, i) => ({
                id: `chk-${i}-${c.Name}`,
                name: c.Name,
                expression: c.Expression,
            })));
            setCheckEditCell(null);

            const fkRows = (fkResult ?? []).map((fk, i) => {
                const current = mapFromForeignKeyInfo(fk);
                return {
                    id: `fk-${i}-${current.name}`,
                    original: cloneForeignKeyDraft(current),
                    current,
                    deleted: false,
                };
            });
            setForeignKeyRows(fkRows);
            setRefColumnCache({});
            refColumnCacheRef.current = {};

            if (supportsForeignKeys) {
                const uniqueTargets = new Set<string>();
                fkRows.forEach((row) => {
                    if (row.current.refSchema && row.current.refTable) {
                        uniqueTargets.add(toRefCacheKey(row.current.refSchema, row.current.refTable));
                    }
                });
                await Promise.all(
                    [...uniqueTargets].map(async (key) => {
                        const [fkSchema, fkTable] = key.split('.');
                        await loadReferencedColumns(fkSchema, fkTable);
                    }),
                );
            }
        } catch (error: unknown) {
            toast.error(`Failed to load constraints: ${getErrorMessage(error)}`);
        } finally {
            setLoading(false);
        }
    }, [activeProfile?.name, loadReferencedColumns, schema, supportsAlterConstraints, supportsForeignKeys, tableName, toast]);

    useEffect(() => { void loadAll(); }, [loadAll, refreshKey]);

    useEffect(() => {
        if (!supportsForeignKeys) return;
        foreignKeyRows.forEach((row) => {
            if (row.deleted) return;
            if (!row.current.refSchema || !row.current.refTable) return;
            void loadReferencedColumns(row.current.refSchema, row.current.refTable);
        });
    }, [foreignKeyRows, loadReferencedColumns, supportsForeignKeys]);

    // -- Dirty tracking --------------------------------------------------------

    const dirtyCount = useMemo(() => {
        let n = 0;
        if (pkDraft) n++;
        n += uniqueRows.filter((r) => r.isNew).length;
        n += checkRows.filter((r) => r.isNew).length;
        n += foreignKeyRows.filter((row) => row.isNew || row.deleted || isForeignKeyDirty(row)).length;
        return n;
    }, [pkDraft, uniqueRows, checkRows, foreignKeyRows]);

    useEffect(() => { onDirtyCountChange?.(dirtyCount); }, [dirtyCount, onDirtyCountChange]);

    // -- Discard ---------------------------------------------------------------

    const discardAll = useCallback(() => {
        setPkDraft(null);
        setPkEditingCols(false);
        setUniqueRows((prev) => prev.filter((r) => !r.isNew));
        setUniqueEditCell(null);
        setCheckRows((prev) => prev.filter((r) => !r.isNew));
        setCheckEditCell(null);
        setForeignKeyRows((prev) => prev
            .filter((row) => !row.isNew)
            .map((row) => ({
                ...row,
                current: cloneForeignKeyDraft(row.original),
                deleted: false,
            })));
    }, []);

    // -- Save all --------------------------------------------------------------

    const updateForeignKeyRow = useCallback((rowId: string, patch: Partial<ForeignKeyDraft>) => {
        setForeignKeyRows((prev) => prev.map((row) => {
            if (row.id !== rowId) return row;
            const nextCurrent: ForeignKeyDraft = {
                ...row.current,
                ...patch,
            };
            if (patch.refSchema !== undefined || patch.refTable !== undefined) {
                nextCurrent.refColumns = [];
            }
            return { ...row, current: nextCurrent };
        }));
    }, []);

    const validateForeignKeyDraft = useCallback((fk: ForeignKeyDraft): string | null => {
        if (!fk.name.trim()) return 'Foreign key constraint name is required';
        if (fk.columns.length === 0) return `"${fk.name || 'Foreign key'}" needs at least one source column`;
        if (!fk.refSchema.trim()) return `"${fk.name || 'Foreign key'}" requires referenced schema`;
        if (!fk.refTable.trim()) return `"${fk.name || 'Foreign key'}" requires referenced table`;
        if (fk.refColumns.length === 0) return `"${fk.name || 'Foreign key'}" needs at least one referenced column`;
        if (fk.columns.length !== fk.refColumns.length) {
            return `"${fk.name || 'Foreign key'}" source/ref column counts must match`;
        }

        const cacheKey = toRefCacheKey(fk.refSchema, fk.refTable);
        const availableRefCols = refColumnCache[cacheKey];
        if (Array.isArray(availableRefCols) && availableRefCols.length > 0) {
            const invalidRefCol = fk.refColumns.find((col) => !availableRefCols.includes(col));
            if (invalidRefCol) {
                return `"${fk.name || 'Foreign key'}" referenced column "${invalidRefCol}" is no longer valid`;
            }
        }

        return null;
    }, [refColumnCache]);

    const saveAll = useCallback(async () => {
        if (readOnlyMode || !activeProfile?.name) return;

        const newUnique = uniqueRows.filter((r) => r.isNew);
        const newCheck = checkRows.filter((r) => r.isNew);
        const hasPkDraft = !!pkDraft;
        const fkToDrop = foreignKeyRows.filter((row) => !row.isNew && row.deleted);
        const fkToCreate = foreignKeyRows
            .filter((row) => row.isNew && !row.deleted)
            .filter((row) => !isEmptyForeignKeyDraft(row.current));
        const fkToUpdate = foreignKeyRows.filter((row) => !row.isNew && !row.deleted && isForeignKeyDirty(row));

        if (!hasPkDraft && !newUnique.length && !newCheck.length && !fkToDrop.length && !fkToCreate.length && !fkToUpdate.length) return;

        // Validate
        if (hasPkDraft) {
            if (!pkDraft!.name.trim()) { toast.error('Primary key constraint name is required'); return; }
            if (!pkDraft!.columns.length) { toast.error('Primary key needs at least one column'); return; }
        }
        for (const r of newUnique) {
            if (!r.name.trim()) { toast.error('Unique constraint name is required'); return; }
            if (!r.columns.length) { toast.error(`"${r.name}" needs at least one column`); return; }
        }
        for (const r of newCheck) {
            if (!r.name.trim()) { toast.error('Check constraint name is required'); return; }
            if (!r.expression.trim()) { toast.error(`"${r.name}" needs an expression`); return; }
        }
        for (const row of [...fkToCreate, ...fkToUpdate]) {
            const fkError = validateForeignKeyDraft(row.current);
            if (fkError) {
                toast.error(fkError);
                return;
            }
        }

        const ops: Array<'create' | 'drop'> = [
            ...(hasPkDraft ? ['create' as const] : []),
            ...newUnique.map(() => 'create' as const),
            ...newCheck.map(() => 'create' as const),
            ...fkToDrop.map(() => 'drop' as const),
            ...fkToCreate.map(() => 'create' as const),
            ...fkToUpdate.flatMap(() => ['drop', 'create'] as const),
        ];

        const guard = await writeSafetyGuard.guardOperations(ops, 'Apply Constraint Changes');
        if (!guard.allowed) {
            if (guard.blockedReason) toast.error(guard.blockedReason);
            return;
        }

        setSaving(true);
        try {
            if (hasPkDraft) {
                await AddPrimaryKey(activeProfile.name, schema, tableName, pkDraft!.name, pkDraft!.columns);
            }
            for (const r of newUnique) {
                await CreateUniqueConstraint(activeProfile.name, schema, tableName, r.name, r.columns);
            }
            for (const r of newCheck) {
                await CreateCheckConstraint(activeProfile.name, schema, tableName, r.name, r.expression);
            }
            for (const row of fkToDrop) {
                await DropForeignKey(activeProfile.name, schema, tableName, row.original.name);
            }
            for (const row of fkToCreate) {
                await CreateForeignKey(activeProfile.name, schema, tableName, toForeignKeyPayload(row.current));
            }
            for (const row of fkToUpdate) {
                await UpdateForeignKey(
                    activeProfile.name,
                    schema,
                    tableName,
                    row.original.name,
                    toForeignKeyPayload(row.current),
                );
            }
            toast.success('Constraint changes applied');
            await loadAll();
        } catch (error: unknown) {
            toast.error(`Failed to apply changes: ${getErrorMessage(error)}`);
        } finally {
            setSaving(false);
        }
    }, [
        activeProfile?.name,
        checkRows,
        foreignKeyRows,
        loadAll,
        pkDraft,
        readOnlyMode,
        schema,
        tableName,
        toast,
        uniqueRows,
        validateForeignKeyDraft,
        writeSafetyGuard,
    ]);

    // -- Drop confirmation -----------------------------------------------------

    const handleDropConfirm = useCallback(async () => {
        if (!dropTarget || !activeProfile?.name) return;

        if (dropTarget.type === 'fk' && dropTarget.mode === 'mark') {
            setForeignKeyRows((prev) => prev.map((row) => (
                row.id === dropTarget.rowId ? { ...row, deleted: true } : row
            )));
            setDropTarget(null);
            return;
        }

        const guard = await writeSafetyGuard.guardOperations(['drop'], 'Drop Constraint');
        if (!guard.allowed) {
            if (guard.blockedReason) toast.error(guard.blockedReason);
            return;
        }
        try {
            if (dropTarget.type === 'pk') {
                await DropPrimaryKey(activeProfile.name, schema, tableName, dropTarget.name);
                toast.success(`Primary key "${dropTarget.name}" dropped`);
            } else if (dropTarget.type === 'unique') {
                await DropUniqueConstraint(activeProfile.name, schema, tableName, dropTarget.name);
                toast.success(`Unique constraint "${dropTarget.name}" dropped`);
            } else {
                await DropCheckConstraint(activeProfile.name, schema, tableName, dropTarget.name);
                toast.success(`Check constraint "${dropTarget.name}" dropped`);
            }
            await loadAll();
        } catch (error: unknown) {
            toast.error(`Failed to drop constraint: ${getErrorMessage(error)}`);
        } finally {
            setDropTarget(null);
        }
    }, [activeProfile?.name, dropTarget, loadAll, schema, tableName, toast, writeSafetyGuard]);

    // -- Toolbar actions -------------------------------------------------------

    const hasChanges = dirtyCount > 0;

    const panelActions = useMemo<TabAction[]>(() => {
        if (readOnlyMode) return [];
        const actions: TabAction[] = [];
        if (hasChanges) {
            actions.push({
                id: 'constraints-discard',
                icon: <RotateCcw size={12} />,
                label: 'Discard',
                title: 'Discard all pending changes',
                onClick: discardAll,
                disabled: saving,
                danger: true,
            });
            actions.push({
                id: 'constraints-save',
                icon: <Save size={12} />,
                label: 'Save Changes',
                title: 'Save Changes',
                onClick: () => { void saveAll(); },
                disabled: saving,
                loading: saving,
            });
        }
        return actions;
    }, [hasChanges, readOnlyMode, saving, saveAll, discardAll]);

    useEffect(() => { onActionsChange?.(panelActions); }, [onActionsChange, panelActions]);

    // -- Keyboard shortcut -----------------------------------------------------

    useEffect(() => {
        if (!isActive) return;
        const h = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if ((e.key === 's' || e.key === 'S') && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                void saveAll();
            }
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [isActive, saveAll]);

    // -- Render ----------------------------------------------------------------

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader size={20} className="animate-spin text-accent" />
            </div>
        );
    }

    const dropLabel = dropTarget?.type === 'pk' ? 'Primary Key'
        : dropTarget?.type === 'unique' ? 'Unique Constraint'
        : dropTarget?.type === 'check' ? 'Check Constraint'
        : 'Foreign Key';

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-background overflow-auto scrollbar-thin">
            <ConfirmationModal
                isOpen={!!dropTarget}
                onClose={() => setDropTarget(null)}
                onConfirm={handleDropConfirm}
                title={dropTarget?.type === 'fk' ? 'Mark Foreign Key For Drop' : `Drop ${dropLabel}`}
                message={dropTarget?.type === 'fk'
                    ? `Mark "${dropTarget?.name}" to drop on Save Changes?`
                    : `Drop "${dropTarget?.name}"?`}
                description={dropTarget?.type === 'fk'
                    ? 'This change will be executed when you click Save Changes.'
                    : 'This will execute immediately and cannot be undone.'}
                confirmLabel={dropTarget?.type === 'fk' ? 'Mark Drop' : 'Drop'}
                variant="destructive"
            />
            {writeSafetyGuard.modals}

            {/* -- PRIMARY KEY -- */}
            <div className="border-b border-border">
                <SectionHeader
                    icon={<KeyRound size={11} />}
                    label="Primary Key"
                    addLabel="Add PK"
                    readOnly={readOnlyMode || !supportsAlterConstraints}
                    disabled={saving || !!pk || !!pkDraft}
                    onAdd={() => setPkDraft({ name: '', columns: [] })}
                />
                <div className="px-3 py-2">
                    {!pk && !pkDraft && (
                        <p className="text-[11px] text-muted-foreground italic py-2">
                            {supportsAlterConstraints ? 'No primary key defined.' : 'SQLite: primary key management not supported via ALTER TABLE.'}
                        </p>
                    )}

                    {pk && (
                        <div className="flex items-center gap-3 py-1.5 group">
                            <span className="font-mono text-[12px] text-foreground font-medium min-w-[160px] truncate" title={pk.name}>{pk.name}</span>
                            <span className="font-mono text-[11px] text-muted-foreground flex-1 truncate">{pk.columns.join(', ')}</span>
                            {!readOnlyMode && supportsAlterConstraints && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setDropTarget({ type: 'pk', name: pk.name, mode: 'immediate' })}
                                    disabled={saving}
                                    className="h-6 px-2 text-[11px] text-error/70 hover:text-error opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 size={11} />
                                </Button>
                            )}
                        </div>
                    )}

                    {pkDraft && (
                        <div className="flex items-center gap-2 py-1.5">
                            <Input
                                autoFocus
                                placeholder="constraint_name"
                                value={pkDraft.name}
                                onChange={(e) => setPkDraft((d) => d ? { ...d, name: e.target.value } : d)}
                                className="rt-cell-input font-mono h-7 text-[12px] min-w-[160px] w-[160px]"
                            />
                            <div className="flex-1" onMouseDown={(e) => e.stopPropagation()}>
                                {pkEditingCols ? (
                                    <ColumnPickerCell
                                        columns={tableColumns}
                                        selected={pkDraft.columns}
                                        onChange={(cols) => setPkDraft((d) => d ? { ...d, columns: cols } : d)}
                                        onClose={() => setPkEditingCols(false)}
                                        autoOpen
                                    />
                                ) : (
                                    <div
                                        className="font-mono text-[11px] text-muted-foreground cursor-pointer hover:text-foreground px-2 py-1 rounded border border-border/40 hover:border-border"
                                        onDoubleClick={() => setPkEditingCols(true)}
                                        onClick={() => setPkEditingCols(true)}
                                    >
                                        {pkDraft.columns.length > 0
                                            ? pkDraft.columns.join(', ')
                                            : <span className="italic text-muted-foreground/50">click to select columns</span>}
                                    </div>
                                )}
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => { setPkDraft(null); setPkEditingCols(false); }}
                                className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                            >
                                Cancel
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* -- UNIQUE CONSTRAINTS -- */}
            {supportsAlterConstraints && (
                <div className="border-b border-border">
                    <SectionHeader
                        icon={<ShieldCheck size={11} />}
                        label="Unique Constraints"
                        addLabel="Add Unique"
                        readOnly={readOnlyMode}
                        disabled={saving}
                        onAdd={() => {
                            const newRow: UniqueRow = { id: `uq-new-${Date.now()}`, name: '', columns: [], isNew: true };
                            setUniqueRows((prev) => [...prev, newRow]);
                            setUniqueEditCell({ id: newRow.id, field: 'name' });
                        }}
                    />
                    <div className="px-3 py-2 flex flex-col gap-1">
                        {uniqueRows.length === 0 && (
                            <p className="text-[11px] text-muted-foreground italic py-2">No unique constraints defined.</p>
                        )}
                        {uniqueRows.map((row) => {
                            const isEditingName = uniqueEditCell?.id === row.id && uniqueEditCell.field === 'name';
                            const isEditingCols = uniqueEditCell?.id === row.id && uniqueEditCell.field === 'columns';
                            return (
                                <div key={row.id} className="flex items-center gap-3 py-1 group">
                                    {/* Name */}
                                    <div className="min-w-[160px] w-[160px]">
                                        {isEditingName ? (
                                            <Input
                                                autoFocus
                                                placeholder="constraint_name"
                                                value={row.name}
                                                onChange={(e) => setUniqueRows((prev) => prev.map((r) => r.id === row.id ? { ...r, name: e.target.value } : r))}
                                                onBlur={() => setUniqueEditCell(null)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                                    if (e.key === 'Escape') setUniqueEditCell(null);
                                                }}
                                                className="rt-cell-input font-mono h-7 text-[12px]"
                                            />
                                        ) : (
                                            <span
                                                className={`font-mono text-[12px] block truncate cursor-pointer hover:text-accent ${row.isNew ? 'text-success' : 'text-foreground font-medium'}`}
                                                title={row.name}
                                                onDoubleClick={() => row.isNew && setUniqueEditCell({ id: row.id, field: 'name' })}
                                                onClick={() => row.isNew && setUniqueEditCell({ id: row.id, field: 'name' })}
                                            >
                                                {row.name || <span className="italic text-muted-foreground/50">untitled</span>}
                                                {row.isNew && <span className="ml-1.5 text-[9px] font-bold text-success bg-success/10 px-1 py-0.5 rounded">NEW</span>}
                                            </span>
                                        )}
                                    </div>
                                    {/* Columns */}
                                    <div className="flex-1" onMouseDown={(e) => e.stopPropagation()}>
                                        {isEditingCols ? (
                                            <ColumnPickerCell
                                                columns={tableColumns}
                                                selected={row.columns}
                                                onChange={(cols) => setUniqueRows((prev) => prev.map((r) => r.id === row.id ? { ...r, columns: cols } : r))}
                                                onClose={() => setUniqueEditCell(null)}
                                                autoOpen
                                            />
                                        ) : (
                                            <div
                                                className={`font-mono text-[11px] text-muted-foreground truncate ${row.isNew ? 'cursor-pointer hover:text-foreground px-2 py-1 rounded border border-border/40 hover:border-border' : ''}`}
                                                title={row.columns.join(', ')}
                                                onDoubleClick={() => row.isNew && setUniqueEditCell({ id: row.id, field: 'columns' })}
                                                onClick={() => row.isNew && setUniqueEditCell({ id: row.id, field: 'columns' })}
                                            >
                                                {row.columns.length > 0
                                                    ? row.columns.join(', ')
                                                    : row.isNew
                                                        ? <span className="italic text-muted-foreground/50">click to select columns</span>
                                                        : <span className="italic text-muted-foreground/40">no columns</span>}
                                            </div>
                                        )}
                                    </div>
                                    {/* Actions */}
                                    {!readOnlyMode && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={() => {
                                                if (row.isNew) {
                                                    setUniqueRows((prev) => prev.filter((r) => r.id !== row.id));
                                                    setUniqueEditCell(null);
                                                } else {
                                                    setDropTarget({ type: 'unique', name: row.name, mode: 'immediate' });
                                                }
                                            }}
                                            disabled={saving}
                                            className="h-6 px-2 text-[11px] text-error/70 hover:text-error opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 size={11} />
                                        </Button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* -- CHECK CONSTRAINTS -- */}
            <div>
                <SectionHeader
                    icon={<ShieldCheck size={11} />}
                    label="Check Constraints"
                    addLabel="Add Check"
                    readOnly={readOnlyMode}
                    disabled={saving}
                    onAdd={() => {
                        const newRow: CheckRow = { id: `chk-new-${Date.now()}`, name: '', expression: '', isNew: true };
                        setCheckRows((prev) => [...prev, newRow]);
                        setCheckEditCell({ id: newRow.id, field: 'name' });
                    }}
                />
                <div className="px-3 py-2 flex flex-col gap-1">
                    {checkRows.length === 0 && (
                        <p className="text-[11px] text-muted-foreground italic py-2">No check constraints defined.</p>
                    )}
                    {checkRows.map((row) => {
                        const isEditingName = checkEditCell?.id === row.id && checkEditCell.field === 'name';
                        const isEditingExpr = checkEditCell?.id === row.id && checkEditCell.field === 'expression';
                        return (
                            <div key={row.id} className="flex items-center gap-3 py-1 group">
                                {/* Name */}
                                <div className="min-w-[160px] w-[160px]">
                                    {isEditingName ? (
                                        <Input
                                            autoFocus
                                            placeholder="constraint_name"
                                            value={row.name}
                                            onChange={(e) => setCheckRows((prev) => prev.map((r) => r.id === row.id ? { ...r, name: e.target.value } : r))}
                                            onBlur={() => setCheckEditCell(null)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                                if (e.key === 'Escape') setCheckEditCell(null);
                                            }}
                                            className="rt-cell-input font-mono h-7 text-[12px]"
                                        />
                                    ) : (
                                        <span
                                            className={`font-mono text-[12px] block truncate cursor-pointer hover:text-accent ${row.isNew ? 'text-success' : 'text-foreground font-medium'}`}
                                            title={row.name}
                                            onDoubleClick={() => row.isNew && setCheckEditCell({ id: row.id, field: 'name' })}
                                            onClick={() => row.isNew && setCheckEditCell({ id: row.id, field: 'name' })}
                                        >
                                            {row.name || <span className="italic text-muted-foreground/50">untitled</span>}
                                            {row.isNew && <span className="ml-1.5 text-[9px] font-bold text-success bg-success/10 px-1 py-0.5 rounded">NEW</span>}
                                        </span>
                                    )}
                                </div>
                                {/* Expression */}
                                <div className="flex-1">
                                    {isEditingExpr ? (
                                        <Input
                                            autoFocus
                                            placeholder="age > 0"
                                            value={row.expression}
                                            onChange={(e) => setCheckRows((prev) => prev.map((r) => r.id === row.id ? { ...r, expression: e.target.value } : r))}
                                            onBlur={() => setCheckEditCell(null)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                                if (e.key === 'Escape') setCheckEditCell(null);
                                            }}
                                            className="rt-cell-input font-mono h-7 text-[12px]"
                                        />
                                    ) : (
                                        <div
                                            className={`font-mono text-[11px] text-muted-foreground truncate ${row.isNew ? 'cursor-pointer hover:text-foreground px-2 py-1 rounded border border-border/40 hover:border-border' : ''}`}
                                            title={row.expression}
                                            onDoubleClick={() => row.isNew && setCheckEditCell({ id: row.id, field: 'expression' })}
                                            onClick={() => row.isNew && setCheckEditCell({ id: row.id, field: 'expression' })}
                                        >
                                            {row.expression || (row.isNew
                                                ? <span className="italic text-muted-foreground/50">click to enter expression</span>
                                                : <span className="italic text-muted-foreground/40">—</span>)}
                                        </div>
                                    )}
                                </div>
                                {/* Actions */}
                                {!readOnlyMode && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => {
                                            if (row.isNew) {
                                                setCheckRows((prev) => prev.filter((r) => r.id !== row.id));
                                                setCheckEditCell(null);
                                            } else {
                                                setDropTarget({ type: 'check', name: row.name, mode: 'immediate' });
                                            }
                                        }}
                                        disabled={saving}
                                        className="h-6 px-2 text-[11px] text-error/70 hover:text-error opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 size={11} />
                                    </Button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {supportsForeignKeys && (
                <div className="border-t border-border">
                    <SectionHeader
                        icon={<KeyRound size={11} />}
                        label="Foreign Keys"
                        addLabel="Add FK"
                        readOnly={readOnlyMode}
                        disabled={saving}
                        onAdd={() => {
                            const draft: ForeignKeyDraft = {
                                name: '',
                                columns: [],
                                refSchema: schema,
                                refTable: '',
                                refColumns: [],
                                onDelete: 'NO ACTION',
                                onUpdate: 'NO ACTION',
                            };
                            const row: ForeignKeyRowState = {
                                id: `fk-new-${Date.now()}`,
                                original: cloneForeignKeyDraft(draft),
                                current: draft,
                                deleted: false,
                                isNew: true,
                            };
                            setForeignKeyRows((prev) => [...prev, row]);
                        }}
                    />
                    <div className="px-3 py-2 flex flex-col gap-2">
                        {foreignKeyRows.length === 0 && (
                            <p className="text-[11px] text-muted-foreground italic py-2">No foreign keys defined.</p>
                        )}
                        {foreignKeyRows.map((row) => {
                            const refTableOptions = tablesBySchema.get(row.current.refSchema) ?? [];
                            const refColumnOptions = row.current.refSchema && row.current.refTable
                                ? (refColumnCache[toRefCacheKey(row.current.refSchema, row.current.refTable)] ?? [])
                                : [];
                            const rowDirty = isForeignKeyDirty(row);

                            return (
                                <div
                                    key={row.id}
                                    className={`rounded border px-2.5 py-2 ${row.deleted ? 'border-error/50 bg-error/5 opacity-70' : 'border-border/60 bg-background/60'} `}
                                >
                                    <div className="flex items-center gap-2 mb-2">
                                        <Input
                                            placeholder="fk_constraint_name"
                                            value={row.current.name}
                                            onChange={(e) => updateForeignKeyRow(row.id, { name: e.target.value })}
                                            disabled={readOnlyMode || saving || row.deleted}
                                            className="rt-cell-input font-mono h-7 text-[12px] min-w-[180px] w-[220px]"
                                        />
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
                                                        setForeignKeyRows((prev) => prev.filter((r) => r.id !== row.id));
                                                        return;
                                                    }
                                                    if (row.deleted) {
                                                        setForeignKeyRows((prev) => prev.map((r) => (
                                                            r.id === row.id ? { ...r, deleted: false } : r
                                                        )));
                                                        return;
                                                    }
                                                    setDropTarget({ type: 'fk', rowId: row.id, name: row.current.name || row.original.name, mode: 'mark' });
                                                }}
                                                disabled={saving}
                                                className="ml-auto h-6 px-2 text-[11px] text-error/70 hover:text-error"
                                            >
                                                <Trash2 size={11} />
                                            </Button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                                        <div className="space-y-1">
                                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Source Columns</p>
                                            <ColumnPickerCell
                                                columns={tableColumns}
                                                selected={row.current.columns}
                                                onChange={(cols) => updateForeignKeyRow(row.id, { columns: cols })}
                                                onClose={() => {}}
                                                autoOpen={false}
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Referenced Schema</p>
                                            <Select
                                                value={row.current.refSchema || undefined}
                                                onValueChange={(value) => updateForeignKeyRow(row.id, { refSchema: value, refTable: '' })}
                                                disabled={readOnlyMode || saving || row.deleted}
                                            >
                                                <SelectTrigger className="h-7 font-mono text-[12px]">
                                                    <SelectValue placeholder="Select schema" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {schemaOptions.map((schemaName) => (
                                                        <SelectItem key={schemaName} value={schemaName}>{schemaName}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-1">
                                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Referenced Table</p>
                                            <Select
                                                value={row.current.refTable || undefined}
                                                onValueChange={(value) => {
                                                    updateForeignKeyRow(row.id, { refTable: value });
                                                    void loadReferencedColumns(row.current.refSchema, value);
                                                }}
                                                disabled={readOnlyMode || saving || row.deleted || !row.current.refSchema}
                                            >
                                                <SelectTrigger className="h-7 font-mono text-[12px]">
                                                    <SelectValue placeholder="Select table" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {refTableOptions.map((tableOption) => (
                                                        <SelectItem key={tableOption} value={tableOption}>{tableOption}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-1">
                                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Referenced Columns</p>
                                            <ColumnPickerCell
                                                columns={refColumnOptions}
                                                selected={row.current.refColumns}
                                                onChange={(cols) => updateForeignKeyRow(row.id, { refColumns: cols })}
                                                onClose={() => {}}
                                                autoOpen={false}
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">ON DELETE</p>
                                            <Select
                                                value={row.current.onDelete}
                                                onValueChange={(value) => updateForeignKeyRow(row.id, { onDelete: normalizeForeignKeyRule(value) })}
                                                disabled={readOnlyMode || saving || row.deleted}
                                            >
                                                <SelectTrigger className="h-7 font-mono text-[12px]">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {FK_RULE_OPTIONS.map((rule) => (
                                                        <SelectItem key={`delete-${rule}`} value={rule}>{rule}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-1">
                                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">ON UPDATE</p>
                                            <Select
                                                value={row.current.onUpdate}
                                                onValueChange={(value) => updateForeignKeyRow(row.id, { onUpdate: normalizeForeignKeyRule(value) })}
                                                disabled={readOnlyMode || saving || row.deleted}
                                            >
                                                <SelectTrigger className="h-7 font-mono text-[12px]">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {FK_RULE_OPTIONS.map((rule) => (
                                                        <SelectItem key={`update-${rule}`} value={rule}>{rule}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

