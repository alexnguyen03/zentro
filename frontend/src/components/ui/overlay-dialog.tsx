import React from 'react';
import { cn } from '@/lib/cn';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './dialog';

interface OverlayDialogProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
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
    open = true,
    onOpenChange,
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
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                onOpenChange?.(nextOpen);
                if (!nextOpen) {
                    onClose?.();
                }
            }}
        >
            <DialogContent
                showCloseButton={false}
                overlayClassName={cn(layerClass, backdropClass)}
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
                    'inset-0 flex h-screen max-h-screen w-screen max-w-none translate-x-0 translate-y-0 items-center justify-center gap-0 rounded-none border-none bg-transparent p-0 shadow-none',
                    layerClass,
                    className,
                )}
            >
                <DialogTitle className="sr-only">{title}</DialogTitle>
                <DialogDescription className="sr-only">{description}</DialogDescription>
                {contentClassName ? <div className={contentClassName}>{children}</div> : children}
            </DialogContent>
        </Dialog>
    );
};
