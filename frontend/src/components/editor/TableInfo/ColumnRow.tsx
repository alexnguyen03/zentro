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

const CELL_BORDER = { borderRight: '1px solid var(--border-color)' };

export const ColumnRow: React.FC<ColumnRowProps> = ({
    row, rowIdx, displayIdx, types, editCell, setEditCell,
    onUpdate, onDiscard, rowError, isSelected, onRowMouseDown, onRowMouseEnter
}) => {
    const col = row.current;
    const isDeleted = row.deleted;
    const isNew = row.isNew;
    const isDirty = !isDeleted && !isNew && JSON.stringify(row.original) !== JSON.stringify(row.current);

    const isEditingName    = editCell?.rowIdx === rowIdx && editCell.field === 'Name';
    const isEditingDefault = editCell?.rowIdx === rowIdx && editCell.field === 'DefaultValue';

    const altClass    = displayIdx % 2 !== 0 ? 'rt-row-alt' : '';
    const selClass    = isSelected && !isDeleted ? 'rt-row-selected' : '';
    const delClass    = isDeleted ? 'rt-row-deleted' : '';
    // new rows: green left gutter (no native rt class, use inline)
    const newGutter   = isNew && !isSelected;

    return (
        <>
            <tr
                onMouseDown={(e) => onRowMouseDown(e, rowIdx)}
                onMouseEnter={() => onRowMouseEnter(rowIdx)}
                className={[altClass, selClass, delClass].filter(Boolean).join(' ')}
                style={{ height: 32, background: newGutter ? 'color-mix(in srgb, var(--success-color) 6%, transparent)' : undefined }}
            >
                {/* # */}
                <td style={{
                    width: 52,
                    textAlign: 'center',
                    position: 'relative',
                    borderLeft: isSelected ? '2px solid var(--accent-color)' : '2px solid transparent',
                    ...CELL_BORDER,
                }}>
                    <div
                        className="rt-cell-content row-num-col"
                        onDoubleClick={() => (isDirty || isDeleted) && onDiscard(rowIdx)}
                        title={(isDirty || isDeleted) ? 'Double-click to discard' : undefined}
                        style={{ color: isDirty || isDeleted ? 'var(--error-color)' : undefined }}
                    >
                        {rowIdx + 1}
                    </div>
                </td>

                {/* Name */}
                <td style={CELL_BORDER}>
                    {isEditingName ? (
                        <input
                            autoFocus
                            spellCheck={false}
                            className="rt-cell-input"
                            defaultValue={col.Name}
                            onBlur={e => { onUpdate(rowIdx, { Name: e.target.value }); setEditCell(null); }}
                            onKeyDown={e => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                if (e.key === 'Escape') setEditCell(null);
                                if (e.key === 'Tab') { e.preventDefault(); (e.target as HTMLInputElement).blur(); setEditCell({ rowIdx, field: 'DefaultValue' }); }
                            }}
                            onClick={e => e.stopPropagation()}
                        />
                    ) : (
                        <div
                            className={`rt-cell-content ${isDirty && col.Name !== row.original.Name ? 'rt-cell-dirty' : ''}`}
                            onMouseDown={(e) => onRowMouseDown(e, rowIdx)}
                            onDoubleClick={() => !isDeleted && setEditCell({ rowIdx, field: 'Name' })}
                            title={col.Name}
                        >
                            <span style={{ fontWeight: col.IsPrimaryKey ? 700 : undefined }}>{col.Name}</span>
                        </div>
                    )}
                </td>

                {/* DataType */}
                <td style={{ width: 180, ...CELL_BORDER }}>
                    <DataTypeCell
                        value={col.DataType}
                        types={types}
                        isDirty={col.DataType !== row.original.DataType}
                        isRowSelected={isSelected}
                        disabled={isDeleted}
                        onCommit={v => onUpdate(rowIdx, { DataType: v })}
                    />
                </td>

                {/* PK */}
                <td style={{ width: 52, textAlign: 'center', ...CELL_BORDER }}>
                    <div className="rt-cell-content" style={{ justifyContent: 'center' }}>
                        <input
                            type="checkbox"
                            checked={col.IsPrimaryKey}
                            disabled={isDeleted}
                            onChange={e => onUpdate(rowIdx, { IsPrimaryKey: e.target.checked })}
                            style={{ accentColor: 'var(--accent-color)', cursor: isDeleted ? 'not-allowed' : 'pointer' }}
                        />
                    </div>
                </td>

                {/* Nullable */}
                <td style={{ width: 64, textAlign: 'center', ...CELL_BORDER }}>
                    <div className="rt-cell-content" style={{ justifyContent: 'center' }}>
                        <input
                            type="checkbox"
                            checked={col.IsNullable}
                            disabled={isDeleted}
                            onChange={e => onUpdate(rowIdx, { IsNullable: e.target.checked })}
                            style={{ accentColor: 'var(--accent-color)', cursor: isDeleted ? 'not-allowed' : 'pointer' }}
                        />
                    </div>
                </td>

                {/* Default */}
                <td style={{ width: 200, ...CELL_BORDER }}>
                    {isEditingDefault ? (
                        <input
                            autoFocus
                            spellCheck={false}
                            className="rt-cell-input"
                            defaultValue={col.DefaultValue}
                            onBlur={e => { onUpdate(rowIdx, { DefaultValue: e.target.value }); setEditCell(null); }}
                            onKeyDown={e => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                if (e.key === 'Escape') setEditCell(null);
                            }}
                            onClick={e => e.stopPropagation()}
                        />
                    ) : (
                        <div
                            className={`rt-cell-content ${isDirty && col.DefaultValue !== row.original.DefaultValue ? 'rt-cell-dirty' : ''}`}
                            onMouseDown={(e) => onRowMouseDown(e, rowIdx)}
                            onDoubleClick={() => !isDeleted && setEditCell({ rowIdx, field: 'DefaultValue' })}
                            title={col.DefaultValue || 'NULL'}
                        >
                            <span style={{ color: col.DefaultValue ? undefined : 'var(--text-muted)', opacity: col.DefaultValue ? 1 : 0.5 }}>
                                {col.DefaultValue || 'NULL'}
                            </span>
                        </div>
                    )}
                </td>
            </tr>

            {rowError && (
                <tr>
                    <td colSpan={6} style={{ padding: '2px 40px', background: 'color-mix(in srgb, var(--error-color) 10%, transparent)', color: 'var(--error-color)', fontSize: 10, borderBottom: '1px solid var(--border-color)' }}>
                        <strong style={{ marginRight: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Error</strong>
                        {rowError}
                    </td>
                </tr>
            )}
        </>
    );
};
