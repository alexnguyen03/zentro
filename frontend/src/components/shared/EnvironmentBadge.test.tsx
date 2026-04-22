import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EnvironmentBadge } from './EnvironmentBadge';

describe('EnvironmentBadge', () => {
    it('renders compact base classes and label', () => {
        render(<EnvironmentBadge label="DEV" />);
        const badge = screen.getByText('DEV');

        expect(badge).toHaveClass('inline-flex');
        expect(badge).toHaveClass('text-label');
        expect(badge).toHaveClass('uppercase');
        expect(badge).toHaveClass('rounded-sm');
    });

    it('merges tone and custom classes', () => {
        render(
            <EnvironmentBadge
                label="PRO"
                toneClassName="text-error border-error/45 bg-error/11"
                className="ring-1"
            />,
        );
        const badge = screen.getByText('PRO');

        expect(badge).toHaveClass('text-error');
        expect(badge).toHaveClass('border-error/45');
        expect(badge).toHaveClass('bg-error/11');
        expect(badge).toHaveClass('ring-1');
    });
});

