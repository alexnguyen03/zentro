import React from 'react';
import { cn } from '@/lib/cn';

interface EnvironmentBadgeProps {
    label: string;
    toneClassName?: string;
    className?: string;
    title?: string;
}

const ENVIRONMENT_ALIASES: Record<string, string> = {
    production: 'production',
    prod: 'production',
    pro: 'production',
    staging: 'staging',
    stg: 'staging',
    sta: 'staging',
    development: 'development',
    dev: 'development',
    testing: 'testing',
    test: 'testing',
    qa: 'testing',
    local: 'local',
    loc: 'local',
};

const ENVIRONMENT_COLORS: Record<string, string> = {
    production: 'bg-[#FF4D4F] text-white',
    staging: 'bg-[#F59E0B] text-white',
    development: 'bg-[#1D9BF0] text-white',
    testing: 'bg-[#C84BE8] text-white',
    local: 'bg-[#46B98B] text-white',
};

function resolveEnvironmentTone(label: string): string | null {
    const normalized = label.trim().toLowerCase();
    const key = ENVIRONMENT_ALIASES[normalized];
    if (!key) return null;
    return ENVIRONMENT_COLORS[key] || null;
}

export const EnvironmentBadge: React.FC<EnvironmentBadgeProps> = ({
    label,
    toneClassName,
    className,
    title,
}) => {
    const resolvedTone = resolveEnvironmentTone(label);

    return (
        <span
            title={title}
            className={cn(
                'inline-flex h-6 min-w-5 shrink-0 items-center justify-center rounded-sm px-2 text-[13px] font-semibold uppercase tracking-[0.03em] leading-none',
                resolvedTone || toneClassName || 'bg-muted text-foreground',
                className,
            )}
        >
            {label}
        </span>
    );
};
