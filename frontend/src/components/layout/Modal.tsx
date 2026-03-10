import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string | React.ReactNode;
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-modal backdrop-blur-sm animate-in fade-in duration-150" onClick={onClose}>
            <div
                className="bg-bg-secondary border border-border rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col max-h-[90vh] overflow-hidden"
                style={{ width, maxWidth: '90vw' }}
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0 bg-bg-secondary">
                    <h2 className="m-0 text-base font-semibold text-text-primary">{title}</h2>
                    <button className="bg-transparent border-none text-text-secondary cursor-pointer p-1 rounded transition-colors hover:text-text-primary hover:bg-bg-tertiary flex items-center justify-center" onClick={onClose} title="Close">
                        <X size={18} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-5 text-[13px] text-text-secondary" style={{ paddingBottom: footer ? 0 : undefined }}>
                    {children}
                </div>
                {footer && (
                    <div className="shrink-0 px-5 py-4 border-t border-border bg-bg-secondary flex justify-end gap-3 mt-4">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};
