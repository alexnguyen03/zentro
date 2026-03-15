import React from 'react';
import { models } from '../../../../wailsjs/go/models';
import { DataTypeCell } from './DataTypeCell';
import { RowState } from './types';

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
}

export const ColumnRow: React.FC<ColumnRowProps> = ({
    row, rowIdx, displayIdx, types, editCell, setEditCell, onUpdate, onDiscard, rowError, isSelected, onRowMouseDown, onRowMouseEnter
}) => {
    const col = row.current;
    const isDeleted = row.deleted;
    const isNew = row.isNew;
    const isDirty = !isDeleted && !isNew && JSON.stringify(row.original) !== JSON.stringify(row.current);

    const rowClassName = `
        group relative transition-colors duration-150
        ${isSelected ? 'bg-accent/10' : ''}
        ${isDeleted ? 'opacity-50 grayscale bg-red-500/5' : ''}
        ${isNew && !isSelected ? 'bg-success/5' : ''}
        ${isDirty && !isSelected && !isNew ? 'bg-amber-500/5' : ''}
    `;

    return (
        <>
            <tr
                onMouseDown={(e) => onRowMouseDown(e, rowIdx)}
                onMouseEnter={() => onRowMouseEnter(rowIdx)}
                className={rowClassName}
                style={{ height: 36 }}
            >
                {/* Index / Selector */}
                <td className="w-10 text-center border-l-2 border-transparent transition-all">
                    <div 
                        className={`text-[10px] font-mono tabular-nums ${
                            isSelected ? 'text-accent font-bold' : 'text-text-muted'
                        } ${isDirty || isDeleted ? 'text-error' : ''}`}
                        onDoubleClick={() => (isDirty || isDeleted) && onDiscard(rowIdx)}
                        title={(isDirty || isDeleted) ? 'Double-click to discard changes' : undefined}
                    >
                        {rowIdx + 1}
                    </div>
                    {isSelected && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-accent" />}
                </td>

                {/* Name */}
                <td className="px-0">
                    {editCell?.rowIdx === rowIdx && editCell.field === 'Name' ? (
                        <input
                            autoFocus
                            onFocus={e => e.target.select()}
                            className="w-full h-9 px-3 bg-bg-tertiary text-text-primary border-none outline-none font-medium"
                            defaultValue={col.Name}
                            onBlur={e => { onUpdate(rowIdx, { Name: e.target.value }); setEditCell(null); }}
                            onKeyDown={e => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                if (e.key === 'Escape') setEditCell(null);
                            }}
                        />
                    ) : (
                        <div
                            className={`px-3 py-2 cursor-text transition-colors truncate ${
                                isDirty && col.Name !== row.original.Name 
                                ? 'text-success font-semibold' 
                                : col.IsPrimaryKey ? 'font-bold text-text-primary' : 'text-text-primary'
                            }`}
                            onDoubleClick={() => !isDeleted && setEditCell({ rowIdx, field: 'Name' })}
                            title={col.Name}
                        >
                            {col.Name}
                        </div>
                    )}
                </td>

                {/* DataType */}
                <td className="px-0">
                    <DataTypeCell
                        value={col.DataType}
                        types={types}
                        isDirty={col.DataType !== row.original.DataType}
                        disabled={isDeleted}
                        onCommit={v => onUpdate(rowIdx, { DataType: v })}
                    />
                </td>

                {/* PK */}
                <td className="w-12 text-center">
                    <input 
                        type="checkbox" 
                        checked={col.IsPrimaryKey} 
                        disabled={isDeleted}
                        onChange={e => onUpdate(rowIdx, { IsPrimaryKey: e.target.checked })}
                        className="w-3.5 h-3.5 rounded border-border accent-accent cursor-pointer disabled:cursor-not-allowed" 
                    />
                </td>

                {/* Nullable */}
                <td className="w-16 text-center">
                    <input 
                        type="checkbox" 
                        checked={col.IsNullable} 
                        disabled={isDeleted}
                        onChange={e => onUpdate(rowIdx, { IsNullable: e.target.checked })}
                        className="w-3.5 h-3.5 rounded border-border accent-accent cursor-pointer disabled:cursor-not-allowed" 
                    />
                </td>

                {/* Default */}
                <td className="px-0">
                    {isDeleted
                        ? <div className="px-3 py-2 text-(--text-tertiary) italic truncate">{col.DefaultValue || 'NULL'}</div>
                        : editCell?.rowIdx === rowIdx && editCell.field === 'DefaultValue'
                            ? <input 
                                autoFocus 
                                onFocus={e => e.target.select()} 
                                className="w-full h-9 px-3 bg-(--bg-tertiary) text-(--text-primary) border-none outline-none font-mono text-xs"
                                defaultValue={col.DefaultValue}
                                onBlur={e => { onUpdate(rowIdx, { DefaultValue: e.target.value }); setEditCell(null); }}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                    if (e.key === 'Escape') setEditCell(null);
                                }} 
                              />
                            : <div
                                className={`px-3 py-2 cursor-text font-mono text-xs transition-colors truncate ${
                                    col.DefaultValue ? 'text-text-secondary' : 'text-text-muted'
                                } ${isDirty && col.DefaultValue !== row.original.DefaultValue ? 'text-success' : ''}`}
                                onDoubleClick={() => setEditCell({ rowIdx, field: 'DefaultValue' })}
                                title={col.DefaultValue || 'None'}
                            >
                                {col.DefaultValue || 'NULL'}
                            </div>
                    }
                </td>
            </tr>
            {rowError && (
                <tr>
                    <td colSpan={6} className="px-10 py-1 bg-error/10 text-error text-[10px] border-b border-border">
                        <span className="font-bold mr-2">ERROR</span>
                        {rowError}
                    </td>
                </tr>
            )}
        </>
    );
};
