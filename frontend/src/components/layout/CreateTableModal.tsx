import React, { useState } from 'react';
import { Plus, Trash2, Save, Table2 } from 'lucide-react';
import { Button, Checkbox, Input, Modal, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui';
import { CreateTable } from '../../services/schemaService';
import { useConnectionStore } from '../../stores/connectionStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useToast } from '../layout/Toast';
import { FetchDatabaseSchema } from '../../services/schemaService';
import { getErrorMessage } from '../../lib/errors';
import { models } from '../../../wailsjs/go/models';
import { useWriteSafetyGuard } from '../../features/query/useWriteSafetyGuard';

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
    const activeEnvironmentKey = useEnvironmentStore((state) => state.activeEnvironmentKey);
    const viewMode = useSettingsStore((state) => state.viewMode);
    const { toast } = useToast();
    const writeSafetyGuard = useWriteSafetyGuard(activeEnvironmentKey);

    const handleAddColumn = () => {
        setColumns([...columns, { Name: '', DataType: 'VARCHAR(255)', IsNullable: true, IsPrimaryKey: false, DefaultValue: '' }]);
    };

    const handleRemoveColumn = (index: number) => {
        setColumns(columns.filter((_, i) => i !== index));
    };

    const handleColumnChange = <K extends keyof Column>(index: number, field: K, value: Column[K]) => {
        const newCols = [...columns];
        newCols[index] = {
            ...newCols[index],
            [field]: value,
        };
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
        const guard = await writeSafetyGuard.guardOperations(['create'], 'Create Table');
        if (!guard.allowed) {
            if (guard.blockedReason) {
                toast.error(guard.blockedReason);
            }
            return;
        }

        setLoading(true);
        try {
            await CreateTable(
                activeProfile.name,
                schema,
                tableName,
                columns.map((column) => new models.ColumnDef(column)),
            );
            toast.success(`Table "${tableName}" created successfully`);
            if (activeProfile?.name && activeProfile?.db_name) {
                await FetchDatabaseSchema(activeProfile.name, activeProfile.db_name);
            }
            setTableName('');
            setColumns([{ Name: 'id', DataType: 'SERIAL', IsNullable: false, IsPrimaryKey: true, DefaultValue: '' }]);
            onClose();
        } catch (err: unknown) {
            toast.error(`Failed to create table: ${getErrorMessage(err)}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
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
                        <Button variant="default" onClick={handleSubmit} disabled={loading || viewMode}>
                            <Save size={14} className="mr-1.5" />
                            {loading ? 'Creating...' : 'Create'}
                        </Button>
                    </>
                }
            >
                <div className="space-y-4">
                <div>
                    <label className="block text-small font-medium text-muted-foreground mb-1">Table Name</label>
                    <Input
                        type="text"
                        value={tableName}
                        onChange={(e) => setTableName(e.target.value)}
                        placeholder="Enter table name"
                        disabled={viewMode}
                        size="md"
                        className="w-full"
                    />
                </div>

                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-small font-medium text-muted-foreground">Columns</label>
                        <Button variant="ghost" size="sm" onClick={handleAddColumn} disabled={viewMode}>
                            <Plus size={14} className="mr-1" />
                            Add Column
                        </Button>
                    </div>

                    <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                        {columns.map((col, idx) => (
                            <div key={idx} className="flex items-center gap-2 bg-background p-2 rounded-sm border border-border">
                                <Input
                                    type="text"
                                    value={col.Name}
                                    onChange={(e) => handleColumnChange(idx, 'Name', e.target.value)}
                                    placeholder="Column name"
                                    disabled={viewMode}
                                    className="min-w-25 flex-1 bg-card"
                                />
                                <Select
                                    value={col.DataType}
                                    onValueChange={(value) => handleColumnChange(idx, 'DataType', value)}
                                >
                                    <SelectTrigger
                                        disabled={viewMode}
                                        className="min-w-[120px] flex-1 bg-card text-small"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {DATA_TYPES.map((dt) => (
                                            <SelectItem key={dt} value={dt}>{dt}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <label className="flex items-center gap-1 text-label text-muted-foreground whitespace-nowrap">
                                    <Checkbox
                                        checked={col.IsNullable}
                                        onCheckedChange={(checked) => handleColumnChange(idx, 'IsNullable', checked === true)}
                                        disabled={viewMode}
                                    />
                                    Null
                                </label>
                                <label className="flex items-center gap-1 text-label text-muted-foreground whitespace-nowrap">
                                    <Checkbox
                                        checked={col.IsPrimaryKey}
                                        onCheckedChange={(checked) => handleColumnChange(idx, 'IsPrimaryKey', checked === true)}
                                        disabled={viewMode}
                                    />
                                    PK
                                </label>
                                {columns.length > 1 && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleRemoveColumn(idx)}
                                        disabled={viewMode}
                                        className="h-7 w-7 text-muted-foreground hover:text-destructive p-1"
                                        title="Remove column"
                                    >
                                        <Trash2 size={14} />
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
                </div>
            </Modal>
            {writeSafetyGuard.modals}
        </>
    );
};
