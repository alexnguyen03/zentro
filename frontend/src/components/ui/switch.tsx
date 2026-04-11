import * as React from 'react';
import * as SwitchPrimitives from '@radix-ui/react-switch';
import { cn } from '@/lib/cn';
import { STATE_CLASS, TONE_CLASS, type DesignSystemControlProps } from './contract';

const Switch = React.forwardRef<
    React.ElementRef<typeof SwitchPrimitives.Root>,
    React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> & DesignSystemControlProps
>(({ className, tone = 'default', state = 'default', ...props }, ref) => (
    <SwitchPrimitives.Root
        ref={ref}
        data-tone={tone}
        data-ui-state={state}
        disabled={props.disabled || state === 'disabled'}
        aria-busy={state === 'loading' ? true : undefined}
        className={cn(
            'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-border bg-secondary transition-colors duration-150',
            'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
            'disabled:cursor-not-allowed data-[state=checked]:border-primary data-[state=checked]:bg-primary',
            TONE_CLASS[tone],
            STATE_CLASS[state],
            className,
        )}
        {...props}
    >
        <SwitchPrimitives.Thumb
            className={cn(
                'pointer-events-none block h-4 w-4 rounded-full border border-border bg-background shadow-lg ring-0 transition-transform',
                'data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-[2px] data-[state=checked]:border-primary-foreground',
            )}
        />
    </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
