import React from 'react';
import { AlertCircle } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from './alert-dialog';
import { cn } from '../../lib/cn';
import { buttonVariants } from './button';

interface ConfirmationModalProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    isOpen?: boolean;
    onClose?: () => void;
    onConfirm: () => void;
    title?: string;
    message: string | React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    description?: string;
    variant?: 'destructive' | 'default';
    closeOnConfirm?: boolean;
    confirmClassName?: string;
    cancelClassName?: string;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    open,
    onOpenChange,
    isOpen = false,
    onClose,
    onConfirm,
    title = 'Confirm Action',
    message,
    description,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'default',
    closeOnConfirm = true,
    confirmClassName,
    cancelClassName,
}) => {
    const resolvedOpen = open ?? isOpen;

    const setOpen = (nextOpen: boolean) => {
        onOpenChange?.(nextOpen);
        if (!nextOpen) {
            onClose?.();
        }
    };

    return (
        <AlertDialog open={resolvedOpen} onOpenChange={setOpen}>
            <AlertDialogContent className="max-w-[440px]">
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                        <div className="flex items-start gap-4 py-1">
                            <div className={cn('shrink-0 rounded-full p-2', variant === 'destructive' ? 'bg-destructive/10' : 'bg-accent/10')}>
                                <AlertCircle size={24} className={variant === 'destructive' ? 'text-destructive' : 'text-accent-foreground'} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="mb-1 text-body  text-foreground">{message}</p>
                                {description && (
                                    <p className="text-small leading-relaxed text-muted-foreground">
                                        {description}
                                    </p>
                                )}
                            </div>
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setOpen(false)} className={cn('px-4', cancelClassName)}>
                        {cancelLabel}
                    </AlertDialogCancel>
                    <AlertDialogAction
                        className={cn(
                            buttonVariants({ variant: variant === 'destructive' ? 'destructive' : 'default' }),
                            'px-4',
                            confirmClassName,
                        )}
                        onClick={(event) => {
                            if (!closeOnConfirm) {
                                event.preventDefault();
                            }
                            onConfirm();
                            if (closeOnConfirm) {
                                setOpen(false);
                            }
                        }}
                    >
                        {confirmLabel}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};
