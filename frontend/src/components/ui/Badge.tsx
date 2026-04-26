import React from 'react';
import { cn } from '../../lib/cn';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    variant?: 'default' | 'success' | 'destructive' | 'warning' | 'info';
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
    ({ className, variant = 'default', children, ...props }, ref) => {
        return (
            <span
                ref={ref}
                className={cn(
                    'inline-flex items-center rounded-sm px-1.5 py-0.5 text-label font-medium leading-none tracking-wide uppercase',
                    {
                        'bg-muted text-muted-foreground': variant === 'default',
                        'bg-success/15 text-success': variant === 'success',
                        'bg-destructive/15 text-destructive': variant === 'destructive',
                        'bg-warning/15 text-warning': variant === 'warning',
                        'bg-accent/15 text-accent-foreground': variant === 'info',
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
