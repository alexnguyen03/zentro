import { useSettingsStore } from '../../stores/settingsStore';
import type { QueryPolicy } from './runtime';

const DEFAULT_ROW_CAP = 100000;

export function resolveQueryPolicy(environmentKey?: string): QueryPolicy {
    const settings = useSettingsStore.getState();
    const strict = environmentKey === 'pro' || environmentKey === 'sta';

    return {
        queryTimeoutSeconds: settings.queryTimeout || 60,
        rowCapPerTab: strict ? Math.min(DEFAULT_ROW_CAP, 50000) : DEFAULT_ROW_CAP,
        requireWriteConfirm: settings.viewMode !== true,
        environmentStrictness: strict ? 'strict' : 'normal',
    };
}

export function isMutatingSql(sql: string): boolean {
    const normalized = sql.trim().toLowerCase();
    if (!normalized) return false;
    return /^(insert|update|delete|drop|alter|create|truncate|grant|revoke|merge|replace)\b/.test(normalized);
}

