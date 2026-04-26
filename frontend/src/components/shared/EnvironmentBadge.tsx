import React from 'react';
import { cn } from '@/lib/cn';
import { ENVIRONMENT_BRAND } from '@/lib/projects';
import type { EnvironmentKey } from '@/types/project';

interface EnvironmentBadgeProps {
    label: string;
    toneClassName?: string;
    className?: string;
    title?: string;
}

const ENVIRONMENT_ALIASES: Record<string, EnvironmentKey> = {
    production: 'pro', prod: 'pro', pro: 'pro',
    staging: 'sta', stg: 'sta', sta: 'sta',
    development: 'dev', dev: 'dev',
    testing: 'tes', test: 'tes', qa: 'tes', tes: 'tes',
    local: 'loc', loc: 'loc',
};

function resolveEnvironmentBadgeClass(label: string): string | null {
    const key = ENVIRONMENT_ALIASES[label.trim().toLowerCase()];
    return key ? (ENVIRONMENT_BRAND[key]?.badgeClass ?? null) : null;
}

export const EnvironmentBadge: React.FC<EnvironmentBadgeProps> = ({
    label,
    toneClassName,
    className,
    title,
}) => {
    const resolvedTone = resolveEnvironmentBadgeClass(label);

    return (
        <span
            title={title}
            className={cn(
                'inline-flex h-6 min-w-5 shrink-0 items-center justify-center rounded-sm px-2 text-[13px] font-semibold uppercase tracking-[0.03em] leading-none',
                resolvedTone ? resolvedTone : (toneClassName || 'bg-muted text-foreground'),
                className,
            )}
        >
            {label}
        </span>
    );
};
