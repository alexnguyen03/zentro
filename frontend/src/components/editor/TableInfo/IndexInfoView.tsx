import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ChevronDown, ChevronUp, Loader, RotateCcw, Save, Trash2, Hash, Plus, Check,
} from 'lucide-react';
import { GetIndexes, DropIndex, CreateIndex } from '../../../services/schemaService';
import { useConnectionStore } from '../../../stores/connectionStore';
import { useEnvironmentStore } from '../../../stores/environmentStore';
import { useToast } from '../../layout/Toast';
import { ConfirmationModal } from '../../ui/ConfirmationModal';
import { Button, Input, Popover, PopoverContent, PopoverTrigger, Switch } from '../../ui';
import { getErrorMessage } from '../../../lib/errors';
import { useWriteSafetyGuard } from '../../../features/query/useWriteSafetyGuard';
import { type TabAction } from './types';

// ─── Domain types ─────────────────────────────────────────────────────────────

interface IndexDef {
    Name: string;
    Table: string;
    Columns: string[];
    Unique: boolean;
}

interface IndexRowState {
    id: string;
    original: IndexDef;
    current: IndexDef;
    deleted: boolean;
    isNew?: boolean;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface IndexInfoViewProps {
    schema: string;
    tableName: string;
    filterText: string;
    refreshKey: number;
    readOnlyMode?: boolean;
    isActive?: boolean;
    tableColumns?: string[];
    onActionsChange?: (actions: TabAction[]) => void;
    onDirtyCountChange?: (count: number) => void;
}

// ─── ColumnPicker ─────────────────────────────────────────────────────────────

interface ColumnPickerCellProps {
    columns: string[];
    selected: string[];
    onChange: (cols: string[]) => void;
    onClose: () => void; // called when picker closes → exits cell edit
    autoOpen?: boolean;
}

const ColumnPickerCell: React.FC<ColumnPickerCellProps> = ({
    columns, selected, onChange, onClose, autoOpen = false,
}) => {
    const [open, setOpen] = useState(autoOpen);
    const selectedRef = React.useRef(selected);
    selectedRef.current = selected;

    const toggle = (col: string) => {
        const current = selectedRef.current;
        onChange(current.includes(col) ? current.filter((c) => c !== col) : [...current, col]);
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
                    // prevent this click from bubbling to the tr mousedown (which would deselect row)
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isDirtyRow = (r: IndexRowState) =>
    !r.deleted && !r.isNew &&
    JSON.stringify(r.original) !== JSON.stringify(r.current);

const getDirtyCount = (rows: IndexRowState[]) =>
    rows.filter((r) => r.deleted || (r.isNew && r.current.Name.trim().length > 0) || isDirtyRow(r)).length;

const rowFromDef = (def: IndexDef, i: number): IndexRowState => ({
    id: `idx-${i}-${def.Name}`,
    original: { ...def, Columns: [...def.Columns] },
    current: { ...def, Columns: [...def.Columns] },
    deleted: false,
});

// ─── Main component ───────────────────────────────────────────────────────────

export const IndexInfoView: React.FC<IndexInfoViewProps> = ({
    schema,
    tableName,
    filterText,
    refreshKey,
    readOnlyMode = false,
    isActive = false,
    tableColumns = [],
    onActionsChange,
    onDirtyCountChange,
}) => {
    const [rows, setRows] = useState<IndexRowState[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Per-cell editing — same pattern as columns tab's editCell
    const [editCell, setEditCell] = useState<{ rowId: string; field: 'name' | 'columns' } | null>(null);

    // Row selection — identical to columns tab
    const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
    const [dragStartIdx, setDragStartIdx] = useState<number | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Drop modal (for drops outside batch — not used in batch, kept for safety)
    const [dropTarget, setDropTarget] = useState<string | null>(null);

    const { activeProfile } = useConnectionStore();
    const activeEnvironmentKey = useEnvironmentStore((state) => state.activeEnvironmentKey);
    const { toast } = useToast();
    const writeSafetyGuard = useWriteSafetyGuard(activeEnvironmentKey);

    // ── Load ───────────────────────────────────────────────────────────────────

    const loadIndexes = useCallback(async () => {
        if (!activeProfile?.name) return;
        setLoading(true);
        try {
            const data = await GetIndexes(activeProfile.name, schema, tableName);
            setRows((data || []).map((def, i) => rowFromDef(def as IndexDef, i)));
            setEditCell(null);
            setSelectedRows(new Set());
        } catch (error: unknown) {
            toast.error(`Failed to load indexes: ${getErrorMessage(error)}`);
        } finally {
            setLoading(false);
        }
    }, [activeProfile?.name, schema, tableName, toast]);

    useEffect(() => { loadIndexes(); }, [loadIndexes, refreshKey]);

    // ── Dirty tracking ────────────────────────────────────────────────────────

    const dirtyCount = useMemo(() => getDirtyCount(rows), [rows]);
    useEffect(() => { onDirtyCountChange?.(dirtyCount); }, [dirtyCount, onDirtyCountChange]);

    // ── Row mutations ─────────────────────────────────────────────────────────

    const updateRow = useCallback((id: string, patch: Partial<IndexDef>) => {
        setRows((prev) =>
            prev.map((r) => r.id === id ? { ...r, current: { ...r.current, ...patch } } : r),
        );
    }, []);

    const discardRow = useCallback((id: string) => {
        setRows((prev) =>
            prev.map((r) => r.id === id
                ? { ...r, current: { ...r.original, Columns: [...r.original.Columns] }, deleted: false }
                : r),
        );
        setEditCell(null);
    }, []);

    const discardAll = useCallback(() => {
        setRows((prev) =>
            prev
                .filter((r) => !r.isNew)
                .map((r) => ({ ...r, current: { ...r.original, Columns: [...r.original.Columns] }, deleted: false })),
        );
        setEditCell(null);
        setSelectedRows(new Set());
    }, []);

    const addNewRow = useCallback(() => {
        const draft: IndexDef = { Name: '', Table: tableName, Columns: [], Unique: false };
        const newRow: IndexRowState = {
            id: `idx-new-${Date.now()}`,
            original: { ...draft },
            current: { ...draft },
            deleted: false,
            isNew: true,
        };
        setRows((prev) => [...prev, newRow]);
        setEditCell({ rowId: newRow.id, field: 'name' });
        setSelectedRows(new Set());
    }, [tableName]);

    // ── Selection — identical to columns tab ──────────────────────────────────

    const handleRowMouseDown = useCallback((e: React.MouseEvent, idx: number) => {
        if (e.button !== 0) return;
        setIsDragging(true);
        setDragStartIdx(idx);
        if (e.ctrlKey || e.metaKey) {
            setSelectedRows((prev) => {
                const next = new Set(prev);
                if (next.has(idx)) next.delete(idx);
                else next.add(idx);
                return next;
            });
        } else if (e.shiftKey && selectedRows.size > 0) {
            const arr = Array.from(selectedRows);
            const start = Math.min(...arr);
            const min = Math.min(start, idx);
            const max = Math.max(start, idx);
            const next = new Set<number>();
            for (let i = min; i <= max; i++) next.add(i);
            setSelectedRows(next);
        } else {
            setSelectedRows(new Set([idx]));
        }
    }, [selectedRows]);

    const handleRowMouseEnter = useCallback((idx: number) => {
        if (!isDragging || dragStartIdx === null) return;
        const min = Math.min(dragStartIdx, idx);
        const max = Math.max(dragStartIdx, idx);
        const next = new Set<number>();
        for (let i = min; i <= max; i++) next.add(i);
        setSelectedRows(next);
    }, [isDragging, dragStartIdx]);

    useEffect(() => {
        const h = () => { setIsDragging(false); setDragStartIdx(null); };
        window.addEventListener('mouseup', h);
        return () => window.removeEventListener('mouseup', h);
    }, []);

    // ── Batch delete — identical to columns tab ───────────────────────────────

    const toggleDeleteRows = useCallback(() => {
        if (readOnlyMode || !selectedRows.size) return;
        setRows((prev) =>
            prev
                .map((r, i) => {
                    if (!selectedRows.has(i)) return r;
                    if (r.isNew) return null as never;
                    return { ...r, deleted: !r.deleted };
                })
                .filter(Boolean) as IndexRowState[],
        );
        setSelectedRows(new Set());
        setEditCell(null);
    }, [readOnlyMode, selectedRows]);

    // Delete key — gated on isActive (component is always mounted but may be hidden)
    useEffect(() => {
        if (!isActive) return;
        const h = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if (e.key === 'Delete' || (e.key === 'Backspace' && (e.ctrlKey || e.metaKey))) {
                toggleDeleteRows();
            }
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [isActive, toggleDeleteRows]);

    // ── Save all ──────────────────────────────────────────────────────────────

    const saveAll = useCallback(async () => {
        if (readOnlyMode || !activeProfile?.name) return;

        const toDelete = rows.filter((r) => r.deleted && !r.isNew);
        // Skip empty drafts (name and columns both empty) — treat as abandoned
        const toCreate = rows.filter((r) => r.isNew && !r.deleted && r.current.Name.trim().length > 0);
        const toUpdate = rows.filter((r) => !r.isNew && !r.deleted && isDirtyRow(r));

        if (!toDelete.length && !toCreate.length && !toUpdate.length) return;

        for (const r of [...toCreate, ...toUpdate]) {
            if (!r.current.Name.trim()) { toast.error('Index name is required'); return; }
            if (!r.current.Columns.length) { toast.error(`"${r.current.Name}" needs at least one column`); return; }
        }

        const ops: Array<'create' | 'drop'> = [
            ...toDelete.map(() => 'drop' as const),
            ...toCreate.map(() => 'create' as const),
            ...toUpdate.flatMap(() => ['drop', 'create'] as const),
        ];

        const guard = await writeSafetyGuard.guardOperations(ops, 'Apply Index Changes');
        if (!guard.allowed) {
            if (guard.blockedReason) toast.error(guard.blockedReason);
            return;
        }

        setSaving(true);
        try {
            for (const r of toDelete) {
                await DropIndex(activeProfile.name, schema, tableName, r.original.Name);
            }
            for (const r of toCreate) {
                await CreateIndex(activeProfile.name, schema, tableName, r.current.Name, r.current.Columns, r.current.Unique);
            }
            for (const r of toUpdate) {
                await DropIndex(activeProfile.name, schema, tableName, r.original.Name);
                await CreateIndex(activeProfile.name, schema, tableName, r.current.Name, r.current.Columns, r.current.Unique);
            }
            toast.success('Index changes applied');
            await loadIndexes();
        } catch (error: unknown) {
            toast.error(`Failed to apply changes: ${getErrorMessage(error)}`);
        } finally {
            setSaving(false);
        }
    }, [activeProfile?.name, loadIndexes, readOnlyMode, rows, schema, tableName, toast, writeSafetyGuard]);

    // Drop handler (for immediate drop via confirmation modal — not part of batch)
    const handleDropConfirm = useCallback(async () => {
        if (!dropTarget || !activeProfile?.name) return;
        const guard = await writeSafetyGuard.guardOperations(['drop'], 'Drop Index');
        if (!guard.allowed) {
            if (guard.blockedReason) toast.error(guard.blockedReason);
            return;
        }
        try {
            await DropIndex(activeProfile.name, schema, tableName, dropTarget);
            toast.success(`Index "${dropTarget}" dropped`);
            await loadIndexes();
        } catch (error: unknown) {
            toast.error(`Failed to drop index: ${getErrorMessage(error)}`);
        } finally {
            setDropTarget(null);
        }
    }, [activeProfile?.name, dropTarget, loadIndexes, schema, toast, writeSafetyGuard]);

    // ── Toolbar actions ───────────────────────────────────────────────────────

    const hasChanges = dirtyCount > 0;

    const panelActions = useMemo<TabAction[]>(() => {
        if (readOnlyMode) return [];

        const actions: TabAction[] = [
            {
                id: 'index-new',
                icon: <Plus size={12} />,
                label: 'Add Index',
                title: 'Add Index',
                onClick: addNewRow,
                disabled: saving,
            },
        ];

        if (selectedRows.size > 0) {
            actions.push({
                id: 'index-delete',
                icon: <Trash2 size={12} />,
                label: 'Delete',
                title: 'Delete selected',
                onClick: toggleDeleteRows,
                disabled: saving,
                danger: true,
            });
        }

        if (hasChanges) {
            actions.push({
                id: 'index-discard',
                icon: <RotateCcw size={12} />,
                label: 'Discard',
                title: 'Discard all changes',
                onClick: discardAll,
                disabled: saving,
                danger: true,
            });
            actions.push({
                id: 'index-save',
                icon: <Save size={12} />,
                label: 'Save Changes',
                title: 'Save Changes',
                onClick: () => { void saveAll(); },
                disabled: saving,
                loading: saving,
            });
        }

        return actions;
    }, [hasChanges, readOnlyMode, saving, selectedRows.size, saveAll, addNewRow, discardAll, toggleDeleteRows]);

    useEffect(() => {
        onActionsChange?.(panelActions);
    }, [onActionsChange, panelActions]);

    // ── Filter ────────────────────────────────────────────────────────────────

    const filteredRows = useMemo(() => {
        if (!filterText.trim()) return rows;
        const lower = filterText.toLowerCase();
        return rows.filter((r) =>
            r.current.Name.toLowerCase().includes(lower) ||
            r.current.Columns.some((c) => c.toLowerCase().includes(lower)),
        );
    }, [rows, filterText]);

    // ── Render ────────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader size={20} className="animate-spin text-accent" />
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-background">
            <ConfirmationModal
                isOpen={!!dropTarget}
                onClose={() => setDropTarget(null)}
                onConfirm={handleDropConfirm}
                title="Drop Index"
                message={`Drop index "${dropTarget}"?`}
                description="This will drop immediately and cannot be undone."
                confirmLabel="Drop"
                variant="destructive"
            />
            {writeSafetyGuard.modals}

            <div className="flex-1 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-auto scrollbar-thin px-3">
                    <table
                        className="result-table-tanstack border-collapse table-fixed select-none"
                        style={{ width: '100%', minWidth: '560px' }}
                    >
                        <thead>
                            <tr className="border-b-2 border-border">
                                <th className="rt-th w-10 font-mono text-[10px] text-muted-foreground">
                                    <div className="rt-th-label justify-center">#</div>
                                </th>
                                <th className="rt-th">
                                    <div className="rt-th-label">Name</div>
                                </th>
                                <th className="rt-th" style={{ width: '320px' }}>
                                    <div className="rt-th-label">Columns</div>
                                </th>
                                <th className="rt-th w-20">
                                    <div className="rt-th-label justify-center">Unique</div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20">
                            {filteredRows.map((row, displayIdx) => {
                                const isDeleted = row.deleted;
                                const isNew = row.isNew;
                                const isDirty = isDirtyRow(row);
                                const isSelected = selectedRows.has(displayIdx);
                                const isEditingName = editCell?.rowId === row.id && editCell.field === 'name';
                                const isEditingCols = editCell?.rowId === row.id && editCell.field === 'columns';

                                const rowCls = `
                                    group relative transition-all duration-150
                                    ${displayIdx % 2 !== 0 ? 'rt-row-alt' : ''}
                                    ${isSelected ? 'rt-row-selected' : ''}
                                    ${isDeleted ? 'rt-row-deleted' : ''}
                                `;

                                return (
                                    <tr
                                        key={row.id}
                                        className={rowCls}
                                        onMouseDown={(e) => handleRowMouseDown(e, displayIdx)}
                                        onMouseEnter={() => handleRowMouseEnter(displayIdx)}
                                    >
                                        {/* # — double-click to discard row (matches columns tab) */}
                                        <td className="w-10 text-center border-b border-border">
                                            <div
                                                className="rt-cell-content rt-cell-content--compact row-num-col"
                                                onDoubleClick={() => (isDirty || isDeleted) && !isNew && discardRow(row.id)}
                                                title={(isDirty || isDeleted) && !isNew ? 'Double-click to discard changes' : undefined}
                                            >
                                                {displayIdx + 1}
                                            </div>
                                        </td>

                                        {/* Name */}
                                        <td className="p-0 border-b border-border">
                                            {isEditingName ? (
                                                <Input
                                                    autoFocus
                                                    onFocus={(e) => e.target.select()}
                                                    className="rt-cell-input font-mono"
                                                    value={row.current.Name}
                                                    onChange={(e) => updateRow(row.id, { Name: e.target.value })}
                                                    onBlur={() => setEditCell(null)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                                        if (e.key === 'Escape') setEditCell(null);
                                                    }}
                                                />
                                            ) : (
                                                <div
                                                    className={`rt-cell-content rt-cell-content--compact font-medium
                                                        ${isDirty && row.current.Name !== row.original.Name ? 'rt-cell-dirty' : ''}
                                                        ${isDeleted ? 'opacity-40' : ''}
                                                        ${!readOnlyMode && !isDeleted ? 'cursor-pointer' : ''}
                                                    `}
                                                    title={row.current.Name || '(unnamed)'}
                                                    onDoubleClick={() => !readOnlyMode && !isDeleted && setEditCell({ rowId: row.id, field: 'name' })}
                                                >
                                                    <span className="truncate">{row.current.Name || <span className="italic text-muted-foreground/50">untitled</span>}</span>
                                                    {isNew && (
                                                        <span className="ml-1.5 text-[9px] font-bold text-success bg-success/10 px-1 py-0.5 rounded shrink-0">NEW</span>
                                                    )}
                                                    {isDirty && (
                                                        <span className="ml-1.5 text-[9px] font-bold text-warning bg-warning/10 px-1 py-0.5 rounded shrink-0">EDITED</span>
                                                    )}
                                                    {row.current.Unique && (
                                                        <span className="ml-1.5 text-[9px] font-bold text-accent bg-accent/10 px-1 py-0.5 rounded-md shrink-0">UNIQUE</span>
                                                    )}
                                                </div>
                                            )}
                                        </td>

                                        {/* Columns */}
                                        <td className="p-0 border-b border-border" style={{ width: '320px' }}>
                                            {isEditingCols ? (
                                                <div
                                                    className="px-1.5 py-[3px]"
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                >
                                                    <ColumnPickerCell
                                                        columns={tableColumns}
                                                        selected={row.current.Columns}
                                                        onChange={(cols) => updateRow(row.id, { Columns: cols })}
                                                        onClose={() => setEditCell(null)}
                                                        autoOpen
                                                    />
                                                </div>
                                            ) : (
                                                <div
                                                    className={`rt-cell-content rt-cell-content--compact font-mono text-[11px] text-muted-foreground
                                                        ${isDirty && JSON.stringify(row.current.Columns) !== JSON.stringify(row.original.Columns) ? 'rt-cell-dirty' : ''}
                                                        ${isDeleted ? 'opacity-40' : ''}
                                                        ${!readOnlyMode && !isDeleted ? 'cursor-pointer' : ''}
                                                    `}
                                                    title={row.current.Columns.join(', ')}
                                                    onDoubleClick={() => !readOnlyMode && !isDeleted && setEditCell({ rowId: row.id, field: 'columns' })}
                                                >
                                                    {row.current.Columns.length > 0
                                                        ? row.current.Columns.join(', ')
                                                        : <span className="italic text-muted-foreground/40">no columns</span>}
                                                </div>
                                            )}
                                        </td>

                                        {/* Unique — always interactive, no double-click needed */}
                                        <td className="w-20 text-center border-b border-border">
                                            <div
                                                className="rt-cell-content rt-cell-content--compact justify-center"
                                                onMouseDown={(e) => e.stopPropagation()}
                                            >
                                                <Switch
                                                    checked={row.current.Unique}
                                                    disabled={isDeleted || readOnlyMode}
                                                    onCheckedChange={(checked) => updateRow(row.id, { Unique: checked })}
                                                    className="scale-75 origin-center"
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}

                            {rows.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={4} className="py-24 text-center text-muted-foreground italic bg-background/50 text-sm">
                                        {readOnlyMode
                                            ? 'No indexes found for this table.'
                                            : 'No indexes yet. Click "Add Index" to create one.'}
                                    </td>
                                </tr>
                            )}

                            {rows.length > 0 && filteredRows.length === 0 && filterText && (
                                <tr>
                                    <td colSpan={4} className="py-8 text-center text-muted-foreground text-[12px]">
                                        No indexes match "{filterText}"
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
