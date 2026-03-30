import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

function Boom() {
    throw new Error('boom');
    return <></>;
}

describe('ErrorBoundary', () => {
    it('renders fallback UI when child throws', () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);

        render(
            <ErrorBoundary>
                <Boom />
            </ErrorBoundary>
        );

        expect(screen.getByText('Unexpected application error')).toBeInTheDocument();
        expect(screen.getByText(/boom/i)).toBeInTheDocument();
    });
});
