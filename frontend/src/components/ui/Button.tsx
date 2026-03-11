import React from 'react';
import { cn } from '../../lib/cn';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'ghost' | 'solid' | 'primary' | 'danger' | 'success';
    size?: 'icon' | 'sm' | 'md' | 'lg';
    asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'solid', size = 'md', children, ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={cn(
                    // Base styles
                    'inline-flex items-center justify-center rounded-md font-medium transition-colors outline-none cursor-pointer',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    // Variants
                    {
                        'bg-transparent hover:bg-bg-tertiary text-text-secondary hover:text-text-primary border border-transparent hover:border-border': variant === 'ghost',
                        'bg-bg-secondary hover:bg-bg-tertiary text-text-primary border border-border': variant === 'solid',
                        'bg-accent text-white hover:bg-accent-hover border border-transparent': variant === 'primary',
                        'bg-error text-white hover:opacity-90 border border-transparent': variant === 'danger',
                        'bg-success text-white hover:opacity-90 border border-transparent': variant === 'success',
                    },
                    // Sizes
                    {
                        'p-1.5 text-xs h-7 w-7': size === 'icon',
                        'px-2 py-1 text-xs h-7': size === 'sm',
                        'px-3 py-1.5 text-[13px] h-8': size === 'md',
                        'px-4 py-2 text-sm h-9': size === 'lg',
                    },
                    className
                )}
                {...props}
            >
                {children}
            </button>
        );
    }
);

Button.displayName = 'Button';
