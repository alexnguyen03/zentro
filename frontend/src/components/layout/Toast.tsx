import React, { createContext, useContext, useMemo } from 'react';
import { CheckCircle, AlertCircle, Info } from 'lucide-react';
import { cn } from '../../lib/cn';
import { toast as sonnerToast, Toaster, type ToasterProps } from 'sonner';

export type ToastVariant = 'success' | 'error' | 'info';

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
    const addToast = React.useCallback((message: string, variant: ToastVariant) => {
        const variantStyle = {
            success: { icon: 'text-success', Icon: CheckCircle },
            error: { icon: 'text-error', Icon: AlertCircle },
            info: { icon: 'text-accent', Icon: Info },
        }[variant];
        const Icon = variantStyle.Icon;

        sonnerToast(message, {
            icon: <Icon size={18} className={cn('mt-[1px] shrink-0', variantStyle.icon)} />,
            className: cn(
                'relative pointer-events-auto flex min-w-[280px] max-w-[520px] items-start gap-3 rounded-2xl border border-border/70 bg-card px-6 py-5 pr-12 text-[15px] shadow-elevation-md',
            ),
        });
    }, []);

    const toast = useMemo(() => ({
        success: (msg: string) => addToast(msg, 'success'),
        error: (msg: string) => addToast(msg, 'error'),
        info: (msg: string) => addToast(msg, 'info'),
    }), [addToast]);

    const position = placement as NonNullable<ToasterProps['position']>;

    return (
        <ToastContext.Provider value={{ toast }}>
            {children}
            <Toaster
                position={position}
                className="z-toast"
                visibleToasts={3}
                duration={4000}
                closeButton
                offset={{ top: 56, right: 16, bottom: 36, left: 16 }}
                toastOptions={{
                    classNames: {
                        title: 'flex-1 break-words pr-1 leading-[1.35] text-[15px] font-semibold text-foreground',
                        closeButton: 'absolute !left-auto !right-0 !top-3 !translate-x-0 !translate-y-0 p-2 !border-none text-muted-foreground hover:bg-muted hover:text-foreground',
                    },
                }}
            />
        </ToastContext.Provider>
    );
};
