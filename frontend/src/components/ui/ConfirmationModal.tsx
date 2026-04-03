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

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
    message: string | React.ReactNode;
    confirmLabel?: string;
    description?: string;
    variant?: 'destructive' | 'default' | 'danger' | 'primary';
    closeOnConfirm?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title = 'Confirm Action',
    message,
    description,
    confirmLabel = 'Confirm',
    variant = 'default',
    closeOnConfirm = true,
}) => {
    const normalizedVariant = variant === 'danger' ? 'destructive' : variant === 'primary' ? 'default' : variant;

    return (
        <AlertDialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <AlertDialogContent className="max-w-[440px]">
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                        <div className="flex items-start gap-4 py-1">
                            <div className={cn('shrink-0 rounded-full p-2', normalizedVariant === 'destructive' ? 'bg-error/10' : 'bg-accent/10')}>
                                <AlertCircle size={24} className={normalizedVariant === 'destructive' ? 'text-error' : 'text-accent'} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="mb-1 text-[14px] font-bold text-foreground">{message}</p>
                                {description && (
                                    <p className="text-[12px] leading-relaxed text-muted-foreground">
                                        {description}
                                    </p>
                                )}
                            </div>
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={onClose} className="px-4">
                        Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                        className={cn('px-4', normalizedVariant === 'destructive' && 'bg-destructive text-destructive-foreground hover:bg-destructive/90')}
                        onClick={(event) => {
                            event.preventDefault();
                            onConfirm();
                            if (closeOnConfirm) {
                                onClose();
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
