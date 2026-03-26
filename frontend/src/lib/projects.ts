import { ENVIRONMENT_KEY } from './constants';
import type { EnvironmentKey } from '../types/project';

export const ENVIRONMENT_KEYS: EnvironmentKey[] = [
    ENVIRONMENT_KEY.LOCAL,
    ENVIRONMENT_KEY.TESTING,
    ENVIRONMENT_KEY.DEVELOPMENT,
    ENVIRONMENT_KEY.STAGING,
    ENVIRONMENT_KEY.PRODUCTION,
];

const ENVIRONMENT_META: Record<EnvironmentKey, { label: string; description: string; colorClass: string }> = {
    [ENVIRONMENT_KEY.LOCAL]: {
        label: 'Local',
        description: 'Fast local querying and lowest-friction experimentation.',
        colorClass: 'text-success border-success/40 bg-success/10',
    },
    [ENVIRONMENT_KEY.TESTING]: {
        label: 'Testing',
        description: 'Validation space for quick verification before broader development work.',
        colorClass: 'text-fuchsia-400 border-fuchsia-400/40 bg-fuchsia-400/10',
    },
    [ENVIRONMENT_KEY.DEVELOPMENT]: {
        label: 'Development',
        description: 'Main development environment for routine build and feature work.',
        colorClass: 'text-sky-400 border-sky-400/40 bg-sky-400/10',
    },
    [ENVIRONMENT_KEY.STAGING]: {
        label: 'Staging',
        description: 'Pre-production validation with more caution and cleaner parity expectations.',
        colorClass: 'text-amber-400 border-amber-400/40 bg-amber-400/10',
    },
    [ENVIRONMENT_KEY.PRODUCTION]: {
        label: 'Production',
        description: 'Protected live environment where risk should stay explicit and controlled.',
        colorClass: 'text-red-400 border-red-400/40 bg-red-400/10',
    },
};

export function getEnvironmentMeta(key?: string | null) {
    if (!key) {
        return {
            label: 'Unknown',
            description: 'Environment metadata is not available yet.',
            colorClass: 'text-text-secondary border-border bg-bg-tertiary',
        };
    }
    return ENVIRONMENT_META[key as EnvironmentKey] || {
        label: key.toUpperCase(),
        description: 'Custom environment metadata is not available yet.',
        colorClass: 'text-text-secondary border-border bg-bg-tertiary',
    };
}

export function getEnvironmentLabel(key?: string | null) {
    return getEnvironmentMeta(key).label;
}
