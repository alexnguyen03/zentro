import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Modal } from '../layout/Modal';
import { Button } from '../ui';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
    message: string | React.ReactNode;
    confirmLabel?: string;
    description?: string;
    variant?: 'danger' | 'primary';
    closeOnConfirm?: boolean;
}

/**
 * A reusable standard confirmation modal for destructive or important actions.
 */
export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title = "Confirm Action",
    message,
    description,
    confirmLabel = "Confirm",
    variant = 'primary',
    closeOnConfirm = true,
}) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            width={440}
            layer="confirm"
            footer={
                <>
                    <Button variant="ghost" onClick={onClose} className="px-4">
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        danger={variant === 'danger'}
                        onClick={() => {
                            onConfirm();
                            if (closeOnConfirm) {
                                onClose();
                            }
                        }}
                        autoFocus
                        className="px-4"
                    >
                        {confirmLabel}
                    </Button>
                </>
            }
        >
            <div className="flex items-start gap-4 py-2">
                <div className={`shrink-0 p-2 rounded-full ${variant === 'danger' ? 'bg-error/10' : 'bg-accent/10'}`}>
                    <AlertCircle size={24} className={variant === 'danger' ? 'text-error' : 'text-accent'} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold text-text-primary mb-1">{message}</p>
                    {description && (
                        <p className="text-[12px] leading-relaxed text-text-secondary">
                            {description}
                        </p>
                    )}
                </div>
            </div>
        </Modal>
    );
};
