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
        group relative transition-all duration-150 hover:bg-text-primary/5
        ${displayIdx % 2 !== 0 && !isSelected && !isNew && !isDirty ? 'bg-bg-secondary/30' : ''}
        ${isSelected ? 'bg-accent/10 hover:bg-accent/15' : ''}
        ${isDeleted ? 'opacity-40 grayscale bg-error/5' : ''}
        ${isNew && !isSelected ? 'bg-success/5' : ''}
        ${isDirty && !isSelected && !isNew ? 'bg-accent/5' : ''}
    `;

    return (
        <>
            <tr
                onMouseDown={(e) => onRowMouseDown(e, rowIdx)}
                onMouseEnter={() => onRowMouseEnter(rowIdx)}
                className={rowClassName}
                style={{ height: 32 }}
            >
                {/* Index / Selector */}
                <td className="w-10 text-center relative border-l-2 border-l-transparent border-r border-border/10 transition-all">
                    {isSelected && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-accent" />}
                    <div
                        className={`text-[10px] font-mono tabular-nums select-none ${isSelected ? 'text-accent font-bold' : 'text-text-muted'
                            } ${isDirty || isDeleted ? 'text-error' : ''}`}
                        onDoubleClick={() => (isDirty || isDeleted) && onDiscard(rowIdx)}
                        title={(isDirty || isDeleted) ? 'Double-click to discard changes' : undefined}
                    >
                        {rowIdx + 1}
                    </div>
                </td>

                {/* Name */}
                <td className="px-0 border-r border-border/10">
                    {editCell?.rowIdx === rowIdx && editCell.field === 'Name' ? (
                        <input
                            autoFocus
                            onFocus={e => e.target.select()}
                            className="w-full h-8 px-3 bg-bg-tertiary text-text-primary border-none outline-none font-mono text-sm border-l border-accent"
                            defaultValue={col.Name}
                            onBlur={e => { onUpdate(rowIdx, { Name: e.target.value }); setEditCell(null); }}
                            onKeyDown={e => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                if (e.key === 'Escape') setEditCell(null);
                            }}
                        />
                    ) : (
                        <div
                            className={`px-3 py-1 cursor-text transition-colors truncate font-mono text-sm ${isDirty && col.Name !== row.original.Name
                                    ? 'text-success font-semibold'
                                    : col.IsPrimaryKey ? 'font-bold text-text-primary' : 'text-text-primary/90'
                                }`}
                            onDoubleClick={() => !isDeleted && setEditCell({ rowIdx, field: 'Name' })}
                            title={col.Name}
                        >
                            {col.Name}
                        </div>
                    )}
                </td>

                {/* DataType */}
                <td className="px-0 border-r border-border/10">
                    <DataTypeCell
                        value={col.DataType}
                        types={types}
                        isDirty={col.DataType !== row.original.DataType}
                        disabled={isDeleted}
                        onCommit={v => onUpdate(rowIdx, { DataType: v })}
                    />
                </td>

                {/* PK */}
                <td className="w-12 text-center border-r border-border/10">
                    <div className="flex items-center justify-center h-full">
                        <input
                            type="checkbox"
                            checked={col.IsPrimaryKey}
                            disabled={isDeleted}
                            onChange={e => onUpdate(rowIdx, { IsPrimaryKey: e.target.checked })}
                            className="w-3.5 h-3.5 rounded-sm border-border accent-accent cursor-pointer disabled:cursor-not-allowed opacity-80 hover:opacity-100 transition-opacity"
                        />
                    </div>
                </td>

                {/* Nullable */}
                <td className="w-16 text-center border-r border-border/10">
                    <div className="flex items-center justify-center h-full">
                        <input
                            type="checkbox"
                            checked={col.IsNullable}
                            disabled={isDeleted}
                            onChange={e => onUpdate(rowIdx, { IsNullable: e.target.checked })}
                            className="w-3.5 h-3.5 rounded-sm border-border accent-accent cursor-pointer disabled:cursor-not-allowed opacity-80 hover:opacity-100 transition-opacity"
                        />
                    </div>
                </td>

                {/* Default */}
                <td className="px-0 border-r border-border/10">
                    {isDeleted
                        ? <div className="px-3 py-1 text-text-muted italic truncate font-mono text-xs opacity-60">{col.DefaultValue || 'NULL'}</div>
                        : editCell?.rowIdx === rowIdx && editCell.field === 'DefaultValue'
                            ? <input
                                autoFocus
                                onFocus={e => e.target.select()}
                                className="w-full h-8 px-3 bg-bg-tertiary text-text-primary border-none outline-none font-mono text-xs border-l border-accent"
                                defaultValue={col.DefaultValue}
                                onBlur={e => { onUpdate(rowIdx, { DefaultValue: e.target.value }); setEditCell(null); }}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                    if (e.key === 'Escape') setEditCell(null);
                                }}
                            />
                            : <div
                                className={`px-3 py-1 cursor-text font-mono text-xs transition-colors truncate ${col.DefaultValue ? 'text-text-secondary' : 'text-text-muted'
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
                    <td colSpan={6} className="px-10 py-1 bg-error/10 text-error text-[10px] border-b border-border/20">
                        <span className="font-bold mr-2 uppercase tracking-wider">Error</span>
                        {rowError}
                    </td>
                </tr>
            )}
        </>
    );
};

