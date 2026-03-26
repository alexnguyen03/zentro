import React from 'react';
import { cn } from '../../lib/cn';

export const BUTTON_VARIANT = {
    GHOST: 'ghost',
    SOLID: 'solid',
    PRIMARY: 'primary',
    DANGER: 'danger',
    SUCCESS: 'success',
} as const;

export const BUTTON_SIZE = {
    ICON: 'icon',
    SM: 'sm',
    MD: 'md',
    LG: 'lg',
} as const;

export type ButtonVariant = typeof BUTTON_VARIANT[keyof typeof BUTTON_VARIANT];
export type ButtonSize = typeof BUTTON_SIZE[keyof typeof BUTTON_SIZE];

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    danger?: boolean;
    asChild?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
    [BUTTON_VARIANT.GHOST]: 'bg-transparent border-none text-text-muted hover:text-text-primary hover:bg-text-primary/10',
    [BUTTON_VARIANT.SOLID]: 'bg-bg-secondary hover:bg-bg-tertiary text-text-primary border border-border',
    [BUTTON_VARIANT.PRIMARY]: 'bg-accent text-white hover:bg-accent-hover border border-transparent',
    [BUTTON_VARIANT.DANGER]: 'bg-error text-white hover:opacity-90 border border-transparent',
    [BUTTON_VARIANT.SUCCESS]: 'bg-success text-white hover:opacity-90 border border-transparent',
};

const ghostDangerClass = 'bg-transparent border-none text-error/70 hover:text-error hover:bg-error/10';

const sizeClasses: Record<ButtonSize, string> = {
    [BUTTON_SIZE.ICON]: 'p-1.5 text-xs h-7 w-7 rounded-lg',
    [BUTTON_SIZE.SM]: 'px-2 py-1 text-xs h-7 rounded-lg',
    [BUTTON_SIZE.MD]: 'px-3 py-1.5 text-[13px] h-8',
    [BUTTON_SIZE.LG]: 'px-4 py-2 text-sm h-9',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = BUTTON_VARIANT.SOLID, size = BUTTON_SIZE.MD, danger, children, ...props }, ref) => {
        const actualVariant = (variant === BUTTON_VARIANT.SOLID && danger) ? BUTTON_VARIANT.DANGER : variant;
        const finalVariantClass = (variant === BUTTON_VARIANT.GHOST && danger) 
            ? ghostDangerClass 
            : variantClasses[actualVariant];

        return (
            <button
                ref={ref}
                className={cn(
                    // Base styles
                    'inline-flex items-center justify-center rounded-md font-medium transition-all outline-none cursor-pointer',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    // Applied generic classes
                    finalVariantClass,
                    sizeClasses[size],
                    className
                )}
                {...props}
            >
                {children}
            </button>
        );
    }
);

Button.displayName = 'Button';
