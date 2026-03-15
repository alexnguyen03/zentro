import React from 'react';
import { cn } from '../../lib/cn';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'ghost' | 'solid' | 'primary' | 'danger' | 'success';
    size?: 'icon' | 'sm' | 'md' | 'lg';
    danger?: boolean;
    asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'solid', size = 'md', danger, children, ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={cn(
                    // Base styles
                    'inline-flex items-center justify-center rounded-md font-medium transition-all outline-none cursor-pointer',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    // Variants
                    {
                        // Ghost standard
                        'bg-transparent border-none text-text-muted hover:text-text-primary hover:bg-text-primary/10': variant === 'ghost' && !danger,
                        // Ghost danger
                        'bg-transparent border-none text-error/70 hover:text-error hover:bg-error/10': variant === 'ghost' && danger,
                        
                        // Solid standard
                        'bg-bg-secondary hover:bg-bg-tertiary text-text-primary border border-border': variant === 'solid' && !danger,
                        // Solid danger (maps to 'danger' variant or solid with danger prop)
                        'bg-error text-white hover:opacity-90 border border-transparent': variant === 'danger' || (variant === 'solid' && danger),
                        
                        'bg-accent text-white hover:bg-accent-hover border border-transparent': variant === 'primary',
                        'bg-success text-white hover:opacity-90 border border-transparent': variant === 'success',
                    },
                    // Sizes
                    {
                        'p-1.5 text-xs h-7 w-7 rounded-lg': size === 'icon',
                        'px-2 py-1 text-xs h-7 rounded-lg': size === 'sm',
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
