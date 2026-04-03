import * as React from 'react';
import * as SwitchPrimitives from '@radix-ui/react-switch';
import { cn } from '@/lib/cn';

interface SwitchFieldProps
    extends Omit<React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>, 'onCheckedChange' | 'onChange'> {
    onCheckedChange?: (checked: boolean) => void;
    onChange?: (checked: boolean) => void;
}

const SwitchField = React.forwardRef<
    React.ElementRef<typeof SwitchPrimitives.Root>,
    SwitchFieldProps
>(({ className, onCheckedChange, onChange, ...props }, ref) => (
    <SwitchPrimitives.Root
        className={cn(
            'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-border bg-secondary transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
            'data-[state=checked]:border-primary data-[state=checked]:bg-primary',
            className,
        )}
        onCheckedChange={(checked) => {
            onCheckedChange?.(checked);
            onChange?.(checked);
        }}
        {...props}
        ref={ref}
    >
        <SwitchPrimitives.Thumb
            className={cn(
                'pointer-events-none block h-4 w-4 rounded-full border border-border bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-[2px]',
                'data-[state=checked]:border-primary-foreground',
            )}
        />
    </SwitchPrimitives.Root>
));
SwitchField.displayName = SwitchPrimitives.Root.displayName;

export { SwitchField };
