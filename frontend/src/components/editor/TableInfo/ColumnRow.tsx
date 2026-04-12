import React from 'react';
import { models } from '../../../../wailsjs/go/models';
import { DataTypeCell } from './DataTypeCell';
import { RowState } from './types';
import { Input, Switch, TableCell, TableRow } from '../../ui';

interface ColumnRowProps {
    row: RowState;
    rowIdx: number;
    displayIdx: number;
    types: string[];
    editCell: { rowIdx: number; field: 'Name' | 'DefaultValue' } | null;
    setEditCell: React.Dispatch<React.SetStateAction<{ rowIdx: number; field: 'Name' | 'DefaultValue' } | null>>;
    onUpdate: (rowIdx: number, patch: Partial<models.ColumnDef>) => void;
    onDiscard: (rowIdx: number) => void;
    rowError: string | undefined;
    isSelected: boolean;
    onRowMouseDown: (e: React.MouseEvent, idx: number) => void;
    onRowMouseEnter: (idx: number) => void;
    readOnlyMode?: boolean;
}

export const ColumnRow: React.FC<ColumnRowProps> = ({
    row, rowIdx, displayIdx, types, editCell, setEditCell, onUpdate, onDiscard, rowError, isSelected, onRowMouseDown, onRowMouseEnter, readOnlyMode = false
}) => {
    const col = row.current;
    const isDeleted = row.deleted;
    const isNew = row.isNew;
    const isDirty = !isDeleted && !isNew && JSON.stringify(row.original) !== JSON.stringify(row.current);

    const rowClassName = `
        group relative transition-all duration-150
        ${displayIdx % 2 !== 0 ? 'rt-row-alt' : ''}
        ${isSelected ? 'rt-row-selected' : ''}
        ${isDeleted ? 'rt-row-deleted' : ''}
    `;

    return (
        <React.Fragment>
            <TableRow
                onMouseDown={(e) => onRowMouseDown(e, rowIdx)}
                onMouseEnter={() => onRowMouseEnter(rowIdx)}
                className={`${rowClassName} border-b-0 hover:bg-transparent`}
            >
                {/* Index / Selector */}
                <TableCell className="w-10 text-center border-b border-border">
                    <div
                        className="rt-cell-content rt-cell-content--compact row-num-col"
                        onDoubleClick={() => (isDirty || isDeleted) && onDiscard(rowIdx)}
                        title={(isDirty || isDeleted) ? 'Double-click to discard changes' : undefined}
                    >
                        {rowIdx + 1}
                    </div>
                </TableCell>

                {/* Name */}
                <TableCell className="p-0 border-b border-border">
                    {editCell?.rowIdx === rowIdx && editCell.field === 'Name' ? (
                        <Input
                            autoFocus
                            onFocus={e => e.target.select()}
                            className="rt-cell-input font-mono"
                            defaultValue={col.Name}
                            onBlur={e => { onUpdate(rowIdx, { Name: e.target.value }); setEditCell(null); }}
                            onKeyDown={e => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                if (e.key === 'Escape') setEditCell(null);
                            }}
                        />
                    ) : (
                        <div
                            className={`rt-cell-content rt-cell-content--compact font-mono ${isDirty && col.Name !== row.original.Name ? 'rt-cell-dirty' : ''}`}
                            onDoubleClick={() => !isDeleted && !readOnlyMode && setEditCell({ rowIdx, field: 'Name' })}
                            title={col.Name}
                        >
                            {col.Name}
                        </div>
                    )}
                </TableCell>

                {/* DataType */}
                <TableCell className="p-0 border-b border-border">
                    <DataTypeCell
                        value={col.DataType}
                        types={types}
                        isDirty={col.DataType !== row.original.DataType}
                        disabled={isDeleted || readOnlyMode}
                        onCommit={v => onUpdate(rowIdx, { DataType: v })}
                    />
                </TableCell>

                {/* PK */}
                <TableCell className="w-12 text-center border-b border-border">
                    <div className="rt-cell-content rt-cell-content--compact justify-center">
                        <Switch
                            checked={col.IsPrimaryKey}
                            disabled={isDeleted || readOnlyMode}
                            onCheckedChange={(checked) => onUpdate(rowIdx, { IsPrimaryKey: checked })}
                            className="scale-75 origin-center"
                        />
                    </div>
                </TableCell>

                {/* Nullable */}
                <TableCell className="w-16 text-center border-b border-border">
                    <div className="rt-cell-content rt-cell-content--compact justify-center">
                        <Switch
                            checked={col.IsNullable}
                            disabled={isDeleted || readOnlyMode}
                            onCheckedChange={(checked) => onUpdate(rowIdx, { IsNullable: checked })}
                            className="scale-75 origin-center"
                        />
                    </div>
                </TableCell>

                {/* Default */}
                <TableCell className="p-0 border-b border-border">
                    {isDeleted
                        ? <div className="rt-cell-content rt-cell-content--compact font-mono opacity-40 italic">{col.DefaultValue || 'NULL'}</div>
                        : editCell?.rowIdx === rowIdx && editCell.field === 'DefaultValue'
                            ? <Input
                                autoFocus
                                onFocus={e => e.target.select()}
                                className="rt-cell-input font-mono text-label"
                                defaultValue={col.DefaultValue}
                                onBlur={e => { onUpdate(rowIdx, { DefaultValue: e.target.value }); setEditCell(null); }}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                    if (e.key === 'Escape') setEditCell(null);
                                }}
                            />
                            : <div
                                className={`rt-cell-content rt-cell-content--compact font-mono ${isDirty && col.DefaultValue !== row.original.DefaultValue ? 'rt-cell-dirty' : ''} ${col.DefaultValue ? 'text-muted-foreground' : 'text-muted-foreground'}`}
                                onDoubleClick={() => !readOnlyMode && setEditCell({ rowIdx, field: 'DefaultValue' })}
                                title={col.DefaultValue || 'None'}
                            >
                                {col.DefaultValue || 'NULL'}
                            </div>
                    }
                </TableCell>
            </TableRow>
            {rowError && (
                <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={6} className="px-10 py-1 bg-error/10 text-error text-[10px] border-b border-border/20">
                        <span className="font-bold mr-2 uppercase tracking-wider">Error</span>
                        {rowError}
                    </TableCell>
                </TableRow>
            )}
        </React.Fragment>
    );
};
