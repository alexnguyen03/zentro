import React, { useState } from 'react';
import { Plus, Trash2, Save, Table2 } from 'lucide-react';
import { Modal } from '../layout/Modal';
import { Button } from '../ui';
import { CreateTable } from '../../../wailsjs/go/app/App';
import { useConnectionStore } from '../../stores/connectionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useToast } from '../layout/Toast';
import { FetchDatabaseSchema } from '../../../wailsjs/go/app/App';

interface Column {
    Name: string;
    DataType: string;
    IsNullable: boolean;
    IsPrimaryKey: boolean;
    DefaultValue: string;
}

interface CreateTableModalProps {
    isOpen: boolean;
    onClose: () => void;
    schema: string;
}

const DATA_TYPES = [
    'INT', 'BIGINT', 'SMALLINT', 'SERIAL',
    'VARCHAR(255)', 'TEXT', 'CHAR(10)',
    'BOOLEAN',
    'DATE', 'TIMESTAMP', 'TIMESTAMPTZ',
    'DECIMAL(10,2)', 'NUMERIC(10,2)', 'FLOAT', 'DOUBLE PRECISION',
    'JSON', 'JSONB',
    'UUID',
    'BYTEA'
];

export const CreateTableModal: React.FC<CreateTableModalProps> = ({ isOpen, onClose, schema }) => {
    const [tableName, setTableName] = useState('');
    const [columns, setColumns] = useState<Column[]>([
        { Name: 'id', DataType: 'SERIAL', IsNullable: false, IsPrimaryKey: true, DefaultValue: '' }
    ]);
    const [loading, setLoading] = useState(false);
    const { activeProfile } = useConnectionStore();
    const viewMode = useSettingsStore((state) => state.viewMode);
    const { toast } = useToast();

    const handleAddColumn = () => {
        setColumns([...columns, { Name: '', DataType: 'VARCHAR(255)', IsNullable: true, IsPrimaryKey: false, DefaultValue: '' }]);
    };

    const handleRemoveColumn = (index: number) => {
        setColumns(columns.filter((_, i) => i !== index));
    };

    const handleColumnChange = (index: number, field: keyof Column, value: string | boolean) => {
        const newCols = [...columns];
        (newCols[index] as any)[field] = value;
        setColumns(newCols);
    };

    const handleSubmit = async () => {
        if (viewMode) {
            toast.error('View Mode is enabled. Write actions are blocked.');
            return;
        }

        if (!tableName.trim()) {
            toast.error('Table name is required');
            return;
        }
        if (columns.length === 0) {
            toast.error('At least one column is required');
            return;
        }
        for (const col of columns) {
            if (!col.Name.trim()) {
                toast.error('All columns must have a name');
                return;
            }
        }
        if (!activeProfile?.name) {
            toast.error('No active connection');
            return;
        }

        setLoading(true);
        try {
            await CreateTable(activeProfile.name, schema, tableName, columns as any);
            toast.success(`Table "${tableName}" created successfully`);
            if (activeProfile?.name && activeProfile?.db_name) {
                await FetchDatabaseSchema(activeProfile.name, activeProfile.db_name);
            }
            setTableName('');
            setColumns([{ Name: 'id', DataType: 'SERIAL', IsNullable: false, IsPrimaryKey: true, DefaultValue: '' }]);
            onClose();
        } catch (err: any) {
            toast.error(`Failed to create table: ${err}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={
                <div className="flex items-center gap-2">
                    <Table2 size={18} className="text-accent" />
                    <span>Create Table</span>
                </div>
            }
            width={700}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={handleSubmit} disabled={loading || viewMode}>
                        <Save size={14} className="mr-1.5" />
                        {loading ? 'Creating...' : 'Create'}
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Table Name</label>
                    <input
                        type="text"
                        value={tableName}
                        onChange={(e) => setTableName(e.target.value)}
                        placeholder="Enter table name"
                        disabled={viewMode}
                        className="w-full bg-bg-primary border border-border text-text-primary text-[13px] px-3 py-2 rounded-sm outline-none focus:border-accent"
                    />
                </div>

                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium text-text-secondary">Columns</label>
                        <Button variant="ghost" size="sm" onClick={handleAddColumn} disabled={viewMode}>
                            <Plus size={14} className="mr-1" />
                            Add Column
                        </Button>
                    </div>

                    <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                        {columns.map((col, idx) => (
                            <div key={idx} className="flex items-center gap-2 bg-bg-primary p-2 rounded border border-border">
                                <input
                                    type="text"
                                    value={col.Name}
                                    onChange={(e) => handleColumnChange(idx, 'Name', e.target.value)}
                                    placeholder="Column name"
                                    disabled={viewMode}
                                    className="flex-1 bg-bg-secondary border border-border text-text-primary text-[12px] px-2 py-1 rounded outline-none focus:border-accent min-w-[100px]"
                                />
                                <select
                                    value={col.DataType}
                                    onChange={(e) => handleColumnChange(idx, 'DataType', e.target.value)}
                                    disabled={viewMode}
                                    className="flex-1 bg-bg-secondary border border-border text-text-primary text-[12px] px-2 py-1 rounded outline-none focus:border-accent min-w-[120px]"
                                >
                                    {DATA_TYPES.map(dt => (
                                        <option key={dt} value={dt}>{dt}</option>
                                    ))}
                                </select>
                                <label className="flex items-center gap-1 text-[11px] text-text-secondary whitespace-nowrap">
                                    <input
                                        type="checkbox"
                                        checked={col.IsNullable}
                                        onChange={(e) => handleColumnChange(idx, 'IsNullable', e.target.checked)}
                                        disabled={viewMode}
                                        className="rounded"
                                    />
                                    Null
                                </label>
                                <label className="flex items-center gap-1 text-[11px] text-text-secondary whitespace-nowrap">
                                    <input
                                        type="checkbox"
                                        checked={col.IsPrimaryKey}
                                        onChange={(e) => handleColumnChange(idx, 'IsPrimaryKey', e.target.checked)}
                                        disabled={viewMode}
                                        className="rounded"
                                    />
                                    PK
                                </label>
                                {columns.length > 1 && (
                                    <button
                                        onClick={() => handleRemoveColumn(idx)}
                                        disabled={viewMode}
                                        className="text-text-secondary hover:text-error p-1"
                                        title="Remove column"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </Modal>
    );
};
