import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ResultTable } from './ResultTable';

vi.mock('../../services/queryService', () => ({
    FetchMoreRows: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../stores/resultStore', () => ({
    useResultStore: () => ({
        results: {},
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

vi.mock('../../stores/connectionStore', () => ({
    useConnectionStore: (selector: (state: { activeProfile: { driver: string } }) => unknown) =>
        selector({ activeProfile: { driver: 'postgres' } }),
}));

describe('ResultTable', () => {
    it('renders compact data type on header and sticky index column', () => {
        const onHeaderFilterRun = vi.fn();
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
                draftRows={[]}
                setDraftRows={vi.fn()}
                columnDefs={[
                    { Name: 'id', DataType: 'integer' },
                    { Name: 'name', DataType: 'character varying' },
                ] as any}
                focusCellRequest={null}
                onFocusCellRequestHandled={vi.fn()}
                onRemoveDraftRows={vi.fn()}
                onHeaderFilterRun={onHeaderFilterRun}
                onViewStatsChange={vi.fn()}
            />,
        );

        expect(screen.getByText('varchar')).toBeInTheDocument();
        const indexHeader = screen.getByText('#').closest('th');
        expect(indexHeader?.className).toContain('rt-index-sticky');

        const filterButtons = screen.getAllByTitle('Filter this column');
        fireEvent.click(filterButtons[0]);
        const input = screen.getByPlaceholderText('Contains in id');
        fireEvent.change(input, { target: { value: '12' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        expect(onHeaderFilterRun).toHaveBeenCalled();

        fireEvent.click(filterButtons[0]);
        const reopenInput = screen.getByPlaceholderText('Contains in id');
        fireEvent.change(reopenInput, { target: { value: 'abc' } });
        fireEvent.keyDown(reopenInput, { key: 'Escape' });
        expect(onHeaderFilterRun).toHaveBeenCalledTimes(2);
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
                draftRows={[]}
                setDraftRows={vi.fn()}
                columnDefs={[
                    { Name: 'id', DataType: 'integer' },
                    { Name: 'name', DataType: 'character varying' },
                ] as any}
                focusCellRequest={null}
                onFocusCellRequestHandled={vi.fn()}
                onRemoveDraftRows={vi.fn()}
                onHeaderFilterRun={vi.fn()}
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
});
