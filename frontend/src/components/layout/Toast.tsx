import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { cn } from '../../lib/cn';

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
    const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    const dismiss = useCallback((id: string) => {
        clearTimeout(timers.current[id]);
        delete timers.current[id];
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const addToast = useCallback((message: string, variant: ToastVariant) => {
        const id = crypto.randomUUID();
        setToasts((prev) => {
            const next = [...prev, { id, message, variant }];
            return next.slice(-3); // max 3 visible
        });
        timers.current[id] = setTimeout(() => dismiss(id), 4000);
    }, [dismiss]);

    const toast = {
        success: (msg: string) => addToast(msg, 'success'),
        error: (msg: string) => addToast(msg, 'error'),
        info: (msg: string) => addToast(msg, 'info'),
    };

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
            {children}
            <div className={cn("fixed z-[9999] flex flex-col gap-2.5 pointer-events-none", placementClass)}>
                {toasts.map((t) => {
                    const style = variantStyles[t.variant];
                    return (
                        <div
                            key={t.id}
                            className={cn(
                                "flex items-start gap-2.5 py-3 px-4 rounded text-[13px] min-w-[250px] max-w-[400px] bg-bg-primary shadow-[0_4px_20px_rgba(0,0,0,0.25)] pointer-events-auto",
                                "border border-border border-l-4",
                                style.border,
                                "animate-in fade-in slide-in-from-bottom-3 duration-250 ease-[cubic-bezier(0.16,1,0.3,1)]"
                            )}
                            onMouseEnter={() => { clearTimeout(timers.current[t.id]); }}
                            onMouseLeave={() => { timers.current[t.id] = setTimeout(() => dismiss(t.id), 4000); }}
                        >
                            <span className={cn("flex shrink-0 mt-[2px]", style.icon)}>
                                <style.Icon size={15} />
                            </span>
                            <span className="flex-1 text-text-primary leading-normal break-words">
                                {t.message}
                            </span>
                            <button
                                className="bg-transparent border-none cursor-pointer text-text-secondary flex items-center p-1 -mr-1 -mt-1 rounded shrink-0 transition-colors duration-150 hover:text-text-primary hover:bg-bg-secondary"
                                onClick={() => dismiss(t.id)}
                            >
                                <X size={14} />
                            </button>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
};
