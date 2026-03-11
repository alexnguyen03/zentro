import React from 'react';
import { cn } from '../../lib/cn';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    variant?: 'default' | 'success' | 'danger' | 'warning' | 'info';
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
    ({ className, variant = 'default', children, ...props }, ref) => {
        return (
            <span
                ref={ref}
                className={cn(
                    'inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-medium leading-none tracking-wide uppercase',
                    {
                        'bg-bg-tertiary text-text-secondary': variant === 'default',
                        'bg-success/15 text-success': variant === 'success',
                        'bg-error/15 text-error': variant === 'danger',
                        'bg-[#ffbd2e]/15 text-[#ffbd2e]': variant === 'warning',
                        'bg-accent/15 text-accent': variant === 'info',
                    },
                    className
                )}
                {...props}
            >
                {children}
            </span>
        );
    }
);

Badge.displayName = 'Badge';
