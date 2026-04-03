import React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
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
        if (!lockScroll) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [lockScroll]);

    const content = contentClassName ? (
        <div className={contentClassName}>
            {children}
        </div>
    ) : (
        children
    );

    return (
        <DialogPrimitive.Root
            open
            onOpenChange={(open) => {
                if (!open) {
                    onClose?.();
                }
            }}
        >
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay
                    className={cn(
                        'fixed inset-0 animate-in fade-in duration-150 modal-backdrop-fade-in',
                        backdropClass,
                        layerClass,
                    )}
                />
                <DialogPrimitive.Content
                    aria-label="Overlay"
                    onEscapeKeyDown={(event) => {
                        if (!closeOnEscape) {
                            event.preventDefault();
                        }
                    }}
                    onPointerDownOutside={(event) => {
                        if (!closeOnBackdropClick) {
                            event.preventDefault();
                        }
                    }}
                    className={cn(
                        'fixed inset-0 flex items-center justify-center outline-none',
                        layerClass,
                        className,
                    )}
                >
                    {content}
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
};
