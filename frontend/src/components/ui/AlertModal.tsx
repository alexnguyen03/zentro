import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Modal } from '../layout/Modal';
import { Button } from './Button';

interface AlertModalProps {
    isOpen: boolean;
    title?: string;
    message: string;
    onClose: () => void;
    closeLabel?: string;
}

export const AlertModal: React.FC<AlertModalProps> = ({
    isOpen,
    title = 'Notice',
    message,
    onClose,
    closeLabel = 'OK',
}) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            width={420}
            layer="confirm"
            footer={
                <Button variant="primary" autoFocus onClick={onClose} className="px-4">
                    {closeLabel}
                </Button>
            }
        >
            <div className="flex items-start gap-3 py-1">
                <span className="mt-0.5 rounded-full bg-warning/15 p-2 text-warning">
                    <AlertCircle size={18} />
                </span>
                <p className="text-[13px] leading-relaxed text-text-primary">{message}</p>
            </div>
        </Modal>
    );
};
