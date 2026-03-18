import React, { useEffect, useState, useMemo } from 'react';
import { Loader, Trash2, Hash } from 'lucide-react';
import { GetIndexes, DropIndex } from '../../../../wailsjs/go/app/App';
import { useConnectionStore } from '../../../stores/connectionStore';
import { useToast } from '../../layout/Toast';
import { ConfirmationModal } from '../../ui/ConfirmationModal';

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
}

export const IndexInfoView: React.FC<IndexInfoViewProps> = ({ schema, tableName, filterText, refreshKey }) => {
    const [indexes, setIndexes] = useState<IndexInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [dropIndexTarget, setDropIndexTarget] = useState<string | null>(null);
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

    if (indexes.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 h-full text-center">
                <div className="w-16 h-16 rounded-full bg-bg-tertiary flex items-center justify-center mb-6">
                    <Hash size={32} className="text-text-muted" />
                </div>
                <h2 className="text-lg font-bold text-text-primary mb-2">No Indexes Found</h2>
                <p className="text-[13px] text-text-secondary max-w-sm">
                    This table does not have any indexes.
                </p>
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
            
            <div className="w-full min-w-[700px]">
                <div className="sticky top-0 z-10 grid grid-cols-[auto_1fr_auto_40px] items-center gap-4 bg-bg-secondary px-4 py-2 text-[10px] font-bold text-text-muted uppercase tracking-wider border-b border-border/50">
                    <div className="w-8 text-center">#</div>
                    <div>Name</div>
                    <div className="w-[300px]">Columns</div>
                    <div className="w-10 text-center">Actions</div>
                </div>

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
                                    className="text-text-muted hover:text-error hover:bg-error/10 p-1.5 rounded"
                                    title="Drop Index"
                                >
                                    <Trash2 size={13} />
                                </button>
                            </div>
                        </div>
                    ))}
                    {filteredIndexes.length === 0 && filterText && (
                        <div className="py-8 text-center text-text-secondary text-[12px]">
                            No indexes match "{filterText}"
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
