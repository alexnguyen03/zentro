import { ENVIRONMENT_KEY } from './constants';
import type { EnvironmentKey } from '../types/project';

export const ENVIRONMENT_KEYS: EnvironmentKey[] = [
    ENVIRONMENT_KEY.LOCAL,
    ENVIRONMENT_KEY.DEVELOPMENT,
    ENVIRONMENT_KEY.TESTING,
    ENVIRONMENT_KEY.STAGING,
    ENVIRONMENT_KEY.PRODUCTION,
];

const ENVIRONMENT_ORDER_INDEX = ENVIRONMENT_KEYS.reduce<Record<EnvironmentKey, number>>((acc, key, index) => {
    acc[key] = index;
    return acc;
}, {} as Record<EnvironmentKey, number>);

// Single source of truth for all env color styling.
// badgeClass    — solid badge (full bg, white text) used in EnvironmentBadge
// colorClass    — tinted variant (low-opacity bg, colored text/border) used in meta/toolbar
export const ENVIRONMENT_BRAND: Record<EnvironmentKey, { badgeClass: string; colorClass: string }> = {
    [ENVIRONMENT_KEY.LOCAL]:       { badgeClass: 'env-badge-loc', colorClass: 'text-success border-success/30 bg-success/8' },
    [ENVIRONMENT_KEY.DEVELOPMENT]: { badgeClass: 'env-badge-dev', colorClass: 'text-primary border-primary/35 bg-primary/9' },
    [ENVIRONMENT_KEY.TESTING]:     { badgeClass: 'env-badge-tes', colorClass: 'text-testing border-testing/40 bg-testing/10' },
    [ENVIRONMENT_KEY.STAGING]:     { badgeClass: 'env-badge-sta', colorClass: 'text-warning border-warning/45 bg-warning/12' },
    [ENVIRONMENT_KEY.PRODUCTION]:  { badgeClass: 'env-badge-pro', colorClass: 'text-error border-error/45 bg-error/11' },
};

const ENVIRONMENT_META: Record<EnvironmentKey, { label: string; description: string; colorClass: string }> = {
    [ENVIRONMENT_KEY.LOCAL]: {
        label: 'Local',
        description: 'Fast local querying and lowest-friction experimentation.',
        colorClass: ENVIRONMENT_BRAND[ENVIRONMENT_KEY.LOCAL].colorClass,
    },
    [ENVIRONMENT_KEY.TESTING]: {
        label: 'Testing',
        description: 'Validation space for quick verification before broader development work.',
        colorClass: ENVIRONMENT_BRAND[ENVIRONMENT_KEY.TESTING].colorClass,
    },
    [ENVIRONMENT_KEY.DEVELOPMENT]: {
        label: 'Development',
        description: 'Main development environment for routine build and feature work.',
        colorClass: ENVIRONMENT_BRAND[ENVIRONMENT_KEY.DEVELOPMENT].colorClass,
    },
    [ENVIRONMENT_KEY.STAGING]: {
        label: 'Staging',
        description: 'Pre-production validation with more caution and cleaner parity expectations.',
        colorClass: ENVIRONMENT_BRAND[ENVIRONMENT_KEY.STAGING].colorClass,
    },
    [ENVIRONMENT_KEY.PRODUCTION]: {
        label: 'Production',
        description: 'Protected live environment where risk should stay explicit and controlled.',
        colorClass: ENVIRONMENT_BRAND[ENVIRONMENT_KEY.PRODUCTION].colorClass,
    },
};

export function getEnvironmentMeta(key?: string | null) {
    if (!key) {
        return {
            label: 'Unknown',
            description: 'Environment metadata is not available yet.',
            colorClass: 'text-muted-foreground border-border/45 bg-muted/20',
        };
    }
    return ENVIRONMENT_META[key as EnvironmentKey] || {
        label: key.toUpperCase(),
        description: 'Custom environment metadata is not available yet.',
        colorClass: 'text-muted-foreground border-border/45 bg-muted/20',
    };
}

export function getEnvironmentLabel(key?: string | null) {
    return getEnvironmentMeta(key).label;
}

export function getEnvironmentBgClass(key?: string | null): string {
    const { colorClass } = getEnvironmentMeta(key);
    return colorClass.split(' ').find((c) => c.startsWith('bg-')) ?? '';
}

export function getEnvironmentOrderIndex(key?: EnvironmentKey | null): number {
    if (!key) return Number.MAX_SAFE_INTEGER;
    return ENVIRONMENT_ORDER_INDEX[key] ?? Number.MAX_SAFE_INTEGER;
}

export function sortEnvironmentKeys(keys: EnvironmentKey[]): EnvironmentKey[] {
    return [...keys].sort((a, b) => getEnvironmentOrderIndex(a) - getEnvironmentOrderIndex(b));
}
