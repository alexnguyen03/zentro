import React from 'react';
import ReactDOM from 'react-dom';
import { cn } from '../../lib/cn';

interface ModalBackdropProps {
    /** Called when the backdrop itself is clicked. Pass undefined to disable click-to-close. */
    onClose?: () => void;
    children: React.ReactNode;
    /** Backdrop classes (z-index, tint, alignment, etc.) */
    className?: string;
    /** Optional inner wrapper classes. When provided, click on content will not close modal. */
    contentClassName?: string;
    closeOnBackdropClick?: boolean;
    closeOnEscape?: boolean;
    lockScroll?: boolean;
    layer?: 'overlay' | 'modal' | 'confirm';
}

/**
 * Standard modal backdrop for Zentro.
 * Always renders as a portal into document.body.
 *
 * Usage:
 * ```tsx
 * <ModalBackdrop onClose={handleClose} contentClassName="flex w-full items-center justify-center p-3">
 *   <div>...modal content...</div>
 * </ModalBackdrop>
 * ```
 */
export const ModalBackdrop: React.FC<ModalBackdropProps> = ({
    onClose,
    children,
    className,
    contentClassName,
    closeOnBackdropClick = true,
    closeOnEscape = true,
    lockScroll = true,
    layer = 'modal',
}) => {
    const layerClass = {
        overlay: 'z-overlay',
        modal: 'z-modal',
        confirm: 'z-modal-confirm',
    }[layer];
    const backdropClass = layer === 'confirm' ? 'bg-overlay-strong' : 'bg-overlay';

    React.useEffect(() => {
        if (!closeOnEscape || !onClose) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [closeOnEscape, onClose]);

    React.useEffect(() => {
        if (!lockScroll) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [lockScroll]);

    const handleBackdropClick = () => {
        if (!closeOnBackdropClick) return;
        onClose?.();
    };

    const content = contentClassName ? (
        <div className={contentClassName} onClick={(event) => event.stopPropagation()}>
            {children}
        </div>
    ) : (
        children
    );

    return ReactDOM.createPortal(
        <div
            className={cn(
                'fixed inset-0 flex items-center justify-center animate-in fade-in duration-150',
                backdropClass,
                layerClass,
                className
            )}
            onClick={handleBackdropClick}
        >
            {content}
        </div>,
        document.body
    );
};
