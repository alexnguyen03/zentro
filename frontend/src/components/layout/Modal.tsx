import React from 'react';
import { cn } from '../../lib/cn';

import { ModalBackdrop, ModalFrame } from '../ui';

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
    layer = 'modal',
}) => {
    if (!isOpen) return null;

    return (
        <ModalBackdrop
            onClose={onClose}
            layer={layer}
            contentClassName="flex w-full items-center justify-center p-3"
        >
            <ModalFrame
                title={title}
                onClose={onClose}
                footer={footer}
                style={{ width, maxWidth: '90vw' }}
                className={cn(
                    'w-full max-h-[90vh] rounded-xl border border-border/30 shadow-elevation-lg',
                    className,
                )}
                headerClassName="shrink-0 border-b border-border/25 bg-bg-secondary px-5 py-4"
                titleClassName="m-0 text-base font-semibold text-text-primary"
                bodyClassName="flex-1 overflow-y-auto p-5 text-[13px] text-text-secondary"
                footerClassName="shrink-0 border-t border-border/25 bg-bg-secondary px-5 py-4 flex justify-end gap-3"
            >
                {children}
            </ModalFrame>
        </ModalBackdrop>
    );
};
