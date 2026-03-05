import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import './Toast.css';

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

    return (
        <ToastContext.Provider value={{ toast }}>
            {children}
            <div className={`toast-container toast-${placement}`}>
                {toasts.map((t) => (
                    <div
                        key={t.id}
                        className={`toast toast-${t.variant}`}
                        onMouseEnter={() => { clearTimeout(timers.current[t.id]); }}
                        onMouseLeave={() => { timers.current[t.id] = setTimeout(() => dismiss(t.id), 4000); }}
                    >
                        <span className="toast-icon">
                            {t.variant === 'success' && <CheckCircle size={15} />}
                            {t.variant === 'error' && <AlertCircle size={15} />}
                            {t.variant === 'info' && <Info size={15} />}
                        </span>
                        <span className="toast-message">{t.message}</span>
                        <button className="toast-close" onClick={() => dismiss(t.id)}>
                            <X size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};
