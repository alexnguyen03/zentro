import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/cn';

type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
    content: React.ReactNode;
    children: React.ReactNode;
    side?: TooltipSide;
    className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
    content,
    children,
    side = 'top',
    className,
}) => {
    return (
        <TooltipPrimitive.Provider delayDuration={120}>
            <TooltipPrimitive.Root>
                <TooltipPrimitive.Trigger asChild>
                    <span className={cn('inline-flex', className)}>{children}</span>
                </TooltipPrimitive.Trigger>
                <TooltipPrimitive.Portal>
                    <TooltipPrimitive.Content
                        side={side}
                        sideOffset={8}
                        className={cn(
                            'z-tooltip rounded-md border border-border bg-popover px-2 py-1 text-[11px] font-medium text-popover-foreground shadow-elevation-md',
                            'animate-in fade-in zoom-in-95 duration-100',
                        )}
                    >
                        {content}
                    </TooltipPrimitive.Content>
                </TooltipPrimitive.Portal>
            </TooltipPrimitive.Root>
        </TooltipPrimitive.Provider>
    );
};
