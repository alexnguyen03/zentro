import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OverlayDialog } from '../ui/overlay-dialog';

describe('OverlayDialog', () => {
    it('renders overlay content', () => {
        render(
            <OverlayDialog onClose={() => undefined}>
                <div>Overlay body</div>
            </OverlayDialog>,
        );

        expect(screen.getByText('Overlay body')).toBeInTheDocument();
    });

    it('closes on Escape by default', () => {
        const onClose = vi.fn();
        render(
            <OverlayDialog onClose={onClose}>
                <button type="button">Focusable</button>
            </OverlayDialog>,
        );

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalled();
    });

    it('can disable Escape close', () => {
        const onClose = vi.fn();
        render(
            <OverlayDialog onClose={onClose} closeOnEscape={false}>
                <button type="button">Focusable</button>
            </OverlayDialog>,
        );

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).not.toHaveBeenCalled();
    });
});
