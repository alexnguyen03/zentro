import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ObjectQuickViewPanel } from './ObjectQuickViewPanel';

const sampleColumns = [
    {
        Name: 'account_id',
        DataType: 'integer',
        IsPrimaryKey: true,
    },
    {
        Name: 'email',
        DataType: 'text',
        IsPrimaryKey: false,
    },
] as any;

describe('ObjectQuickViewPanel', () => {
    it('renders loading state', () => {
        render(<ObjectQuickViewPanel title="Table - public.accounts" loading />);

        expect(screen.getByText('Loading object info...')).toBeInTheDocument();
        expect(screen.queryByText(/columns$/)).not.toBeInTheDocument();
    });

    it('renders message state', () => {
        render(<ObjectQuickViewPanel title="Table - public.accounts" message="No permissions" />);

        expect(screen.getByText('No permissions')).toBeInTheDocument();
    });

    it('renders empty state when there are no columns', () => {
        render(<ObjectQuickViewPanel title="Table - public.accounts" columns={[]} />);

        expect(screen.getByText('No columns found.')).toBeInTheDocument();
    });

    it('renders table data and column count', () => {
        render(<ObjectQuickViewPanel title="Table - public.accounts" columns={sampleColumns} />);

        expect(screen.getByText('2 columns')).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
        expect(screen.getByText('account_id')).toBeInTheDocument();
        expect(screen.getByText('email')).toBeInTheDocument();
        expect(screen.getAllByText('PK').length).toBeGreaterThan(1);
    });

    it('calls onOpenDefinition when title button is clicked', () => {
        const onOpenDefinition = vi.fn();
        render(
            <ObjectQuickViewPanel
                title="Table - public.accounts"
                columns={sampleColumns}
                onOpenDefinition={onOpenDefinition}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Table - public.accounts' }));

        expect(onOpenDefinition).toHaveBeenCalledTimes(1);
    });
});
