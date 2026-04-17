import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, Save, Trash2 } from 'lucide-react';
import { GetPrimaryKey, AddPrimaryKey, DropPrimaryKey } from '../../../services/schemaService';
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

interface PKState {
    name: string;
    columns: string[];
}

// --- Props --------------------------------------------------------------------

interface PrimaryKeyViewProps {
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

// --- Component ----------------------------------------------------------------

export const PrimaryKeyView: React.FC<PrimaryKeyViewProps> = ({
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
    const supportsAlterPk = driver !== 'sqlite';

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [pk, setPk] = useState<PKState | null>(null);
    const [pkDraft, setPkDraft] = useState<PKState | null>(null);
    const [editingCols, setEditingCols] = useState(false);
    const [showDropConfirm, setShowDropConfirm] = useState(false);

    const { activeProfile } = useConnectionStore();
    const activeEnvironmentKey = useEnvironmentStore((s) => s.activeEnvironmentKey);
    const { toast } = useToast();
    const toastRef = useRef(toast);
    const { guardOperations, modals } = useWriteSafetyGuard(activeEnvironmentKey);
    const onActionsChangeRef = useRef<PrimaryKeyViewProps['onActionsChange']>(onActionsChange);
    const onDirtyCountChangeRef = useRef<PrimaryKeyViewProps['onDirtyCountChange']>(onDirtyCountChange);

    useEffect(() => {
        toastRef.current = toast;
    }, [toast]);

    useEffect(() => {
        onActionsChangeRef.current = onActionsChange;
    }, [onActionsChange]);

    useEffect(() => {
        onDirtyCountChangeRef.current = onDirtyCountChange;
    }, [onDirtyCountChange]);

    // -- Load ------------------------------------------------------------------

    const load = useCallback(async () => {
        if (!activeProfile?.name || !supportsAlterPk) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const result = await GetPrimaryKey(activeProfile.name, schema, tableName).catch(() => null);
            setPk(result ? { name: result.Name, columns: result.Columns ?? [] } : null);
            setPkDraft(null);
            setEditingCols(false);
        } catch (error: unknown) {
            toastRef.current.error(`Failed to load primary key: ${getErrorMessage(error)}`);
        } finally {
            setLoading(false);
        }
    }, [activeProfile?.name, schema, supportsAlterPk, tableName]);

    useEffect(() => { void load(); }, [load, refreshKey]);

    // -- Dirty -----------------------------------------------------------------

    const dirtyCount = pkDraft ? 1 : 0;
    useEffect(() => { onDirtyCountChangeRef.current?.(dirtyCount); }, [dirtyCount]);

    // -- Discard ---------------------------------------------------------------

    const discard = useCallback(() => {
        setPkDraft(null);
        setEditingCols(false);
    }, []);

    // -- Save ------------------------------------------------------------------

    const save = useCallback(async () => {
        if (readOnlyMode || !activeProfile?.name || !pkDraft) return;
        if (!pkDraft.name.trim()) { toastRef.current.error('Primary key name is required'); return; }
        if (!pkDraft.columns.length) { toastRef.current.error('Primary key needs at least one column'); return; }

        const summaryLines = [`• Add Primary Key: ${pkDraft.name} (${pkDraft.columns.join(', ')})`];
        const guard = await guardOperations(['create'], 'Apply Primary Key', summaryLines);
        if (!guard.allowed) {
            if (guard.blockedReason) toastRef.current.error(guard.blockedReason);
            return;
        }

        setSaving(true);
        try {
            await AddPrimaryKey(activeProfile.name, schema, tableName, pkDraft.name, pkDraft.columns);
            toastRef.current.success('Primary key applied');
            await load();
        } catch (error: unknown) {
            toastRef.current.error(`Failed to apply primary key: ${getErrorMessage(error)}`);
        } finally {
            setSaving(false);
        }
    }, [activeProfile?.name, guardOperations, load, pkDraft, readOnlyMode, schema, tableName]);

    // -- Drop ------------------------------------------------------------------

    const handleDropConfirm = useCallback(async () => {
        if (!pk || !activeProfile?.name) return;
        const guard = await guardOperations(
            ['drop'],
            'Drop Primary Key',
            [`• Drop Primary Key: ${pk.name}`],
        );
        if (!guard.allowed) {
            if (guard.blockedReason) toastRef.current.error(guard.blockedReason);
            setShowDropConfirm(false);
            return;
        }
        try {
            await DropPrimaryKey(activeProfile.name, schema, tableName, pk.name);
            toastRef.current.success(`Primary key "${pk.name}" dropped`);
            await load();
        } catch (error: unknown) {
            toastRef.current.error(`Failed to drop primary key: ${getErrorMessage(error)}`);
        } finally {
            setShowDropConfirm(false);
        }
    }, [activeProfile?.name, guardOperations, load, pk, schema, tableName]);

    // -- Actions ---------------------------------------------------------------

    const hasChanges = dirtyCount > 0;

    const actions = useMemo<TabAction[]>(() => {
        if (readOnlyMode || !supportsAlterPk) return [];
        const result: TabAction[] = [];
        if (!pk && !pkDraft && !saving) {
            result.push({
                id: 'pk-add',
                label: 'Add PK',
                title: 'Add Primary Key',
                icon: null,
                onClick: () => setPkDraft({ name: '', columns: [] }),
            });
        }
        if (hasChanges) {
            result.push({
                id: 'pk-discard',
                icon: <RotateCcw size={12} />,
                label: 'Discard',
                title: 'Discard pending changes',
                onClick: discard,
                disabled: saving,
                danger: true,
            });
            result.push({
                id: 'pk-save',
                icon: <Save size={12} />,
                label: 'Save',
                title: 'Save Primary Key',
                onClick: () => { void save(); },
                disabled: saving,
                loading: saving,
            });
        }
        return result;
    }, [readOnlyMode, supportsAlterPk, pk, pkDraft, saving, hasChanges, discard, save]);

    useEffect(() => { onActionsChangeRef.current?.(actions); }, [actions]);

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

    if (!supportsAlterPk) {
        return (
            <div className="px-3 py-3 text-[11px] text-muted-foreground italic">
                SQLite: primary key management via ALTER TABLE is not supported.
                {pk && (
                    <div className="mt-2 flex items-center gap-3">
                        <span className="font-mono text-[12px] text-foreground font-medium">{pk.name}</span>
                        <span className="font-mono text-[11px] text-muted-foreground">{pk.columns.join(', ')}</span>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-0">
            <div className="px-3 py-2">
                {!pk && !pkDraft && (
                    <p className="text-[11px] text-muted-foreground italic py-2">No primary key defined.</p>
                )}

                {pk && !pkDraft && (
                    <div className="flex items-center gap-3 py-1.5 group">
                        <span className="font-mono text-[12px] text-foreground font-medium min-w-[160px] truncate" title={pk.name}>
                            {pk.name}
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground flex-1 truncate">
                            {pk.columns.join(', ')}
                        </span>
                        {!readOnlyMode && (
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setShowDropConfirm(true)}
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
                            placeholder="pk_constraint_name"
                            value={pkDraft.name}
                            onChange={(e) => setPkDraft((d) => d ? { ...d, name: e.target.value } : d)}
                            className="rt-cell-input font-mono min-w-40 w-40"
                        />
                        <div className="flex-1" onMouseDown={(e) => e.stopPropagation()}>
                            {editingCols ? (
                                <ColumnPickerCell
                                    columns={tableColumns}
                                    selected={pkDraft.columns}
                                    onChange={(cols) => setPkDraft((d) => d ? { ...d, columns: cols } : d)}
                                    onClose={() => setEditingCols(false)}
                                    autoOpen
                                />
                            ) : (
                                <div
                                    className="font-mono text-[11px] text-muted-foreground cursor-pointer hover:text-foreground px-2 py-1 rounded border border-border/40 hover:border-border"
                                    onClick={() => setEditingCols(true)}
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
                            onClick={discard}
                            className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                        >
                            Cancel
                        </Button>
                    </div>
                )}
            </div>

            <ConfirmationModal
                isOpen={showDropConfirm}
                onClose={() => setShowDropConfirm(false)}
                onConfirm={() => { void handleDropConfirm(); }}
                title="Drop Primary Key"
                message={`Drop primary key "${pk?.name}"?`}
                description="This will execute immediately and cannot be undone."
                confirmLabel="Drop"
                variant="destructive"
            />
            {modals}
        </div>
    );
};
