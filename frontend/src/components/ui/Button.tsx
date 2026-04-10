import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';
import { DENSITY_CLASS, STATE_CLASS, TONE_CLASS } from './contract';

export const buttonVariants = cva(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
    {
        variants: {
            variant: {
                default: 'bg-primary text-white hover:bg-primary/90',
                secondary: 'border border-border bg-secondary text-secondary-foreground hover:bg-secondary/85',
                destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
                ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
                outline: 'border border-border bg-background text-foreground hover:bg-muted',
                link: 'text-primary underline-offset-4 hover:underline',
            },
            size: {
                default: 'h-8 px-3',
                sm: 'h-7 rounded-md px-2 text-xs',
                lg: 'h-9 rounded-md px-4 text-sm',
                icon: 'h-8 w-8',
            },
            density: {
                compact: DENSITY_CLASS.compact,
            },
            tone: {
                default: TONE_CLASS.default,
                neutral: TONE_CLASS.neutral,
                success: TONE_CLASS.success,
                warning: TONE_CLASS.warning,
                danger: TONE_CLASS.danger,
            },
            state: {
                default: STATE_CLASS.default,
                loading: STATE_CLASS.loading,
                error: STATE_CLASS.error,
                disabled: STATE_CLASS.disabled,
            },
        },
        defaultVariants: {
            variant: 'secondary',
            size: 'default',
            density: 'compact',
            tone: 'default',
            state: 'default',
        },
    },
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, density = 'compact', tone = 'default', state = 'default', asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : 'button';
        const disabled = props.disabled || state === 'disabled';
        return (
            <Comp
                data-tone={tone}
                data-state={state}
                disabled={disabled}
                aria-busy={state === 'loading' ? true : undefined}
                className={cn(buttonVariants({ variant, size, density, tone, state, className }))}
                ref={ref}
                {...props}
            />
        );
    },
);

Button.displayName = 'Button';

export { Button };
