import React from 'react';
import { cn } from '../../lib/cn';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../ui/dialog';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string | React.ReactNode;
    children: React.ReactNode;
    footer?: React.ReactNode;
    width?: string | number;
    className?: string;
    layer?: 'modal' | 'confirm';
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    footer,
    width = 600,
    className,
    layer: _layer = 'modal',
}) => {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent
                className={cn(
                    'max-h-[90vh] overflow-hidden rounded-md border border-border/30 bg-card p-0 text-card-foreground shadow-elevation-lg',
                    className,
                )}
                style={{ width, maxWidth: '90vw' }}
            >
                <DialogHeader className="shrink-0 border-b border-border/25 bg-card px-5 py-4">
                    <DialogTitle className="m-0 text-base font-semibold text-foreground">
                        {title}
                    </DialogTitle>
                </DialogHeader>
                <DialogDescription asChild>
                    <div className="flex-1 overflow-y-auto px-5 py-5 text-[13px] text-muted-foreground">
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
