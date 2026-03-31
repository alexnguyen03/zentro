import { useSettingsStore } from '../../stores/settingsStore';
import type { QueryPolicy } from './runtime';
import { resolveExecutionPolicyProfile } from './policyProfiles';
import { analyzeSqlRisk } from './writeSafety';

export function resolveQueryPolicy(environmentKey?: string): QueryPolicy {
    const settings = useSettingsStore.getState();
    const profile = resolveExecutionPolicyProfile(environmentKey);
    const timeoutFromSettings = settings.queryTimeout || profile.timeoutSeconds || 60;

    return {
        queryTimeoutSeconds: Math.max(5, timeoutFromSettings),
        rowCapPerTab: Math.max(1000, profile.rowCapPerTab),
        requireWriteConfirm:
            settings.viewMode !== true &&
            (profile.destructiveRules === 'prompt' || profile.destructiveRules === 'block'),
        destructiveRules: profile.destructiveRules,
        environmentStrictness: profile.environmentStrictness,
        safetyLevel: profile.safetyLevel,
        requireProdDoubleConfirm: profile.requireProdDoubleConfirm !== false,
    };
}

export function isMutatingSql(sql: string): boolean {
    return analyzeSqlRisk(sql).hasWrite;
}
