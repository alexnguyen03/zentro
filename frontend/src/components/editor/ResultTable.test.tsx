import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ResultTable } from './ResultTable';

vi.mock('../../services/queryService', () => ({
    FetchMoreRows: vi.fn().mockResolvedValue(undefined),
}));

const mockResults: Record<string, unknown> = {};

vi.mock('../../stores/resultStore', () => ({
    useResultStore: () => ({
        results: mockResults,
        setOffset: vi.fn(),
    }),
}));

vi.mock('../layout/Toast', () => ({
    useToast: () => ({
        toast: {
            error: vi.fn(),
        },
    }),
}));

vi.mock('@tanstack/react-virtual', () => ({
    useVirtualizer: ({ count }: { count: number }) => ({
        getVirtualItems: () => Array.from({ length: count }, (_, index) => ({
            index,
            key: index,
            start: index * 22,
            end: (index + 1) * 22,
            size: 22,
        })),
        getTotalSize: () => count * 22,
        scrollToIndex: vi.fn(),
    }),
}));

describe('ResultTable', () => {
    it('renders compact data type on header and sticky index column', () => {
        render(
            <ResultTable
                tabId="tab-1"
                columns={['id', 'name']}
                rows={[['1', 'Alice'], ['2', 'Bob']]}
                isDone={true}
                editedCells={new Map()}
                setEditedCells={vi.fn()}
                selectedCells={new Set()}
                setSelectedCells={vi.fn()}
                selectedRowKeys={new Set()}
                setSelectedRowKeys={vi.fn()}
                draftRows={[]}
                setDraftRows={vi.fn()}
                columnDefs={[
                    { Name: 'id', DataType: 'integer' },
                    { Name: 'name', DataType: 'character varying' },
                ] as any}
                focusCellRequest={null}
                onFocusCellRequestHandled={vi.fn()}
                onRemoveDraftRows={vi.fn()}
                onViewStatsChange={vi.fn()}
            />,
        );

        expect(screen.getByText('varchar')).toBeInTheDocument();
        const readonlyIndicator = screen.getByTitle('Read-only (No Primary Key or missing PK in SELECT)');
        const indexHeader = readonlyIndicator.closest('th');
        expect(indexHeader?.className).toContain('rt-index-sticky');
    });

    it('auto-fits column width when double-clicking resize handle', () => {
        const longText = 'customer_name_with_very_long_value_to_expand_column_width';
        const { container } = render(
            <ResultTable
                tabId="tab-2"
                columns={['id', 'name']}
                rows={[['1', longText], ['2', 'Bob']]}
                isDone={true}
                editedCells={new Map()}
                setEditedCells={vi.fn()}
                selectedCells={new Set()}
                setSelectedCells={vi.fn()}
                selectedRowKeys={new Set()}
                setSelectedRowKeys={vi.fn()}
                draftRows={[]}
                setDraftRows={vi.fn()}
                columnDefs={[
                    { Name: 'id', DataType: 'integer' },
                    { Name: 'name', DataType: 'character varying' },
                ] as any}
                focusCellRequest={null}
                onFocusCellRequestHandled={vi.fn()}
                onRemoveDraftRows={vi.fn()}
                onViewStatsChange={vi.fn()}
            />,
        );

        const nameHeader = screen.getByText('name').closest('th') as HTMLTableCellElement;
        expect(nameHeader).toBeTruthy();
        const initialWidth = Number.parseInt(nameHeader.style.width || '0', 10);

        const resizer = nameHeader.querySelector('.rt-col-resizer') as HTMLElement;
        expect(resizer).toBeTruthy();
        fireEvent.doubleClick(resizer);

        const updatedHeader = container.querySelectorAll('th')[2] as HTMLTableCellElement;
        const nextWidth = Number.parseInt(updatedHeader.style.width || '0', 10);
        expect(nextWidth).toBeGreaterThan(initialWidth);
    });

    it('emits cell context menu payload and selects right-clicked cell', () => {
        const onCellContextMenu = vi.fn();
        const setSelectedCells = vi.fn();

        render(
            <ResultTable
                tabId="tab-ctx"
                columns={['id', 'name']}
                rows={[['1', 'Alice']]}
                isDone={true}
                editedCells={new Map()}
                setEditedCells={vi.fn()}
                selectedCells={new Set()}
                setSelectedCells={setSelectedCells}
                selectedRowKeys={new Set()}
                setSelectedRowKeys={vi.fn()}
                draftRows={[]}
                setDraftRows={vi.fn()}
                columnDefs={[
                    { Name: 'id', DataType: 'integer' },
                    { Name: 'name', DataType: 'character varying' },
                ] as any}
                focusCellRequest={null}
                onFocusCellRequestHandled={vi.fn()}
                onRemoveDraftRows={vi.fn()}
                onViewStatsChange={vi.fn()}
                onCellContextMenu={onCellContextMenu}
            />,
        );

        fireEvent.contextMenu(screen.getByText('Alice'), { clientX: 220, clientY: 140 });

        expect(setSelectedCells).toHaveBeenCalledWith(new Set(['p:0|1']));
        expect(onCellContextMenu).toHaveBeenCalledWith(expect.objectContaining({
            x: 220,
            y: 140,
            rowKey: 'p:0',
            colIdx: 1,
            cellId: 'p:0|1',
        }));
    });

    it('disables client-side sorting when server ORDER BY is active', () => {
        mockResults['tab-order'] = {
            hasMore: false,
            orderByExpr: 'id DESC',
        };

        render(
            <ResultTable
                tabId="tab-order"
                columns={['id', 'name']}
                rows={[['2', 'Bob'], ['1', 'Alice']]}
                isDone={true}
                editedCells={new Map()}
                setEditedCells={vi.fn()}
                selectedCells={new Set()}
                setSelectedCells={vi.fn()}
                selectedRowKeys={new Set()}
                setSelectedRowKeys={vi.fn()}
                draftRows={[]}
                setDraftRows={vi.fn()}
                columnDefs={[
                    { Name: 'id', DataType: 'integer' },
                    { Name: 'name', DataType: 'character varying' },
                ] as any}
                focusCellRequest={null}
                onFocusCellRequestHandled={vi.fn()}
                onRemoveDraftRows={vi.fn()}
                onViewStatsChange={vi.fn()}
            />,
        );

        const idHeader = screen.getByText('id').closest('th');
        expect(idHeader?.className).not.toContain('rt-th-sortable');

        delete mockResults['tab-order'];
    });
});
