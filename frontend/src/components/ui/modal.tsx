import React from 'react';
import { cn } from '@/lib/cn';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from './dialog';

interface ModalProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    isOpen?: boolean;
    onClose?: () => void;
    title: string | React.ReactNode;
    children: React.ReactNode;
    footer?: React.ReactNode;
    width?: string | number;
    className?: string;
    layer?: 'modal' | 'confirm';
}

export const Modal: React.FC<ModalProps> = ({
    open,
    onOpenChange,
    isOpen = false,
    onClose,
    title,
    children,
    footer,
    width = 600,
    className,
    layer = 'modal',
}) => {
    const resolvedOpen = open ?? isOpen;
    const isConfirmLayer = layer === 'confirm';

    return (
        <Dialog
            open={resolvedOpen}
            onOpenChange={(nextOpen) => {
                onOpenChange?.(nextOpen);
                if (!nextOpen) {
                    onClose?.();
                }
            }}
        >
            <DialogContent
                overlayClassName={isConfirmLayer ? 'z-modal-confirm bg-overlay-strong' : 'z-modal bg-overlay'}
                className={cn(
                    'max-h-[90vh] overflow-hidden rounded-sm border border-border/30 bg-card p-0 text-card-foreground shadow-elevation-lg',
                    isConfirmLayer ? 'z-modal-confirm' : 'z-modal',
                    className,
                )}
                style={{ width, maxWidth: '90vw' }}
            >
                <DialogHeader className="shrink-0 border-b border-border/25 bg-card px-5 py-4">
                    <DialogTitle className="m-0 text-body font-semibold text-foreground">
                        {title}
                    </DialogTitle>
                </DialogHeader>
                <DialogDescription asChild>
                    <div className="flex-1 overflow-y-auto px-5 py-5 text-small text-muted-foreground">
                        {children}
                    </div>
                </DialogDescription>
                {footer && (
                    <DialogFooter className="shrink-0 border-t border-border/25 bg-card px-5 py-4">
                        {footer}
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
};
