import * as React from 'react';
import { cn } from '@/lib/cn';
import { DENSITY_CLASS, STATE_CLASS, TONE_CLASS, type DesignSystemControlProps } from './contract';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement>, DesignSystemControlProps {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ className, tone = 'default', state = 'default', density = 'compact', ...props }, ref) => {
        const disabled = props.disabled || state === 'disabled';
        return (
            <textarea
                data-tone={tone}
                data-state={state}
                disabled={disabled}
                aria-busy={state === 'loading' ? true : undefined}
                className={cn(
                    'flex min-h-20 w-full rounded-sm border border-input bg-background px-3 py-2 text-foreground shadow-xs transition-colors duration-fast outline-none',
                    'placeholder:text-muted-foreground focus-visible:border-primary/65 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
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
Textarea.displayName = 'Textarea';

export { Textarea };
