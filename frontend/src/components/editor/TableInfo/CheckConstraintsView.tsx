import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { GetCheckConstraints, CreateCheckConstraint, DropCheckConstraint } from '../../../services/schemaService';
import { useConnectionStore } from '../../../stores/connectionStore';
import { useEnvironmentStore } from '../../../stores/environmentStore';
import { useToast } from '../../layout/Toast';
import { Button, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui';
import { getErrorMessage } from '../../../lib/errors';
import { useWriteSafetyGuard } from '../../../features/query/useWriteSafetyGuard';
import { type TabAction } from './types';

interface CheckDraft {
    name: string;
    expression: string;
}

interface CheckRowState {
    id: string;
    original: CheckDraft;
    current: CheckDraft;
    deleted: boolean;
    isNew?: boolean;
}

type EditField = 'name' | 'expression';

interface CheckConstraintsViewProps {
    schema: string;
    tableName: string;
    refreshKey: number;
    readOnlyMode?: boolean;
    isActive?: boolean;
    onActionsChange?: (actions: TabAction[]) => void;
    onDirtyCountChange?: (count: number) => void;
}

const cloneDraft = (draft: CheckDraft): CheckDraft => ({
    name: draft.name,
    expression: draft.expression,
});

const isDirty = (row: CheckRowState) => JSON.stringify(row.original) !== JSON.stringify(row.current);

const isEmptyDraft = (draft: CheckDraft) => !draft.name.trim() && !draft.expression.trim();

export const CheckConstraintsView: React.FC<CheckConstraintsViewProps> = ({
    schema,
    tableName,
    refreshKey,
    readOnlyMode = false,
    isActive = false,
    onActionsChange,
    onDirtyCountChange,
}) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [rows, setRows] = useState<CheckRowState[]>([]);
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
            const result = await GetCheckConstraints(activeProfile.name, schema, tableName).catch(() => []);
            const nextRows = (result ?? []).map((check, index) => {
                const draft: CheckDraft = {
                    name: check.Name || '',
                    expression: check.Expression || '',
                };
                return {
                    id: `chk-${index}-${draft.name}`,
                    original: cloneDraft(draft),
                    current: cloneDraft(draft),
                    deleted: false,
                };
            });
            setRows(nextRows);
            setEditCell(null);
            setSelectedRows(new Set());
        } catch (error: unknown) {
            toast.error(`Failed to load check constraints: ${getErrorMessage(error)}`);
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

    const updateRow = useCallback((rowId: string, patch: Partial<CheckDraft>) => {
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
            .filter(Boolean) as CheckRowState[]);
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

    const validateDraft = useCallback((draft: CheckDraft): string | null => {
        if (!draft.name.trim()) return 'Check constraint name is required';
        if (!draft.expression.trim()) return `"${draft.name}" needs an expression`;
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
            ...toCreate.map((row) => `- Create: ${row.current.name} (${row.current.expression})`),
            ...toUpdate.map((row) => `- Update: ${row.original.name} -> ${row.current.name}`),
        ];

        const guard = await writeSafetyGuard.guardOperations(ops, 'Apply Check Constraint Changes', summaryLines);
        if (!guard.allowed) {
            if (guard.blockedReason) toast.error(guard.blockedReason);
            return;
        }

        setSaving(true);
        try {
            for (const row of toDrop) {
                await DropCheckConstraint(activeProfile.name, schema, tableName, row.original.name);
            }
            for (const row of toCreate) {
                await CreateCheckConstraint(activeProfile.name, schema, tableName, row.current.name, row.current.expression);
            }
            for (const row of toUpdate) {
                await DropCheckConstraint(activeProfile.name, schema, tableName, row.original.name);
                await CreateCheckConstraint(activeProfile.name, schema, tableName, row.current.name, row.current.expression);
            }
            toast.success('Check constraint changes applied');
            await load();
        } catch (error: unknown) {
            toast.error(`Failed to apply check constraint changes: ${getErrorMessage(error)}`);
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
            .filter(Boolean) as CheckRowState[]);
        setSelectedRows(new Set());
        setEditCell(null);
    }, [readOnlyMode, selectedRows]);

    const hasChanges = dirtyCount > 0;

    const actions = useMemo<TabAction[]>(() => {
        if (readOnlyMode) return [];
        const result: TabAction[] = [];

        if (!saving) {
            result.push({
                id: 'chk-add',
                icon: <Plus size={12} />,
                label: 'Add Check',
                title: 'Add check constraint',
                onClick: () => {
                    const draft: CheckDraft = { name: '', expression: '' };
                    const row: CheckRowState = {
                        id: `chk-new-${Date.now()}`,
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
                id: 'chk-delete-selected',
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
                id: 'chk-discard',
                icon: <RotateCcw size={12} />,
                label: 'Discard',
                title: 'Discard pending changes',
                onClick: discard,
                disabled: saving,
                danger: true,
            });
            result.push({
                id: 'chk-save',
                icon: <Save size={12} />,
                label: 'Save',
                title: 'Save check constraint changes',
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
                        style={{ width: '100%', minWidth: '640px' }}
                    >
                        <TableHeader className="[&_tr]:border-b-0">
                            <TableRow className="border-b-2 border-border hover:bg-transparent">
                                <TableHead className="rt-th w-10 font-mono text-[10px] text-muted-foreground">
                                    <div className="rt-th-label justify-center">#</div>
                                </TableHead>
                                <TableHead className="rt-th" style={{ width: '200px' }}>
                                    <div className="rt-th-label">Name</div>
                                </TableHead>
                                <TableHead className="rt-th" style={{ width: '430px' }}>
                                    <div className="rt-th-label">Expression</div>
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
                                const isEditingExpression = editCell?.rowId === row.id && editCell.field === 'expression';

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

                                        <TableCell className="p-0 border-b border-border" style={{ width: '200px' }}>
                                            {isEditingName ? (
                                                <Input
                                                    autoFocus
                                                    onFocus={(event) => event.target.select()}
                                                    placeholder="check_constraint_name"
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

                                        <TableCell className="p-0 border-b border-border" style={{ width: '430px' }}>
                                            {isEditingExpression ? (
                                                <Input
                                                    autoFocus
                                                    onFocus={(event) => event.target.select()}
                                                    placeholder="CHECK (amount > 0)"
                                                    className="rt-cell-input font-mono"
                                                    value={row.current.expression}
                                                    onChange={(event) => updateRow(row.id, { expression: event.target.value })}
                                                    onBlur={() => setEditCell(null)}
                                                    onKeyDown={(event) => {
                                                        if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
                                                        if (event.key === 'Escape') setEditCell(null);
                                                    }}
                                                    disabled={saving || rowIsDeleted}
                                                />
                                            ) : (
                                                <div
                                                    className={`rt-cell-content rt-cell-content--compact font-mono text-[11px] text-muted-foreground
                                                        ${rowIsDeleted ? 'opacity-40' : ''}
                                                        ${!readOnlyMode && !rowIsDeleted ? 'cursor-pointer' : ''}
                                                    `}
                                                    title={row.current.expression}
                                                    onDoubleClick={() => !readOnlyMode && !rowIsDeleted && setEditCell({ rowId: row.id, field: 'expression' })}
                                                >
                                                    {row.current.expression || <span className="italic text-muted-foreground/40">enter check expression</span>}
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
                                            ? 'No check constraints defined for this table.'
                                            : 'No check constraints yet. Click "Add Check" to create one.'}
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
