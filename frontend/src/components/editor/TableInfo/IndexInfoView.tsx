import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Loader, RotateCcw, Save, Trash2, Hash, Plus,
} from 'lucide-react';
import { GetIndexes, DropIndex, CreateIndex } from '../../../services/schemaService';
import { useConnectionStore } from '../../../stores/connectionStore';
import { useEnvironmentStore } from '../../../stores/environmentStore';
import { useToast } from '../../layout/Toast';
import { ConfirmationModal } from '../../ui/ConfirmationModal';
import { Button, Input, Switch, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui';
import { ColumnPickerCell } from './ColumnPickerCell';
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
    uniqueOnly?: boolean;
}

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
    uniqueOnly = false,
}) => {
    const [rows, setRows] = useState<IndexRowState[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Per-cell editing — same pattern as columns tab's editCell
    const [editCell, setEditCell] = useState<{ rowId: string; field: 'name' | 'columns' } | null>(null);

    // Row selection — identical to columns tab
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [dragStartRowId, setDragStartRowId] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Drop modal (for drops outside batch — not used in batch, kept for safety)
    const [dropTarget, setDropTarget] = useState<string | null>(null);

    const { activeProfile } = useConnectionStore();
    const activeEnvironmentKey = useEnvironmentStore((state) => state.activeEnvironmentKey);
    const { toast } = useToast();
    const toastRef = useRef(toast);
    const { guardOperations, modals } = useWriteSafetyGuard(activeEnvironmentKey);
    const onActionsChangeRef = useRef<IndexInfoViewProps['onActionsChange']>(onActionsChange);
    const onDirtyCountChangeRef = useRef<IndexInfoViewProps['onDirtyCountChange']>(onDirtyCountChange);

    useEffect(() => {
        toastRef.current = toast;
    }, [toast]);

    useEffect(() => {
        onActionsChangeRef.current = onActionsChange;
    }, [onActionsChange]);

    useEffect(() => {
        onDirtyCountChangeRef.current = onDirtyCountChange;
    }, [onDirtyCountChange]);

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
            toastRef.current.error(`Failed to load indexes: ${getErrorMessage(error)}`);
        } finally {
            setLoading(false);
        }
    }, [activeProfile?.name, schema, tableName]);

    useEffect(() => { loadIndexes(); }, [loadIndexes, refreshKey]);

    // ── Dirty tracking ────────────────────────────────────────────────────────

    const dirtyCount = useMemo(() => getDirtyCount(rows), [rows]);
    useEffect(() => { onDirtyCountChangeRef.current?.(dirtyCount); }, [dirtyCount]);

    // ── Row mutations ─────────────────────────────────────────────────────────

    const filteredRows = useMemo(() => {
        let base = uniqueOnly ? rows.filter((r) => r.current.Unique) : rows;
        if (!filterText.trim()) return base;
        const lower = filterText.toLowerCase();
        return base.filter((r) =>
            r.current.Name.toLowerCase().includes(lower) ||
            r.current.Columns.some((c) => c.toLowerCase().includes(lower)),
        );
    }, [rows, filterText, uniqueOnly]);

    const filteredRowIds = useMemo(() => filteredRows.map((row) => row.id), [filteredRows]);

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
        const draft: IndexDef = { Name: '', Table: tableName, Columns: [], Unique: uniqueOnly };
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
            const currentIdx = filteredRowIds.indexOf(rowId);
            if (currentIdx === -1) return;
            const anchorId = dragStartRowId && filteredRowIds.includes(dragStartRowId)
                ? dragStartRowId
                : Array.from(selectedRows)[0];
            const anchorIdx = filteredRowIds.indexOf(anchorId);
            if (anchorIdx === -1) return;
            const min = Math.min(anchorIdx, currentIdx);
            const max = Math.max(anchorIdx, currentIdx);
            const next = new Set<string>();
            for (let i = min; i <= max; i++) next.add(filteredRowIds[i]);
            setSelectedRows(next);
        } else {
            setSelectedRows(new Set([rowId]));
        }
    }, [dragStartRowId, filteredRowIds, selectedRows]);

    const handleRowMouseEnter = useCallback((rowId: string) => {
        if (!isDragging || dragStartRowId === null) return;
        const startIdx = filteredRowIds.indexOf(dragStartRowId);
        const currentIdx = filteredRowIds.indexOf(rowId);
        if (startIdx === -1 || currentIdx === -1) return;
        const min = Math.min(startIdx, currentIdx);
        const max = Math.max(startIdx, currentIdx);
        const next = new Set<string>();
        for (let i = min; i <= max; i++) next.add(filteredRowIds[i]);
        setSelectedRows(next);
    }, [dragStartRowId, filteredRowIds, isDragging]);

    useEffect(() => {
        const h = () => { setIsDragging(false); setDragStartRowId(null); };
        window.addEventListener('mouseup', h);
        return () => window.removeEventListener('mouseup', h);
    }, []);

    // ── Batch delete — identical to columns tab ───────────────────────────────

    const toggleDeleteRows = useCallback(() => {
        if (readOnlyMode || !selectedRows.size) return;
        setRows((prev) =>
            prev
                .map((r) => {
                    if (!selectedRows.has(r.id)) return r;
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
            if (!r.current.Name.trim()) { toastRef.current.error('Index name is required'); return; }
            if (!r.current.Columns.length) { toastRef.current.error(`"${r.current.Name}" needs at least one column`); return; }
        }

        const ops: Array<'create' | 'drop'> = [
            ...toDelete.map(() => 'drop' as const),
            ...toCreate.map(() => 'create' as const),
            ...toUpdate.flatMap(() => ['drop', 'create'] as const),
        ];

        const guard = await guardOperations(ops, 'Apply Index Changes');
        if (!guard.allowed) {
            if (guard.blockedReason) toastRef.current.error(guard.blockedReason);
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
            toastRef.current.success('Index changes applied');
            await loadIndexes();
        } catch (error: unknown) {
            toastRef.current.error(`Failed to apply changes: ${getErrorMessage(error)}`);
        } finally {
            setSaving(false);
        }
    }, [activeProfile?.name, guardOperations, loadIndexes, readOnlyMode, rows, schema, tableName]);

    // Drop handler (for immediate drop via confirmation modal — not part of batch)
    const handleDropConfirm = useCallback(async () => {
        if (!dropTarget || !activeProfile?.name) return;
        const guard = await guardOperations(['drop'], 'Drop Index');
        if (!guard.allowed) {
            if (guard.blockedReason) toastRef.current.error(guard.blockedReason);
            return;
        }
        try {
            await DropIndex(activeProfile.name, schema, tableName, dropTarget);
            toastRef.current.success(`Index "${dropTarget}" dropped`);
            await loadIndexes();
        } catch (error: unknown) {
            toastRef.current.error(`Failed to drop index: ${getErrorMessage(error)}`);
        } finally {
            setDropTarget(null);
        }
    }, [activeProfile?.name, dropTarget, guardOperations, loadIndexes, schema]);

    // ── Toolbar actions ───────────────────────────────────────────────────────

    const hasChanges = dirtyCount > 0;

    const panelActions = useMemo<TabAction[]>(() => {
        if (readOnlyMode) return [];

        const actions: TabAction[] = [
            {
                id: 'index-new',
                icon: <Plus size={12} />,
                label: uniqueOnly ? 'Add Unique Key' : 'Add Index',
                title: uniqueOnly ? 'Add Unique Key' : 'Add Index',
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
        onActionsChangeRef.current?.(panelActions);
    }, [panelActions]);

    // ── Filter ────────────────────────────────────────────────────────────────

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
            {modals}

            <div className="flex-1 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-auto scrollbar-thin">
                    <Table
                        className="result-table-tanstack border-collapse table-fixed select-none"
                        style={{ width: '100%', minWidth: '560px' }}
                    >
                        <TableHeader className="[&_tr]:border-b-0">
                            <TableRow className="border-b-2 border-border hover:bg-transparent">
                                <TableHead className="rt-th w-10 font-mono text-label text-muted-foreground">
                                    <div className="rt-th-label justify-center">#</div>
                                </TableHead>
                                <TableHead className="rt-th">
                                    <div className="rt-th-label">Name</div>
                                </TableHead>
                                <TableHead className="rt-th" style={{ width: '320px' }}>
                                    <div className="rt-th-label">Columns</div>
                                </TableHead>
                                {!uniqueOnly && (
                                    <TableHead className="rt-th w-20">
                                        <div className="rt-th-label justify-center">Unique</div>
                                    </TableHead>
                                )}
                            </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-border/20 [&_tr:last-child]:border-b">
                            {filteredRows.map((row, displayIdx) => {
                                const isDeleted = row.deleted;
                                const isNew = row.isNew;
                                const isDirty = isDirtyRow(row);
                                const isSelected = selectedRows.has(row.id);
                                const isEditingName = editCell?.rowId === row.id && editCell.field === 'name';
                                const isEditingCols = editCell?.rowId === row.id && editCell.field === 'columns';

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
                                        {/* # — double-click to discard row (matches columns tab) */}
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
                                        <TableCell className="p-0 border-b border-border">
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
                                                        <span className="ml-1.5 text-label  text-success bg-success/10 px-1 py-0.5 rounded shrink-0">NEW</span>
                                                    )}
                                                    {isDirty && (
                                                        <span className="ml-1.5 text-label  text-warning bg-warning/10 px-1 py-0.5 rounded shrink-0">EDITED</span>
                                                    )}
                                                    {row.current.Unique && !uniqueOnly && (
                                                        <span className="ml-1.5 text-label  text-accent bg-accent/10 px-1 py-0.5 rounded-sm shrink-0">UNIQUE</span>
                                                    )}
                                                </div>
                                            )}
                                        </TableCell>

                                        {/* Columns */}
                                        <TableCell className="p-0 border-b border-border" style={{ width: '320px' }}>
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
                                                    className={`rt-cell-content rt-cell-content--compact font-mono text-label text-muted-foreground
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
                                        </TableCell>

                                        {/* Unique — always interactive, no double-click needed */}
                                        {!uniqueOnly && (
                                            <TableCell className="w-20 text-center border-b border-border">
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
                                            </TableCell>
                                        )}
                                    </TableRow>
                                );
                            })}

                            {rows.length === 0 && !loading && (
                                <TableRow className="hover:bg-transparent">
                                    <TableCell colSpan={uniqueOnly ? 3 : 4} className="py-24 text-center text-muted-foreground italic bg-background/50 text-body">
                                        {readOnlyMode
                                            ? (uniqueOnly ? 'No unique keys found for this table.' : 'No indexes found for this table.')
                                            : (uniqueOnly ? 'No unique keys yet. Click "Add Unique Key" to create one.' : 'No indexes yet. Click "Add Index" to create one.')}
                                    </TableCell>
                                </TableRow>
                            )}

                            {rows.length > 0 && filteredRows.length === 0 && filterText && (
                                <TableRow className="hover:bg-transparent">
                                    <TableCell colSpan={uniqueOnly ? 3 : 4} className="py-8 text-center text-muted-foreground text-small">
                                        {uniqueOnly ? `No unique keys match "${filterText}"` : `No indexes match "${filterText}"`}
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

