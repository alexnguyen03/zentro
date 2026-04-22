import React from 'react';
import { cn } from '@/lib/cn';

interface EnvironmentBadgeProps {
    label: string;
    toneClassName?: string;
    className?: string;
    title?: string;
}

export const EnvironmentBadge: React.FC<EnvironmentBadgeProps> = ({
    label,
    toneClassName,
    className,
    title,
}) => (
    <span
        title={title}
        className={cn(
            'inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-sm border px-1 text-[13px] font-normal uppercase tracking-[0.03em] leading-none',
            toneClassName,
            className,
        )}
    >
        {label}
    </span>
);
