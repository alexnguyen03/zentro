import React from 'react';
import { Search } from 'lucide-react';
import { Input } from './Input';
import { cn } from '../../lib/cn';

interface SearchFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
    wrapperClassName?: string;
}

export const SearchField = React.forwardRef<HTMLInputElement, SearchFieldProps>(
    ({ className, wrapperClassName, ...props }, ref) => {
        return (
            <div className={cn('relative w-full', wrapperClassName)}>
                <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted/70" />
                <Input
                    ref={ref}
                    type="text"
                    className={cn('h-9 pl-8 bg-bg-tertiary/35 border-border/60 focus:bg-bg-primary', className)}
                    {...props}
                />
            </div>
        );
    },
);

SearchField.displayName = 'SearchField';

