import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

type OptionItem = {
    value: string;
    label: string;
    disabled?: boolean;
};

interface SelectFieldProps {
    value?: string | number;
    defaultValue?: string | number;
    placeholder?: string;
    onValueChange?: (value: string) => void;
    onChange?: (event: { target: { value: string } }) => void;
    disabled?: boolean;
    error?: boolean;
    className?: string;
    triggerClassName?: string;
    hideChevron?: boolean;
    children?: React.ReactNode;
    name?: string;
    required?: boolean;
    title?: string;
    'aria-label'?: string;
    'aria-labelledby'?: string;
}

function extractOptions(children: React.ReactNode): OptionItem[] {
    const options: OptionItem[] = [];
    React.Children.forEach(children, (child) => {
        if (!React.isValidElement(child)) return;
        if (typeof child.type === 'string' && child.type.toLowerCase() === 'option') {
            const valueProp = child.props.value;
            const value = valueProp === undefined ? String(child.props.children ?? '') : String(valueProp);
            options.push({
                value,
                label: String(child.props.children ?? value),
                disabled: Boolean(child.props.disabled),
            });
        }
    });
    return options;
}

export const SelectField = React.forwardRef<
    React.ElementRef<typeof SelectPrimitive.Trigger>,
    SelectFieldProps
>(({
    value,
    defaultValue,
    placeholder,
    onValueChange,
    onChange,
    disabled,
    error,
    className,
    triggerClassName,
    hideChevron = false,
    children,
    ...triggerProps
}, ref) => {
    const options = React.useMemo(() => extractOptions(children), [children]);
    const controlledValue = value === undefined ? undefined : String(value);
    const controlledDefault = defaultValue === undefined ? undefined : String(defaultValue);

    return (
        <SelectPrimitive.Root
            value={controlledValue}
            defaultValue={controlledDefault}
            disabled={disabled}
            onValueChange={(nextValue) => {
                onValueChange?.(nextValue);
                onChange?.({ target: { value: nextValue } });
            }}
        >
            <SelectPrimitive.Trigger
                ref={ref}
                className={cn(
                    'flex h-8 w-full items-center justify-between rounded-md border bg-background px-3 text-[13px] text-foreground shadow-xs outline-none',
                    'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                    error ? 'border-destructive' : 'border-input',
                    triggerClassName,
                    className,
                )}
                {...triggerProps}
            >
                <SelectPrimitive.Value placeholder={placeholder} />
                {!hideChevron && (
                    <SelectPrimitive.Icon asChild>
                        <ChevronDown size={14} className="text-muted-foreground" />
                    </SelectPrimitive.Icon>
                )}
            </SelectPrimitive.Trigger>
            <SelectPrimitive.Portal>
                <SelectPrimitive.Content
                    position="popper"
                    className="z-dropdown min-w-[8rem] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-elevation-md"
                    sideOffset={6}
                >
                    <SelectPrimitive.Viewport className="p-1">
                        {options.map((option) => (
                            <SelectPrimitive.Item
                                key={option.value}
                                value={option.value}
                                disabled={option.disabled}
                                className={cn(
                                    'relative flex h-8 cursor-pointer select-none items-center rounded-sm py-1.5 pr-8 pl-2 text-[13px] outline-none',
                                    'focus:bg-muted focus:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                                )}
                            >
                                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                                <SelectPrimitive.ItemIndicator className="absolute right-2 inline-flex items-center justify-center">
                                    <Check size={13} />
                                </SelectPrimitive.ItemIndicator>
                            </SelectPrimitive.Item>
                        ))}
                    </SelectPrimitive.Viewport>
                </SelectPrimitive.Content>
            </SelectPrimitive.Portal>
        </SelectPrimitive.Root>
    );
});

SelectField.displayName = 'SelectField';
