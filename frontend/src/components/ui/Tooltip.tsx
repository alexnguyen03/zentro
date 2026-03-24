import React from 'react';
import { cn } from '../../lib/cn';

type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
    content: React.ReactNode;
    children: React.ReactNode;
    side?: TooltipSide;
    className?: string;
}

const sideClasses: Record<TooltipSide, string> = {
    top: 'bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2',
    bottom: 'top-[calc(100%+8px)] left-1/2 -translate-x-1/2',
    left: 'right-[calc(100%+8px)] top-1/2 -translate-y-1/2',
    right: 'left-[calc(100%+8px)] top-1/2 -translate-y-1/2',
};

export const Tooltip: React.FC<TooltipProps> = ({ content, children, side = 'top', className }) => {
    return (
        <span className={cn('group relative inline-flex', className)}>
            {children}
            <span
                role="tooltip"
                className={cn(
                    'pointer-events-none absolute z-[1600] whitespace-nowrap rounded-md bg-bg-primary px-2 py-1 text-[11px] font-medium text-text-primary shadow-lg opacity-0 transition-opacity duration-150',
                    'group-hover:opacity-100 group-focus-within:opacity-100',
                    sideClasses[side],
                )}
            >
                {content}
            </span>
        </span>
    );
};

