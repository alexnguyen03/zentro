import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';

describe('Modal', () => {
    it('renders title and content', () => {
        render(
            <Modal isOpen onClose={() => undefined} title="Modal Title">
                <div>Modal content</div>
            </Modal>,
        );

        expect(screen.getByText('Modal Title')).toBeInTheDocument();
        expect(screen.getByText('Modal content')).toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', () => {
        const onClose = vi.fn();
        render(
            <Modal isOpen onClose={onClose} title="Closable">
                <div>Body</div>
            </Modal>,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Close' }));
        expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when Escape is pressed', () => {
        const onClose = vi.fn();
        render(
            <Modal isOpen onClose={onClose} title="Closable">
                <div>Body</div>
            </Modal>,
        );

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalled();
    });
});
