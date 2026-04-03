import React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '../../lib/cn';

interface OverlayDialogProps {
    onClose?: () => void;
    children: React.ReactNode;
    className?: string;
    contentClassName?: string;
    title?: string;
    description?: string;
    closeOnBackdropClick?: boolean;
    closeOnEscape?: boolean;
    lockScroll?: boolean;
    layer?: 'overlay' | 'modal' | 'confirm';
}

export const OverlayDialog: React.FC<OverlayDialogProps> = ({
    onClose,
    children,
    className,
    contentClassName,
    title = 'Overlay Dialog',
    description = 'Overlay content',
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

    return (
        <DialogPrimitive.Root
            open
            onOpenChange={(open) => {
                if (!open) onClose?.();
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
                    onEscapeKeyDown={(event) => {
                        if (!closeOnEscape) event.preventDefault();
                    }}
                    onPointerDownOutside={(event) => {
                        if (!closeOnBackdropClick) event.preventDefault();
                    }}
                    className={cn(
                        'fixed inset-0 flex items-center justify-center outline-none',
                        layerClass,
                        className,
                    )}
                >
                    <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
                    <DialogPrimitive.Description className="sr-only">{description}</DialogPrimitive.Description>
                    {contentClassName ? <div className={contentClassName}>{children}</div> : children}
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
};
