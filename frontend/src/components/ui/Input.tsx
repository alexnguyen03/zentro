import * as React from 'react';
import { cn } from '@/lib/cn';
import { DENSITY_CLASS, STATE_CLASS, TONE_CLASS, type DesignSystemControlProps } from './contract';

// inputSize: sm=h-7/text-label  md=h-8/text-small(default)  lg=h-9/text-body  xl=h-10/text-body
// variant:   default = bordered bg-background
//            ghost   = subtle bg-muted/40 border-input/70, for search bars embedded in toolbars
export type InputSize = 'sm' | 'md' | 'lg' | 'xl';
export type InputVariant = 'default' | 'ghost';

const SIZE_CLASS: Record<InputSize, string> = {
    sm: 'h-7 text-label px-2',
    md: 'h-8 text-small px-3',
    lg: 'h-9 text-body px-3',
    xl: 'h-10 text-body px-3',
};

const VARIANT_CLASS: Record<InputVariant, string> = {
    default: 'border-input bg-background',
    ghost:   'border-input/70 bg-muted/40 focus-visible:bg-background',
};

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement>, DesignSystemControlProps {
    /** Visual size token — maps to height + font-size. Does not set the native `size` attribute. */
    inputSize?: InputSize;
    variant?: InputVariant;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({
        className,
        type,
        tone = 'default',
        state = 'default',
        density = 'compact',
        inputSize = 'md',
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
                    'flex w-full rounded-[8px] border text-foreground shadow-xs transition-colors duration-150 outline-none',
                    'placeholder:text-muted-foreground focus-visible:border-primary/65 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
                    'file:border-0 file:bg-transparent file:font-medium file:text-foreground',
                    'disabled:cursor-not-allowed disabled:bg-muted/35',
                    SIZE_CLASS[inputSize],
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
