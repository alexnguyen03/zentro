import React from 'react';
import ReactDOM from 'react-dom';
import { cn } from '../../lib/cn';

interface ModalBackdropProps {
    /** Called when the backdrop itself is clicked. Pass undefined to disable click-to-close. */
    onClose?: () => void;
    children: React.ReactNode;
    className?: string;
}

/**
 * Standard modal backdrop for Zentro.
 * Always renders as a portal into document.body.
 *
 * Usage:
 * ```tsx
 * <ModalBackdrop onClose={handleClose}>
 *   <div onClick={e => e.stopPropagation()}>...modal content...</div>
 * </ModalBackdrop>
 * ```
 */
export const ModalBackdrop: React.FC<ModalBackdropProps> = ({ onClose, children, className }) => {
    return ReactDOM.createPortal(
        <div
            className={cn(
                'fixed inset-0 bg-black/40 z-9999 flex items-center justify-center animate-in fade-in duration-150',
                className
            )}
            onClick={onClose}
        >
            {children}
        </div>,
        document.body
    );
};
