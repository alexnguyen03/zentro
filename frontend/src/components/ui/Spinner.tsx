import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn';
import { cva, type VariantProps } from 'class-variance-authority';

const spinnerVariants = cva('animate-spin', {
    variants: {
        tone: {
            default: 'text-muted-foreground',
            primary: 'text-primary',
            current: 'text-current',
        },
    },
    defaultVariants: {
        tone: 'default',
    },
});

interface SpinnerProps extends React.SVGAttributes<SVGSVGElement>, VariantProps<typeof spinnerVariants> {
    size?: number | string;
}

export const Spinner = React.forwardRef<SVGSVGElement, SpinnerProps>(
    ({ className, size = 16, tone, ...props }, ref) => {
        return (
            <Loader2
                ref={ref}
                size={size}
                className={cn(spinnerVariants({ tone }), className)}
                aria-hidden={props['aria-label'] ? undefined : true}
                {...props}
            />
        );
    }
);

Spinner.displayName = 'Spinner';
