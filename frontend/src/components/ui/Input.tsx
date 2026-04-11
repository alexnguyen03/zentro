import * as React from 'react';
import { cn } from '@/lib/cn';
import { DENSITY_CLASS, STATE_CLASS, TONE_CLASS, type DesignSystemControlProps } from './contract';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement>, DesignSystemControlProps {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, tone = 'default', state = 'default', density = 'compact', ...props }, ref) => {
        const disabled = props.disabled || state === 'disabled';
        return (
            <input
                type={type}
                data-tone={tone}
                data-state={state}
                disabled={disabled}
                aria-busy={state === 'loading' ? true : undefined}
                className={cn(
                    'flex h-8 w-full rounded-[8px] border border-input bg-background px-3 text-foreground shadow-xs transition-colors duration-150 outline-none',
                    'placeholder:text-muted-foreground focus-visible:border-primary/65 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
                    'file:border-0 file:bg-transparent file:font-medium file:text-foreground',
                    'disabled:cursor-not-allowed disabled:bg-muted/35',
                    DENSITY_CLASS[density],
                    TONE_CLASS[tone],
                    STATE_CLASS[state],
                    className,
                )}
                ref={ref}
                {...props}
            />
        );
    },
);
Input.displayName = 'Input';

export { Input };
