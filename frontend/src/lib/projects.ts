import type { EnvironmentKey } from '../types/project';

const ENVIRONMENT_META: Record<EnvironmentKey, { label: string; colorClass: string }> = {
    loc: { label: 'Local', colorClass: 'text-success border-success/40 bg-success/10' },
    tes: { label: 'Testing', colorClass: 'text-fuchsia-400 border-fuchsia-400/40 bg-fuchsia-400/10' },
    dev: { label: 'Development', colorClass: 'text-sky-400 border-sky-400/40 bg-sky-400/10' },
    sta: { label: 'Staging', colorClass: 'text-amber-400 border-amber-400/40 bg-amber-400/10' },
    pro: { label: 'Production', colorClass: 'text-red-400 border-red-400/40 bg-red-400/10' },
};

export function getEnvironmentMeta(key?: string | null) {
    if (!key) {
        return { label: 'Unknown', colorClass: 'text-text-secondary border-border bg-bg-tertiary' };
    }
    return ENVIRONMENT_META[key as EnvironmentKey] || { label: key.toUpperCase(), colorClass: 'text-text-secondary border-border bg-bg-tertiary' };
}

export function getEnvironmentLabel(key?: string | null) {
    return getEnvironmentMeta(key).label;
}

