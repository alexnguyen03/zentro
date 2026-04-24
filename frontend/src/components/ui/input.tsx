import * as React from 'react';
import { cn } from '@/lib/cn';
import { CONTROL_SIZE_CLASS, DENSITY_CLASS, STATE_CLASS, TONE_CLASS, type ControlSize, type DesignSystemControlProps } from './contract';

// variant: default = bordered bg-background
//          ghost   = subtle bg-muted/40, for search bars embedded in toolbars
export type InputVariant = 'default' | 'ghost';

const VARIANT_CLASS: Record<InputVariant, string> = {
    default: 'border-input bg-background',
    ghost:   'border-input/70 bg-muted/40 focus-visible:bg-background',
};

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>, DesignSystemControlProps {
    size?: ControlSize;
    variant?: InputVariant;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({
        className,
        type,
        tone = 'default',
        state = 'default',
        density = 'compact',
        size = 'sm',
        variant = 'default',
        ...props
    }, ref) => {
        const disabled = props.disabled || state === 'disabled';
        return (
            <input
                type={type}
                data-tone={tone}
                data-state={state}
                disabled={disabled}
                aria-busy={state === 'loading' ? true : undefined}
                className={cn(
                    'flex w-full rounded-sm border text-foreground transition-colors duration-fast outline-none',
                    'placeholder:text-muted-foreground focus-visible:border-primary/65 focus-visible:ring-0 focus-visible:outline-none',
                    'file:border-0 file:bg-transparent file:font-medium file:text-foreground',
                    'disabled:cursor-not-allowed disabled:bg-muted/35',
                    CONTROL_SIZE_CLASS[size],
                    VARIANT_CLASS[variant],
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
export type { ControlSize as InputSize };
