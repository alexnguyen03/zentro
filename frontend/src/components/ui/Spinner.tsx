import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn';

interface SpinnerProps extends React.SVGAttributes<SVGSVGElement> {
    size?: number | string;
}

export const Spinner = React.forwardRef<SVGSVGElement, SpinnerProps>(
    ({ className, size = 16, ...props }, ref) => {
        return (
            <Loader2
                ref={ref}
                size={size}
                className={cn('animate-spin text-text-secondary', className)}
                {...props}
            />
        );
    }
);

Spinner.displayName = 'Spinner';
