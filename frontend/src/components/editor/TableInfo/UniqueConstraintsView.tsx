import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { GetUniqueConstraints, CreateUniqueConstraint, DropUniqueConstraint } from '../../../services/schemaService';
import { useConnectionStore } from '../../../stores/connectionStore';
import { useEnvironmentStore } from '../../../stores/environmentStore';
import { useToast } from '../../layout/Toast';
import { ConfirmationModal } from '../../ui/ConfirmationModal';
import { Button, Input } from '../../ui';
import { getErrorMessage } from '../../../lib/errors';
import { useWriteSafetyGuard } from '../../../features/query/useWriteSafetyGuard';
import { ColumnPickerCell } from './ColumnPickerCell';
import { type TabAction } from './types';

// --- Types --------------------------------------------------------------------

interface UniqueRow {
    id: string;
    name: string;
    columns: string[];
    isNew?: boolean;
}

// --- Props --------------------------------------------------------------------

interface UniqueConstraintsViewProps {
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

export const UniqueConstraintsView: React.FC<UniqueConstraintsViewProps> = ({
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
    const [rows, setRows] = useState<UniqueRow[]>([]);
    const [editCell, setEditCell] = useState<{ id: string; field: 'name' | 'columns' } | null>(null);
    const [dropTarget, setDropTarget] = useState<{ name: string } | null>(null);

    const { activeProfile } = useConnectionStore();
    const activeEnvironmentKey = useEnvironmentStore((s) => s.activeEnvironmentKey);
    const { toast } = useToast();
    const writeSafetyGuard = useWriteSafetyGuard(activeEnvironmentKey);

    // -- Load ------------------------------------------------------------------

    const load = useCallback(async () => {
        if (!activeProfile?.name) return;
        setLoading(true);
        try {
            const result = await GetUniqueConstraints(activeProfile.name, schema, tableName).catch(() => []);
            setRows((result ?? []).map((u, i) => ({
                id: `uq-${i}-${u.Name}`,
                name: u.Name,
                columns: u.Columns ?? [],
            })));
            setEditCell(null);
        } catch (error: unknown) {
            toast.error(`Failed to load unique constraints: ${getErrorMessage(error)}`);
        } finally {
            setLoading(false);
        }
    }, [activeProfile?.name, schema, tableName, toast]);

    useEffect(() => { void load(); }, [load, refreshKey]);

    // -- Dirty -----------------------------------------------------------------

    const newRows = useMemo(() => rows.filter((r) => r.isNew), [rows]);
    const dirtyCount = newRows.length;
    useEffect(() => { onDirtyCountChange?.(dirtyCount); }, [dirtyCount, onDirtyCountChange]);

    // -- Discard ---------------------------------------------------------------

    const discard = useCallback(() => {
        setRows((prev) => prev.filter((r) => !r.isNew));
        setEditCell(null);
    }, []);

    // -- Save ------------------------------------------------------------------

    const save = useCallback(async () => {
        if (readOnlyMode || !activeProfile?.name) return;
        const toCreate = rows.filter((r) => r.isNew);
        if (!toCreate.length) return;

        for (const r of toCreate) {
            if (!r.name.trim()) { toast.error('Unique constraint name is required'); return; }
            if (!r.columns.length) { toast.error(`"${r.name}" needs at least one column`); return; }
        }

        const ops: Array<'create'> = toCreate.map(() => 'create');
        const summaryLines = toCreate.map((r) => `• Create: ${r.name} (${r.columns.join(', ')})`);

        const guard = await writeSafetyGuard.guardOperations(ops, 'Apply Unique Constraints', summaryLines);
        if (!guard.allowed) {
            if (guard.blockedReason) toast.error(guard.blockedReason);
            return;
        }

        setSaving(true);
        try {
            for (const r of toCreate) {
                await CreateUniqueConstraint(activeProfile.name, schema, tableName, r.name, r.columns);
            }
            toast.success('Unique constraints applied');
            await load();
        } catch (error: unknown) {
            toast.error(`Failed to apply unique constraints: ${getErrorMessage(error)}`);
        } finally {
            setSaving(false);
        }
    }, [activeProfile?.name, load, readOnlyMode, rows, schema, tableName, toast, writeSafetyGuard]);

    // -- Drop ------------------------------------------------------------------

    const handleDropConfirm = useCallback(async () => {
        if (!dropTarget || !activeProfile?.name) return;
        const guard = await writeSafetyGuard.guardOperations(
            ['drop'],
            'Drop Unique Constraint',
            [`• Drop: ${dropTarget.name}`],
        );
        if (!guard.allowed) {
            if (guard.blockedReason) toast.error(guard.blockedReason);
            setDropTarget(null);
            return;
        }
        try {
            await DropUniqueConstraint(activeProfile.name, schema, tableName, dropTarget.name);
            toast.success(`Unique constraint "${dropTarget.name}" dropped`);
            await load();
        } catch (error: unknown) {
            toast.error(`Failed to drop unique constraint: ${getErrorMessage(error)}`);
        } finally {
            setDropTarget(null);
        }
    }, [activeProfile?.name, dropTarget, load, schema, tableName, toast, writeSafetyGuard]);

    // -- Actions ---------------------------------------------------------------

    const hasChanges = dirtyCount > 0;

    const actions = useMemo<TabAction[]>(() => {
        if (readOnlyMode) return [];
        const result: TabAction[] = [];
        if (!saving) {
            result.push({
                id: 'uq-add',
                icon: <Plus size={12} />,
                label: 'Add Unique',
                title: 'Add Unique Constraint',
                onClick: () => {
                    const newRow: UniqueRow = { id: `uq-new-${Date.now()}`, name: '', columns: [], isNew: true };
                    setRows((prev) => [...prev, newRow]);
                    setEditCell({ id: newRow.id, field: 'name' });
                },
            });
        }
        if (hasChanges) {
            result.push({
                id: 'uq-discard',
                icon: <RotateCcw size={12} />,
                label: 'Discard',
                title: 'Discard pending changes',
                onClick: discard,
                disabled: saving,
                danger: true,
            });
            result.push({
                id: 'uq-save',
                icon: <Save size={12} />,
                label: 'Save',
                title: 'Save Unique Constraints',
                onClick: () => { void save(); },
                disabled: saving,
                loading: saving,
            });
        }
        return result;
    }, [readOnlyMode, saving, hasChanges, discard, save]);

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
            <div className="px-3 py-2 flex flex-col gap-1">
                {rows.length === 0 && (
                    <p className="text-[11px] text-muted-foreground italic py-2">No unique constraints defined.</p>
                )}
                {rows.map((row) => {
                    const isEditingName = editCell?.id === row.id && editCell.field === 'name';
                    const isEditingCols = editCell?.id === row.id && editCell.field === 'columns';
                    return (
                        <div key={row.id} className="flex items-center gap-3 py-1 group">
                            {/* Name */}
                            <div className="min-w-[160px] w-[160px]">
                                {isEditingName ? (
                                    <Input
                                        autoFocus
                                        placeholder="constraint_name"
                                        value={row.name}
                                        onChange={(e) => setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, name: e.target.value } : r))}
                                        onBlur={() => setEditCell(null)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                            if (e.key === 'Escape') setEditCell(null);
                                        }}
                                        className="rt-cell-input font-mono"
                                    />
                                ) : (
                                    <span
                                        className={`font-mono text-[12px] block truncate cursor-pointer hover:text-accent ${row.isNew ? 'text-success' : 'text-foreground font-medium'}`}
                                        title={row.name}
                                        onClick={() => row.isNew && !readOnlyMode && setEditCell({ id: row.id, field: 'name' })}
                                        onDoubleClick={() => row.isNew && !readOnlyMode && setEditCell({ id: row.id, field: 'name' })}
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
                                        onChange={(cols) => setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, columns: cols } : r))}
                                        onClose={() => setEditCell(null)}
                                        autoOpen
                                    />
                                ) : (
                                    <div
                                        className={`font-mono text-[11px] text-muted-foreground truncate ${row.isNew ? 'cursor-pointer hover:text-foreground px-2 py-1 rounded border border-border/40 hover:border-border' : ''}`}
                                        title={row.columns.join(', ')}
                                        onClick={() => row.isNew && !readOnlyMode && setEditCell({ id: row.id, field: 'columns' })}
                                        onDoubleClick={() => row.isNew && !readOnlyMode && setEditCell({ id: row.id, field: 'columns' })}
                                    >
                                        {row.columns.length > 0
                                            ? row.columns.join(', ')
                                            : row.isNew
                                                ? <span className="italic text-muted-foreground/50">click to select columns</span>
                                                : <span className="italic text-muted-foreground/40">no columns</span>}
                                    </div>
                                )}
                            </div>
                            {/* Delete */}
                            {!readOnlyMode && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => {
                                        if (row.isNew) {
                                            setRows((prev) => prev.filter((r) => r.id !== row.id));
                                            setEditCell(null);
                                        } else {
                                            setDropTarget({ name: row.name });
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

            <ConfirmationModal
                isOpen={!!dropTarget}
                onClose={() => setDropTarget(null)}
                onConfirm={() => { void handleDropConfirm(); }}
                title="Drop Unique Constraint"
                message={`Drop "${dropTarget?.name}"?`}
                description="This will execute immediately and cannot be undone."
                confirmLabel="Drop"
                variant="destructive"
            />
            {writeSafetyGuard.modals}
        </div>
    );
};
