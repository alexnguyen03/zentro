import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { cn } from '../../lib/cn';
import {
    Toast as ShadcnToast,
    ToastClose,
    ToastDescription,
    ToastProvider as ShadcnToastProvider,
    ToastViewport,
} from '../ui/toast';

export type ToastVariant = 'success' | 'error' | 'info';

interface ToastItem {
    id: string;
    message: string;
    variant: ToastVariant;
}

interface ToastContextValue {
    toast: {
        success: (msg: string) => void;
        error: (msg: string) => void;
        info: (msg: string) => void;
    };
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used inside ToastProvider');
    return ctx;
};

export type ToastPlacement =
    | 'top-left' | 'top-center' | 'top-right'
    | 'bottom-left' | 'bottom-center' | 'bottom-right';

interface ToastProviderProps {
    children: React.ReactNode;
    placement?: ToastPlacement;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children, placement = 'bottom-left' }) => {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const dismiss = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const addToast = useCallback((message: string, variant: ToastVariant) => {
        const id = crypto.randomUUID();
        setToasts((prev) => {
            const next = [...prev, { id, message, variant }];
            return next.slice(-3);
        });
    }, []);

    const toast = useMemo(() => ({
        success: (msg: string) => addToast(msg, 'success'),
        error: (msg: string) => addToast(msg, 'error'),
        info: (msg: string) => addToast(msg, 'info'),
    }), [addToast]);

    const placementClass = {
        'bottom-left': 'bottom-9 left-4',
        'bottom-right': 'bottom-9 right-4',
        'bottom-center': 'bottom-9 left-1/2 -translate-x-1/2',
        'top-left': 'top-14 left-4',
        'top-right': 'top-14 right-4',
        'top-center': 'top-14 left-1/2 -translate-x-1/2',
    }[placement];

    const variantStyles = {
        success: { border: 'border-l-success', icon: 'text-success', Icon: CheckCircle },
        error: { border: 'border-l-error', icon: 'text-error', Icon: AlertCircle },
        info: { border: 'border-l-accent', icon: 'text-accent', Icon: Info },
    };

    return (
        <ToastContext.Provider value={{ toast }}>
            <ShadcnToastProvider duration={4000}>
                {children}
                {toasts.map((t) => {
                    const style = variantStyles[t.variant];
                    const Icon = style.Icon;
                    return (
                        <ShadcnToast
                            key={t.id}
                            open
                            onOpenChange={(open) => {
                                if (!open) dismiss(t.id);
                            }}
                            className={cn(
                                style.border,
                            )}
                        >
                            <span className={cn('mt-[2px] flex shrink-0', style.icon)}>
                                <Icon size={15} />
                            </span>
                            <ToastDescription>
                                {t.message}
                            </ToastDescription>
                            <ToastClose aria-label="Close">
                                <X size={14} />
                            </ToastClose>
                        </ShadcnToast>
                    );
                })}
                <ToastViewport className={placementClass} />
            </ShadcnToastProvider>
        </ToastContext.Provider>
    );
};
