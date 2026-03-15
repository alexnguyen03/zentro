import React from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { ColumnRow } from './ColumnRow';
import { RowState, SortCol, SortDir } from './types';
import { models } from '../../../../wailsjs/go/models';

interface SchemaInfoViewProps {
    rows: RowState[];
    displayIds: string[];
    types: string[];
    editCell: { rowIdx: number; field: 'Name' | 'DefaultValue' } | null;
    setEditCell: React.Dispatch<React.SetStateAction<{ rowIdx: number; field: 'Name' | 'DefaultValue' } | null>>;
    onUpdate: (rowIdx: number, patch: Partial<models.ColumnDef>) => void;
    onDiscard: (rowIdx: number) => void;
    rowErrors: Record<number, string>;
    selectedRows: Set<number>;
    onRowMouseDown: (e: React.MouseEvent, idx: number) => void;
    onRowMouseEnter: (idx: number) => void;
    sortCol: SortCol;
    sortDir: SortDir;
    onSort: (col: SortCol) => void;
    filterText: string;
    onFilterChange: (text: string) => void;
    filterInputRef: React.RefObject<HTMLInputElement>;
}

const COL_SIZES = {
    idx:     52,
    name:    undefined, // flex
    type:    180,
    pk:      52,
    null:    64,
    default: 200,
};

export const SchemaInfoView: React.FC<SchemaInfoViewProps> = ({
    rows, displayIds, types, editCell, setEditCell, onUpdate, onDiscard,
    rowErrors, selectedRows, onRowMouseDown, onRowMouseEnter,
    sortCol, sortDir, onSort,
}) => {
    const SortIcon = ({ col }: { col: SortCol }) => {
        if (sortCol !== col || !sortDir) return null;
        return sortDir === 'asc'
            ? <ArrowUp size={11} className="rt-sort-icon" />
            : <ArrowDown size={11} className="rt-sort-icon" />;
    };

    const thCls = (col: SortCol) =>
        `rt-th rt-th-sortable ${sortCol === col && sortDir ? 'rt-th-sorted' : ''}`;

    return (
        <div className="result-virtual-scroll">
            <table className="result-table-tanstack" style={{ tableLayout: 'fixed', width: '100%' }}>
                <thead>
                    <tr>
                        {/* # */}
                        <th className="rt-th" style={{ width: COL_SIZES.idx }}>
                            <span className="rt-th-label">#</span>
                        </th>
                        {/* Name */}
                        <th className={thCls('Name')} onClick={() => onSort('Name')}>
                            <span className="rt-th-label">
                                Name <SortIcon col="Name" />
                            </span>
                        </th>
                        {/* Data Type */}
                        <th className={thCls('DataType')} style={{ width: COL_SIZES.type }} onClick={() => onSort('DataType')}>
                            <span className="rt-th-label">
                                Data Type <SortIcon col="DataType" />
                            </span>
                        </th>
                        {/* PK */}
                        <th className={thCls('IsPrimaryKey')} style={{ width: COL_SIZES.pk }} onClick={() => onSort('IsPrimaryKey')}>
                            <span className="rt-th-label" style={{ justifyContent: 'center' }}>
                                PK <SortIcon col="IsPrimaryKey" />
                            </span>
                        </th>
                        {/* Null */}
                        <th className={thCls('IsNullable')} style={{ width: COL_SIZES.null }} onClick={() => onSort('IsNullable')}>
                            <span className="rt-th-label" style={{ justifyContent: 'center' }}>
                                Null <SortIcon col="IsNullable" />
                            </span>
                        </th>
                        {/* Default */}
                        <th className={thCls('DefaultValue')} style={{ width: COL_SIZES.default }} onClick={() => onSort('DefaultValue')}>
                            <span className="rt-th-label">
                                Default <SortIcon col="DefaultValue" />
                            </span>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {displayIds.map((id, displayIdx) => {
                        const rowIdx = rows.findIndex(r => r.id === id);
                        const row = rows[rowIdx];
                        if (!row) return null;
                        return (
                            <ColumnRow
                                key={id}
                                row={row}
                                rowIdx={rowIdx}
                                displayIdx={displayIdx}
                                types={types}
                                editCell={editCell}
                                setEditCell={setEditCell}
                                onUpdate={onUpdate}
                                onDiscard={onDiscard}
                                rowError={rowErrors[rowIdx]}
                                isSelected={selectedRows.has(rowIdx)}
                                onRowMouseDown={onRowMouseDown}
                                onRowMouseEnter={onRowMouseEnter}
                            />
                        );
                    })}
                    {displayIds.length === 0 && (
                        <tr>
                            <td
                                colSpan={6}
                                style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontSize: 12, fontStyle: 'italic' }}
                            >
                                No columns found.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};
