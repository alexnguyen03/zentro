import React from 'react';
import { cn } from '../../lib/cn';

interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
    orientation?: 'horizontal' | 'vertical';
}

export const Divider = React.forwardRef<HTMLDivElement, DividerProps>(
    ({ className, orientation = 'horizontal', ...props }, ref) => {
        return (
            <div
                ref={ref}
                role="separator"
                className={cn(
                    'bg-border shrink-0',
                    orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px mx-1',
                    className
                )}
                {...props}
            />
        );
    }
);

Divider.displayName = 'Divider';
