import React from 'react';
import { cn } from '../../lib/cn';

interface SwitchFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
    checked: boolean;
    onChange: (checked: boolean) => void;
}

export const SwitchField = React.forwardRef<HTMLInputElement, SwitchFieldProps>(
    ({ className, checked, disabled, onChange, ...props }, ref) => {
        return (
            <label className={cn('relative inline-flex items-center', disabled ? 'cursor-not-allowed' : 'cursor-pointer', className)}>
                <input
                    ref={ref}
                    type="checkbox"
                    className="peer sr-only"
                    checked={checked}
                    disabled={disabled}
                    onChange={(event) => onChange(event.target.checked)}
                    {...props}
                />
                <span
                    aria-hidden
                    className={cn(
                        'relative inline-block h-5 w-9 rounded-full border border-border bg-bg-tertiary transition-colors',
                        'after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full',
                        'after:border after:border-border after:bg-bg-primary after:transition-transform',
                        'peer-checked:border-accent peer-checked:bg-accent peer-checked:after:translate-x-4 peer-checked:after:border-white',
                        'peer-disabled:opacity-60',
                    )}
                />
            </label>
        );
    },
);

SwitchField.displayName = 'SwitchField';
