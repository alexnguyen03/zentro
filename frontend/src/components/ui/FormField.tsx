import React from 'react';
import { cn } from '../../lib/cn';

interface FormFieldProps {
    label?: React.ReactNode;
    hint?: React.ReactNode;
    error?: React.ReactNode;
    required?: boolean;
    htmlFor?: string;
    className?: string;
    children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({
    label,
    hint,
    error,
    required,
    htmlFor,
    className,
    children,
}) => {
    return (
        <div className={cn('flex flex-col gap-1.5', className)}>
            {label && (
                <label htmlFor={htmlFor} className="text-[12px] font-semibold tracking-tight text-foreground">
                    {label}
                    {required ? <span className="ml-1 text-destructive">*</span> : null}
                </label>
            )}
            {children}
            {error ? (
                <span className="text-[11px] leading-relaxed text-destructive">{error}</span>
            ) : hint ? (
                <span className="text-[11px] leading-relaxed text-muted-foreground">{hint}</span>
            ) : null}
        </div>
    );
};

