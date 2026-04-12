import React, { useRef } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui';
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
    readOnlyMode?: boolean;
}

export const SchemaInfoView: React.FC<SchemaInfoViewProps> = ({
    rows, displayIds, types, editCell, setEditCell, onUpdate, onDiscard, rowErrors, selectedRows,
    onRowMouseDown, onRowMouseEnter, sortCol, sortDir, onSort, readOnlyMode = false
}) => {
    const tableContainerRef = useRef<HTMLDivElement>(null);

    const SortIcon = ({ col }: { col: SortCol }) => {
        if (sortCol !== col || !sortDir) return <ArrowUpDown size={11} className="ml-1 opacity-20" />;
        return sortDir === 'asc'
            ? <ArrowUp size={11} className="ml-1 text-success" />
            : <ArrowDown size={11} className="ml-1 text-success" />;
    };

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-background">
            <div className="flex-1 overflow-hidden flex flex-col">
                <div
                    ref={tableContainerRef}
                    className="flex-1 overflow-auto scrollbar-thin px-3"
                >
                    <Table
                        className="result-table-tanstack border-collapse table-fixed select-none"
                        style={{ width: '100%', minWidth: '100%' }}
                    >
                        <TableHeader className="[&_tr]:border-b-0">
                            <TableRow className="border-b-2 border-border hover:bg-transparent">
                                <TableHead className="rt-th w-10 font-mono text-[10px] text-muted-foreground">
                                    <div className="rt-th-label justify-center">#</div>
                                </TableHead>
                                <TableHead
                                    className="rt-th rt-th-sortable"
                                    onClick={() => onSort('Name')}
                                >
                                    <div className="rt-th-label">
                                        Name <SortIcon col="Name" />
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="rt-th rt-th-sortable"
                                    onClick={() => onSort('DataType')}
                                >
                                    <div className="rt-th-label">
                                        Data Type <SortIcon col="DataType" />
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="rt-th rt-th-sortable w-12"
                                    onClick={() => onSort('IsPrimaryKey')}
                                >
                                    <div className="rt-th-label justify-center">
                                        PK <SortIcon col="IsPrimaryKey" />
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="rt-th rt-th-sortable w-16"
                                    onClick={() => onSort('IsNullable')}
                                >
                                    <div className="rt-th-label justify-center">
                                        Null <SortIcon col="IsNullable" />
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="rt-th rt-th-sortable"
                                    onClick={() => onSort('DefaultValue')}
                                >
                                    <div className="rt-th-label">
                                        Default <SortIcon col="DefaultValue" />
                                    </div>
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-border/20 [&_tr:last-child]:border-b">
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
                                        readOnlyMode={readOnlyMode}
                                    />
                                );
                            })}
                            {rows.length === 0 && (
                                <TableRow className="hover:bg-transparent">
                                    <TableCell colSpan={6} className="py-24 text-center text-muted-foreground italic bg-background/50 text-sm">
                                        No columns found for this table.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
};
