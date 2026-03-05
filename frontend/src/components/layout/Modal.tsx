import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    width?: string | number;
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    footer,
    width = 600
}) => {
    if (!isOpen) return null;

    return (
        <div className="dialog-overlay" onClick={onClose}>
            <div
                className="dialog-content"
                style={{ width, maxWidth: '90vw' }}
                onClick={e => e.stopPropagation()}
            >
                <div className="dialog-header">
                    <h2>{title}</h2>
                    <button className="dialog-close" onClick={onClose} title="Close">
                        <X size={18} />
                    </button>
                </div>
                <div className="dialog-body" style={{ paddingBottom: footer ? 0 : undefined }}>
                    {children}
                </div>
                {footer && (
                    <div className="dialog-footer">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};
