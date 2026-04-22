import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';
import { DENSITY_CLASS, STATE_CLASS, TONE_CLASS } from './contract';

export const buttonVariants = cva(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm border font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-55 cursor-pointer',
    {
        variants: {
            variant: {
                default: 'border-primary/35 bg-primary !text-white hover:bg-primary/90',
                secondary: 'border-border bg-secondary text-secondary-foreground hover:bg-muted hover:text-foreground',
                destructive: 'border-destructive/30 bg-destructive text-destructive-foreground hover:bg-destructive/92',
                ghost: 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                outline: 'border-border bg-background text-foreground hover:bg-muted',
                link: 'text-primary underline-offset-4 hover:underline',
            },
            size: {
                sm:        'h-7 px-2 text-small',   // = ControlSize sm — default
                md:        'h-9 px-3 text-small',   // = ControlSize md
                lg:        'h-9 px-4 text-small',
                'icon-xs': 'h-5 w-5 px-0',          // status bar, badge
                'icon-sm': 'h-6 w-6 px-0',          // dense toolbar
                icon:      'h-7 w-7 px-0',          // sm companion
                'icon-md': 'h-9 w-9 px-0',          // md companion
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
            size: 'sm', // = ControlSize sm
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
