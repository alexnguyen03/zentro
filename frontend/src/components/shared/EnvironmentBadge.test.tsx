import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EnvironmentBadge } from './EnvironmentBadge';

describe('EnvironmentBadge', () => {
    it('renders filled pill with mapped environment class', () => {
        render(<EnvironmentBadge label="DEV" />);
        const badge = screen.getByText('DEV');

        expect(badge).toHaveClass('inline-flex');
        expect(badge).toHaveClass('env-badge-dev');
        expect(badge).toHaveClass('rounded-sm');
    });

    it('maps TES shorthand to testing badge class', () => {
        render(<EnvironmentBadge label="TES" />);
        expect(screen.getByText('TES')).toHaveClass('env-badge-tes');
    });

    it('keeps original label text without transform', () => {
        render(<EnvironmentBadge label="dev" />);
        expect(screen.getByText('dev')).toBeInTheDocument();
    });

    it('falls back to provided tone class for unknown label', () => {
        render(
            <EnvironmentBadge
                label="custom"
                toneClassName="bg-error/11 text-error"
                className="ring-1"
            />,
        );
        const badge = screen.getByText('custom');

        expect(badge).toHaveClass('text-error');
        expect(badge).toHaveClass('bg-error/11');
        expect(badge).toHaveClass('ring-1');
    });
});

