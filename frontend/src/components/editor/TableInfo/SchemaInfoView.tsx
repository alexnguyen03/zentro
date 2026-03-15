import React, { useRef } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
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

export const SchemaInfoView: React.FC<SchemaInfoViewProps> = ({
    rows, displayIds, types, editCell, setEditCell, onUpdate, onDiscard, rowErrors, selectedRows,
    onRowMouseDown, onRowMouseEnter, sortCol, sortDir, onSort
}) => {
    const tableContainerRef = useRef<HTMLDivElement>(null);

    const SortIcon = ({ col }: { col: SortCol }) => {
        if (sortCol !== col || !sortDir) return <ArrowUpDown size={11} className="ml-1.5 opacity-20" />;
        return sortDir === 'asc'
            ? <ArrowUp size={11} className="ml-1.5 text-accent" />
            : <ArrowDown size={11} className="ml-1.5 text-accent" />;
    };

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-bg-primary">
            <div className="flex-1 overflow-hidden flex flex-col">
                <div
                    ref={tableContainerRef}
                    className="flex-1 overflow-auto scrollbar-thin"
                >
                    <table className="w-full border-collapse table-fixed select-none">
                        <thead className="sticky top-0 z-10 bg-bg-secondary/95 backdrop-blur-md">
                            <tr className="border-b border-border/40">
                                <th className="w-10 h-8 text-[10px] text-text-muted font-bold text-center border-r border-border/20">#</th>
                                <th
                                    className="px-3 h-8 text-left text-[11px] font-semibold text-text-secondary cursor-pointer hover:text-text-primary transition-colors border-r border-border/20"
                                    onClick={() => onSort('Name')}
                                >
                                    <div className="flex items-center">Name <SortIcon col="Name" /></div>
                                </th>
                                <th
                                    className="px-3 h-8 text-left text-[11px] font-semibold text-text-secondary cursor-pointer hover:text-text-primary transition-colors border-r border-border/20"
                                    onClick={() => onSort('DataType')}
                                >
                                    <div className="flex items-center">Data Type <SortIcon col="DataType" /></div>
                                </th>
                                <th
                                    className="w-12 h-8 text-center text-[11px] font-semibold text-text-secondary cursor-pointer hover:text-text-primary transition-colors border-r border-border/20"
                                    onClick={() => onSort('IsPrimaryKey')}
                                >
                                    <div className="flex items-center justify-center">PK <SortIcon col="IsPrimaryKey" /></div>
                                </th>
                                <th
                                    className="w-16 h-8 text-center text-[11px] font-semibold text-text-secondary cursor-pointer hover:text-text-primary transition-colors border-r border-border/20"
                                    onClick={() => onSort('IsNullable')}
                                >
                                    <div className="flex items-center justify-center">Null <SortIcon col="IsNullable" /></div>
                                </th>
                                <th
                                    className="px-3 h-8 text-left text-[11px] font-semibold text-text-secondary cursor-pointer hover:text-text-primary transition-colors border-r border-border/20"
                                    onClick={() => onSort('DefaultValue')}
                                >
                                    <div className="flex items-center">Default <SortIcon col="DefaultValue" /></div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20">
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
                            {rows.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="py-24 text-center text-text-muted italic bg-bg-primary/50 text-sm">
                                        No columns found for this table.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

