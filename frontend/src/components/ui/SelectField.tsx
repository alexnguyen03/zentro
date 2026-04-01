import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';

interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    error?: boolean;
    hideChevron?: boolean;
}

export const SelectField = React.forwardRef<HTMLSelectElement, SelectFieldProps>(
    ({ className, error, hideChevron = false, children, ...props }, ref) => {
        return (
            <div className="relative w-full">
                <select
                    ref={ref}
                    className={cn(
                        'h-8 w-full appearance-none rounded-md border bg-bg-primary px-3 pr-8 text-[13px] text-text-primary',
                        'outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                        error ? 'border-error focus:border-error' : 'border-border focus:border-accent',
                        className,
                    )}
                    {...props}
                >
                    {children}
                </select>
                {!hideChevron && (
                    <ChevronDown
                        size={14}
                        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-muted"
                    />
                )}
            </div>
        );
    },
);

SelectField.displayName = 'SelectField';

