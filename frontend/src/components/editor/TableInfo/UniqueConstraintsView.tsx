import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { GetUniqueConstraints, CreateUniqueConstraint, DropUniqueConstraint } from '../../../services/schemaService';
import { useConnectionStore } from '../../../stores/connectionStore';
import { useEnvironmentStore } from '../../../stores/environmentStore';
import { useToast } from '../../layout/Toast';
import { Button, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui';
import { getErrorMessage } from '../../../lib/errors';
import { useWriteSafetyGuard } from '../../../features/query/useWriteSafetyGuard';
import { ColumnPickerCell } from './ColumnPickerCell';
import { type TabAction } from './types';

interface UniqueDraft {
    name: string;
    columns: string[];
}

interface UniqueRowState {
    id: string;
    original: UniqueDraft;
    current: UniqueDraft;
    deleted: boolean;
    isNew?: boolean;
}

type EditField = 'name' | 'columns';

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

const cloneDraft = (draft: UniqueDraft): UniqueDraft => ({
    name: draft.name,
    columns: [...draft.columns],
});

const isDirty = (row: UniqueRowState) => JSON.stringify(row.original) !== JSON.stringify(row.current);

const isEmptyDraft = (draft: UniqueDraft) => !draft.name.trim() && draft.columns.length === 0;

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
    const [rows, setRows] = useState<UniqueRowState[]>([]);
    const [editCell, setEditCell] = useState<{ rowId: string; field: EditField } | null>(null);
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [dragStartRowId, setDragStartRowId] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const { activeProfile } = useConnectionStore();
    const activeEnvironmentKey = useEnvironmentStore((s) => s.activeEnvironmentKey);
    const { toast } = useToast();
    const writeSafetyGuard = useWriteSafetyGuard(activeEnvironmentKey);

    const load = useCallback(async () => {
        if (!activeProfile?.name) return;
        setLoading(true);
        try {
            const result = await GetUniqueConstraints(activeProfile.name, schema, tableName).catch(() => []);
            const nextRows = (result ?? []).map((unique, index) => {
                const draft: UniqueDraft = {
                    name: unique.Name || '',
                    columns: [...(unique.Columns || [])],
                };
                return {
                    id: `uq-${index}-${draft.name}`,
                    original: cloneDraft(draft),
                    current: cloneDraft(draft),
                    deleted: false,
                };
            });
            setRows(nextRows);
            setEditCell(null);
            setSelectedRows(new Set());
        } catch (error: unknown) {
            toast.error(`Failed to load unique constraints: ${getErrorMessage(error)}`);
        } finally {
            setLoading(false);
        }
    }, [activeProfile?.name, schema, tableName, toast]);

    useEffect(() => {
        void load();
    }, [load, refreshKey]);

    const dirtyCount = useMemo(
        () => rows.filter((row) => row.isNew || row.deleted || isDirty(row)).length,
        [rows],
    );

    useEffect(() => {
        onDirtyCountChange?.(dirtyCount);
    }, [dirtyCount, onDirtyCountChange]);

    const updateRow = useCallback((rowId: string, patch: Partial<UniqueDraft>) => {
        setRows((prev) => prev.map((row) => (
            row.id === rowId ? { ...row, current: { ...row.current, ...patch } } : row
        )));
    }, []);

    const discardRow = useCallback((rowId: string) => {
        setRows((prev) => prev
            .map((row) => {
                if (row.id !== rowId) return row;
                if (row.isNew) return null;
                return {
                    ...row,
                    current: cloneDraft(row.original),
                    deleted: false,
                };
            })
            .filter(Boolean) as UniqueRowState[]);
        setEditCell(null);
    }, []);

    const discard = useCallback(() => {
        setRows((prev) => prev
            .filter((row) => !row.isNew)
            .map((row) => ({
                ...row,
                current: cloneDraft(row.original),
                deleted: false,
            })));
        setSelectedRows(new Set());
        setEditCell(null);
    }, []);

    const validateDraft = useCallback((draft: UniqueDraft): string | null => {
        if (!draft.name.trim()) return 'Unique constraint name is required';
        if (!draft.columns.length) return `"${draft.name}" needs at least one column`;
        return null;
    }, []);

    const save = useCallback(async () => {
        if (readOnlyMode || !activeProfile?.name) return;

        const toDrop = rows.filter((row) => !row.isNew && row.deleted);
        const toCreate = rows.filter((row) => row.isNew && !row.deleted && !isEmptyDraft(row.current));
        const toUpdate = rows.filter((row) => !row.isNew && !row.deleted && isDirty(row));

        if (!toDrop.length && !toCreate.length && !toUpdate.length) return;

        for (const row of [...toCreate, ...toUpdate]) {
            const err = validateDraft(row.current);
            if (err) {
                toast.error(err);
                return;
            }
        }

        const ops: Array<'create' | 'drop'> = [
            ...toDrop.map(() => 'drop' as const),
            ...toCreate.map(() => 'create' as const),
            ...toUpdate.flatMap(() => ['drop', 'create'] as const),
        ];

        const summaryLines = [
            ...toDrop.map((row) => `- Drop: ${row.original.name}`),
            ...toCreate.map((row) => `- Create: ${row.current.name} (${row.current.columns.join(', ')})`),
            ...toUpdate.map((row) => `- Update: ${row.original.name} -> ${row.current.name}`),
        ];

        const guard = await writeSafetyGuard.guardOperations(ops, 'Apply Unique Constraint Changes', summaryLines);
        if (!guard.allowed) {
            if (guard.blockedReason) toast.error(guard.blockedReason);
            return;
        }

        setSaving(true);
        try {
            for (const row of toDrop) {
                await DropUniqueConstraint(activeProfile.name, schema, tableName, row.original.name);
            }
            for (const row of toCreate) {
                await CreateUniqueConstraint(activeProfile.name, schema, tableName, row.current.name, row.current.columns);
            }
            for (const row of toUpdate) {
                await DropUniqueConstraint(activeProfile.name, schema, tableName, row.original.name);
                await CreateUniqueConstraint(activeProfile.name, schema, tableName, row.current.name, row.current.columns);
            }
            toast.success('Unique constraint changes applied');
            await load();
        } catch (error: unknown) {
            toast.error(`Failed to apply unique constraint changes: ${getErrorMessage(error)}`);
        } finally {
            setSaving(false);
        }
    }, [activeProfile?.name, load, readOnlyMode, rows, schema, tableName, toast, validateDraft, writeSafetyGuard]);

    const rowIds = useMemo(() => rows.map((row) => row.id), [rows]);

    const handleRowMouseDown = useCallback((event: React.MouseEvent, rowId: string) => {
        if (event.button !== 0) return;
        setIsDragging(true);
        setDragStartRowId(rowId);

        if (event.ctrlKey || event.metaKey) {
            setSelectedRows((prev) => {
                const next = new Set(prev);
                if (next.has(rowId)) next.delete(rowId);
                else next.add(rowId);
                return next;
            });
            return;
        }

        if (event.shiftKey && selectedRows.size > 0) {
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
            for (let i = min; i <= max; i += 1) next.add(rowIds[i]);
            setSelectedRows(next);
            return;
        }

        setSelectedRows(new Set([rowId]));
    }, [dragStartRowId, rowIds, selectedRows]);

    const handleRowMouseEnter = useCallback((rowId: string) => {
        if (!isDragging || !dragStartRowId) return;
        const startIdx = rowIds.indexOf(dragStartRowId);
        const currentIdx = rowIds.indexOf(rowId);
        if (startIdx === -1 || currentIdx === -1) return;
        const min = Math.min(startIdx, currentIdx);
        const max = Math.max(startIdx, currentIdx);
        const next = new Set<string>();
        for (let i = min; i <= max; i += 1) next.add(rowIds[i]);
        setSelectedRows(next);
    }, [dragStartRowId, isDragging, rowIds]);

    useEffect(() => {
        const handleMouseUp = () => {
            setIsDragging(false);
            setDragStartRowId(null);
        };
        window.addEventListener('mouseup', handleMouseUp);
        return () => window.removeEventListener('mouseup', handleMouseUp);
    }, []);

    const toggleDeleteSelected = useCallback(() => {
        if (readOnlyMode || !selectedRows.size) return;
        setRows((prev) => prev
            .map((row) => {
                if (!selectedRows.has(row.id)) return row;
                if (row.isNew) return null;
                return { ...row, deleted: !row.deleted };
            })
            .filter(Boolean) as UniqueRowState[]);
        setSelectedRows(new Set());
        setEditCell(null);
    }, [readOnlyMode, selectedRows]);

    const hasChanges = dirtyCount > 0;

    const actions = useMemo<TabAction[]>(() => {
        if (readOnlyMode) return [];
        const result: TabAction[] = [];

        if (!saving) {
            result.push({
                id: 'uq-add',
                icon: <Plus size={12} />,
                label: 'Add Unique',
                title: 'Add unique constraint',
                onClick: () => {
                    const draft: UniqueDraft = { name: '', columns: [] };
                    const row: UniqueRowState = {
                        id: `uq-new-${Date.now()}`,
                        original: cloneDraft(draft),
                        current: cloneDraft(draft),
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
                id: 'uq-delete-selected',
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
                title: 'Save unique constraint changes',
                onClick: () => { void save(); },
                disabled: saving,
                loading: saving,
            });
        }

        return result;
    }, [discard, hasChanges, readOnlyMode, save, saving, selectedRows.size, toggleDeleteSelected]);

    useEffect(() => {
        onActionsChange?.(actions);
    }, [actions, onActionsChange]);

    useEffect(() => {
        if (!isActive) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
            if ((event.key === 's' || event.key === 'S') && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                void save();
            }
            if (event.key === 'Delete' || (event.key === 'Backspace' && (event.ctrlKey || event.metaKey))) {
                toggleDeleteSelected();
            }
            if (event.key === 'Escape') {
                setSelectedRows(new Set());
                setEditCell(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isActive, save, toggleDeleteSelected]);

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
                        style={{ width: '100%', minWidth: '560px' }}
                    >
                        <TableHeader className="[&_tr]:border-b-0">
                            <TableRow className="border-b-2 border-border hover:bg-transparent">
                                <TableHead className="rt-th w-10 font-mono text-[10px] text-muted-foreground">
                                    <div className="rt-th-label justify-center">#</div>
                                </TableHead>
                                <TableHead className="rt-th" style={{ width: '180px' }}>
                                    <div className="rt-th-label">Name</div>
                                </TableHead>
                                <TableHead className="rt-th" style={{ width: '280px' }}>
                                    <div className="rt-th-label">Columns</div>
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-border/20 [&_tr:last-child]:border-b">
                            {rows.map((row, displayIdx) => {
                                const rowIsDirty = isDirty(row);
                                const rowIsDeleted = row.deleted;
                                const rowIsNew = row.isNew;
                                const isSelected = selectedRows.has(row.id);

                                const isEditingName = editCell?.rowId === row.id && editCell.field === 'name';
                                const isEditingColumns = editCell?.rowId === row.id && editCell.field === 'columns';

                                const rowClassName = `
                                    group relative transition-all duration-150
                                    ${displayIdx % 2 !== 0 ? 'rt-row-alt' : ''}
                                    ${isSelected ? 'rt-row-selected' : ''}
                                    ${rowIsDeleted ? 'rt-row-deleted' : ''}
                                `;

                                return (
                                    <TableRow
                                        key={row.id}
                                        className={`${rowClassName} border-b-0 hover:bg-transparent`}
                                        onMouseDown={(event) => handleRowMouseDown(event, row.id)}
                                        onMouseEnter={() => handleRowMouseEnter(row.id)}
                                    >
                                        <TableCell className="w-10 text-center border-b border-border">
                                            <div
                                                className="rt-cell-content rt-cell-content--compact row-num-col"
                                                onDoubleClick={() => (rowIsDirty || rowIsDeleted) && !rowIsNew && discardRow(row.id)}
                                                title={(rowIsDirty || rowIsDeleted) && !rowIsNew ? 'Double-click to discard changes' : undefined}
                                            >
                                                {displayIdx + 1}
                                            </div>
                                        </TableCell>

                                        <TableCell className="p-0 border-b border-border" style={{ width: '180px' }}>
                                            {isEditingName ? (
                                                <Input
                                                    autoFocus
                                                    onFocus={(event) => event.target.select()}
                                                    placeholder="unique_constraint_name"
                                                    className="rt-cell-input font-mono"
                                                    value={row.current.name}
                                                    onChange={(event) => updateRow(row.id, { name: event.target.value })}
                                                    onBlur={() => setEditCell(null)}
                                                    onKeyDown={(event) => {
                                                        if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
                                                        if (event.key === 'Escape') setEditCell(null);
                                                    }}
                                                    disabled={saving || rowIsDeleted}
                                                />
                                            ) : (
                                                <div
                                                    className={`rt-cell-content rt-cell-content--compact font-medium
                                                        ${rowIsDeleted ? 'opacity-40' : ''}
                                                        ${!readOnlyMode && !rowIsDeleted ? 'cursor-pointer' : ''}
                                                    `}
                                                    title={row.current.name || '(unnamed)'}
                                                    onDoubleClick={() => !readOnlyMode && !rowIsDeleted && setEditCell({ rowId: row.id, field: 'name' })}
                                                >
                                                    <span className="truncate font-mono text-[11px]">
                                                        {row.current.name || <span className="italic text-muted-foreground/50">untitled</span>}
                                                    </span>
                                                    {rowIsNew && (
                                                        <span className="ml-1.5 text-[9px] font-bold text-success bg-success/10 px-1 py-0.5 rounded shrink-0">NEW</span>
                                                    )}
                                                    {!rowIsNew && rowIsDirty && !rowIsDeleted && (
                                                        <span className="ml-1.5 text-[9px] font-bold text-warning bg-warning/10 px-1 py-0.5 rounded shrink-0">EDITED</span>
                                                    )}
                                                    {rowIsDeleted && (
                                                        <span className="ml-1.5 text-[9px] font-bold text-error bg-error/10 px-1 py-0.5 rounded shrink-0">DROP</span>
                                                    )}
                                                </div>
                                            )}
                                        </TableCell>

                                        <TableCell className="p-0 border-b border-border" style={{ width: '280px' }}>
                                            {isEditingColumns ? (
                                                <div className="px-1.5 py-0.75" onMouseDown={(event) => event.stopPropagation()}>
                                                    <ColumnPickerCell
                                                        columns={tableColumns}
                                                        selected={row.current.columns}
                                                        onChange={(columns) => updateRow(row.id, { columns })}
                                                        onClose={() => setEditCell(null)}
                                                        autoOpen
                                                    />
                                                </div>
                                            ) : (
                                                <div
                                                    className={`rt-cell-content rt-cell-content--compact font-mono text-[11px] text-muted-foreground
                                                        ${rowIsDeleted ? 'opacity-40' : ''}
                                                        ${!readOnlyMode && !rowIsDeleted ? 'cursor-pointer' : ''}
                                                    `}
                                                    title={row.current.columns.join(', ')}
                                                    onDoubleClick={() => !readOnlyMode && !rowIsDeleted && setEditCell({ rowId: row.id, field: 'columns' })}
                                                >
                                                    {row.current.columns.length > 0
                                                        ? row.current.columns.join(', ')
                                                        : <span className="italic text-muted-foreground/40">select columns</span>}
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}

                            {rows.length === 0 && !loading && (
                                <TableRow className="hover:bg-transparent">
                                    <TableCell colSpan={3} className="py-24 text-center text-muted-foreground italic bg-background/50 text-sm">
                                        {readOnlyMode
                                            ? 'No unique constraints defined for this table.'
                                            : 'No unique constraints yet. Click "Add Unique" to create one.'}
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
