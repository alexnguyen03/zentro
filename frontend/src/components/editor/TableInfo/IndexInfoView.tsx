import React, { useEffect, useState, useMemo } from 'react';
import { Loader, Trash2, Hash, Plus } from 'lucide-react';
import { GetIndexes, DropIndex, CreateIndex } from '../../../services/schemaService';
import { useConnectionStore } from '../../../stores/connectionStore';
import { useToast } from '../../layout/Toast';
import { ConfirmationModal } from '../../ui/ConfirmationModal';
import { Button } from '../../ui';

interface IndexInfo {
    Name: string;
    Table: string;
    Columns: string[];
    Unique: boolean;
}

interface IndexInfoViewProps {
    schema: string;
    tableName: string;
    filterText: string;
    refreshKey: number; // Trigger reload
    readOnlyMode?: boolean;
}

export const IndexInfoView: React.FC<IndexInfoViewProps> = ({ schema, tableName, filterText, refreshKey, readOnlyMode = false }) => {
    const [indexes, setIndexes] = useState<IndexInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [dropIndexTarget, setDropIndexTarget] = useState<string | null>(null);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newIndexName, setNewIndexName] = useState('');
    const [newIndexColumns, setNewIndexColumns] = useState('');
    const [newIndexUnique, setNewIndexUnique] = useState(false);
    const [saving, setSaving] = useState(false);
    const { activeProfile } = useConnectionStore();
    const { toast } = useToast();

    const loadIndexes = async () => {
        if (!activeProfile?.name) return;
        setLoading(true);
        try {
            const data = await GetIndexes(activeProfile.name, schema, tableName);
            setIndexes(data || []);
        } catch (err: any) {
            toast.error(`Failed to load indexes: ${err}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadIndexes();
    }, [schema, tableName, activeProfile?.name, refreshKey]);

    const handleDrop = async () => {
        if (readOnlyMode) return;
        if (!dropIndexTarget || !activeProfile?.name) return;
        try {
            await DropIndex(activeProfile.name, schema, dropIndexTarget);
            toast.success(`Index "${dropIndexTarget}" dropped`);
            loadIndexes();
        } catch (err: any) {
            toast.error(`Failed to drop index: ${err}`);
        } finally {
            setDropIndexTarget(null);
        }
    };

    const handleCreate = async () => {
        if (readOnlyMode) return;
        if (!newIndexName.trim()) {
            toast.error('Index name is required');
            return;
        }
        if (!newIndexColumns.trim()) {
            toast.error('Column(s) are required');
            return;
        }
        if (!activeProfile?.name) return;

        const cols = newIndexColumns.split(',').map(c => c.trim()).filter(Boolean);
        setSaving(true);
        try {
            await CreateIndex(activeProfile.name, schema, tableName, newIndexName, cols, newIndexUnique);
            toast.success(`Index "${newIndexName}" created successfully`);
            await loadIndexes();
            setShowCreateForm(false);
            setNewIndexName('');
            setNewIndexColumns('');
            setNewIndexUnique(false);
        } catch (err: any) {
            toast.error(`Failed to create index: ${err}`);
        } finally {
            setSaving(false);
        }
    };

    const filteredIndexes = useMemo(() => {
        if (!filterText.trim()) return indexes;
        const lower = filterText.toLowerCase();
        return indexes.filter(idx => 
            idx.Name.toLowerCase().includes(lower) || 
            idx.Columns.some(c => c.toLowerCase().includes(lower))
        );
    }, [indexes, filterText]);

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader size={20} className="animate-spin text-accent" />
            </div>
        );
    }

    const renderCreateForm = () => (
        <div className="bg-bg-secondary p-4 border-b border-border/50 shrink-0 space-y-3">
            <h3 className="text-[12px] font-bold text-text-primary uppercase tracking-wider mb-2">Create New Index</h3>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-[11px] font-medium text-text-secondary mb-1">Index Name</label>
                    <input
                        type="text"
                        value={newIndexName}
                        onChange={(e) => setNewIndexName(e.target.value)}
                        placeholder="idx_name"
                        className="w-full bg-bg-primary border border-border/40 text-text-primary text-[12px] px-2.5 py-1.5 rounded outline-none focus:border-accent"
                    />
                </div>
                <div>
                    <label className="block text-[11px] font-medium text-text-secondary mb-1">Columns (comma-separated)</label>
                    <input
                        type="text"
                        value={newIndexColumns}
                        onChange={(e) => setNewIndexColumns(e.target.value)}
                        placeholder="col1, col2"
                        className="w-full bg-bg-primary border border-border/40 text-text-primary text-[12px] px-2.5 py-1.5 rounded outline-none focus:border-accent"
                    />
                </div>
            </div>
            <div className="flex items-center justify-between mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={newIndexUnique}
                        onChange={(e) => setNewIndexUnique(e.target.checked)}
                        className="rounded cursor-pointer"
                    />
                    <span className="text-[11px] font-medium text-text-secondary">Unique Index</span>
                </label>
                <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setShowCreateForm(false)} className="h-7 text-[11px]">Cancel</Button>
                    <Button variant="primary" size="sm" onClick={handleCreate} disabled={saving} className="h-7 text-[11px]">
                        {saving ? 'Creating...' : 'Create Index'}
                    </Button>
                </div>
            </div>
        </div>
    );

    if (indexes.length === 0 && !loading && !showCreateForm && readOnlyMode) {
        return (
            <div className="flex flex-col items-center justify-center p-12 h-full text-center">
                <div className="w-16 h-16 rounded-full bg-bg-tertiary flex items-center justify-center mb-6">
                    <Hash size={32} className="text-text-muted" />
                </div>
                <h2 className="text-lg font-bold text-text-primary mb-2">No Indexes Found</h2>
                <p className="text-[13px] text-text-secondary max-w-sm mb-6">
                    This table does not have any indexes.
                </p>
            </div>
        );
    }

    if (indexes.length === 0 && !loading && !showCreateForm) {
        return (
            <div className="flex flex-col items-center justify-center p-12 h-full text-center">
                <div className="w-16 h-16 rounded-full bg-bg-tertiary flex items-center justify-center mb-6">
                    <Hash size={32} className="text-text-muted" />
                </div>
                <h2 className="text-lg font-bold text-text-primary mb-2">No Indexes Found</h2>
                <p className="text-[13px] text-text-secondary max-w-sm mb-6">
                    This table does not have any indexes.
                </p>
                <Button variant="ghost" onClick={() => setShowCreateForm(true)} disabled={readOnlyMode}>
                    <Plus size={14} className="mr-1.5" /> Add First Index
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-bg-primary overflow-auto">
            <ConfirmationModal
                isOpen={!!dropIndexTarget}
                onClose={() => setDropIndexTarget(null)}
                onConfirm={handleDrop}
                title="Drop Index"
                message={`Are you sure you want to drop index "${dropIndexTarget}"?`}
                description="This action cannot be undone."
                confirmLabel="Drop"
                variant="danger"
            />
            
            {showCreateForm && renderCreateForm()}

            {!showCreateForm && indexes.length > 0 && (
                <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 shrink-0">
                    <span className="text-[11px] font-medium text-text-secondary">{indexes.length} index(es)</span>
                    <Button variant="ghost" size="sm" onClick={() => setShowCreateForm(true)} className="h-7 px-2 text-[11px]" disabled={readOnlyMode}>
                        <Plus size={13} className="mr-1.5" />
                        New Index
                    </Button>
                </div>
            )}

            <div className="flex-1 w-full min-w-[700px] overflow-auto">
                {indexes.length > 0 && (
                    <div className="sticky top-0 z-sticky grid grid-cols-[auto_1fr_auto_40px] items-center gap-4 bg-bg-secondary px-4 py-2 text-[10px] font-bold text-text-muted uppercase tracking-wider border-b border-border/50">
                        <div className="w-8 text-center">#</div>
                        <div>Name</div>
                        <div className="w-[300px]">Columns</div>
                        <div className="w-10 text-center">Actions</div>
                    </div>
                )}

                <div className="divide-y divide-border/20">
                    {filteredIndexes.map((idx, i) => (
                        <div key={idx.Name} className="grid grid-cols-[auto_1fr_auto_40px] items-center gap-4 px-4 py-2.5 text-[12px] text-text-primary hover:bg-bg-secondary/40 transition-colors group">
                            <div className="w-8 text-center text-text-muted">{i + 1}</div>
                            <div className="flex items-center gap-2 truncate">
                                <span className="font-medium truncate" title={idx.Name}>{idx.Name}</span>
                                {idx.Unique && (
                                    <span className="text-[9px] font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded tracking-wide shrink-0">
                                        UNIQUE
                                    </span>
                                )}
                            </div>
                            <div className="w-[300px] text-text-secondary truncate font-mono text-[11px]" title={idx.Columns.join(', ')}>
                                {idx.Columns.join(', ')}
                            </div>
                            <div className="w-10 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => setDropIndexTarget(idx.Name)}
                                    className="text-text-muted hover:text-error hover:bg-error/10 p-1.5 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                                    title="Drop Index"
                                    disabled={readOnlyMode}
                                >
                                    <Trash2 size={13} />
                                </button>
                            </div>
                        </div>
                    ))}
                    {indexes.length > 0 && filteredIndexes.length === 0 && filterText && (
                        <div className="py-8 text-center text-text-secondary text-[12px]">
                            No indexes match "{filterText}"
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

