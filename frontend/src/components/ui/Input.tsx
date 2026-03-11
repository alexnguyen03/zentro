import React from 'react';
import { cn } from '../../lib/cn';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, error, ...props }, ref) => {
        return (
            <input
                ref={ref}
                className={cn(
                    'flex h-8 w-full rounded-md border bg-bg-primary px-3 py-1.5 text-[13px]',
                    'transition-colors placeholder:text-text-muted outline-none',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                    error
                        ? 'border-error focus:border-error text-error'
                        : 'border-border focus:border-accent',
                    className
                )}
                {...props}
            />
        );
    }
);

Input.displayName = 'Input';
