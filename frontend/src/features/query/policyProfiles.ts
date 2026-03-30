import { ENVIRONMENT_KEY, STORAGE_KEY } from '../../lib/constants';
import type { ExecutionPolicy } from './runtime';

export interface ExecutionPolicyProfile extends ExecutionPolicy {
    id: string;
    label: string;
}

type ExecutionPolicyAssignments = Record<string, string>;

const DEFAULT_PROFILES: Record<string, ExecutionPolicyProfile> = {
    balanced: {
        id: 'balanced',
        label: 'Balanced',
        timeoutSeconds: 60,
        rowCapPerTab: 100000,
        destructiveRules: 'prompt',
        environmentStrictness: 'normal',
    },
    strict_prod: {
        id: 'strict_prod',
        label: 'Strict Production',
        timeoutSeconds: 45,
        rowCapPerTab: 50000,
        destructiveRules: 'block',
        environmentStrictness: 'strict',
    },
    strict_stage: {
        id: 'strict_stage',
        label: 'Strict Staging',
        timeoutSeconds: 60,
        rowCapPerTab: 75000,
        destructiveRules: 'prompt',
        environmentStrictness: 'strict',
    },
};

const DEFAULT_ASSIGNMENTS: ExecutionPolicyAssignments = {
    [ENVIRONMENT_KEY.PRODUCTION]: 'strict_prod',
    [ENVIRONMENT_KEY.STAGING]: 'strict_stage',
};

function readJson<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw) as T;
        return parsed || fallback;
    } catch {
        return fallback;
    }
}

function writeJson<T>(key: string, value: T) {
    localStorage.setItem(key, JSON.stringify(value));
}

export function listExecutionPolicyProfiles(): ExecutionPolicyProfile[] {
    const saved = readJson<Record<string, ExecutionPolicyProfile>>(STORAGE_KEY.EXECUTION_POLICY_PROFILES, {});
    const merged = {
        ...DEFAULT_PROFILES,
        ...saved,
    };
    return Object.values(merged);
}

export function saveExecutionPolicyProfile(profile: ExecutionPolicyProfile) {
    const current = readJson<Record<string, ExecutionPolicyProfile>>(STORAGE_KEY.EXECUTION_POLICY_PROFILES, {});
    writeJson(STORAGE_KEY.EXECUTION_POLICY_PROFILES, {
        ...current,
        [profile.id]: profile,
    });
}

export function assignExecutionPolicyProfile(environmentKey: string, profileId: string) {
    const current = readJson<ExecutionPolicyAssignments>(STORAGE_KEY.EXECUTION_POLICY_ASSIGNMENTS, DEFAULT_ASSIGNMENTS);
    writeJson(STORAGE_KEY.EXECUTION_POLICY_ASSIGNMENTS, {
        ...current,
        [environmentKey]: profileId,
    });
}

export function resolveExecutionPolicyProfile(environmentKey?: string): ExecutionPolicyProfile {
    const profiles = listExecutionPolicyProfiles();
    const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
    const assignments = readJson<ExecutionPolicyAssignments>(STORAGE_KEY.EXECUTION_POLICY_ASSIGNMENTS, DEFAULT_ASSIGNMENTS);
    const assignedProfileId = environmentKey ? assignments[environmentKey] : undefined;
    return (assignedProfileId ? profileById.get(assignedProfileId) : undefined) || DEFAULT_PROFILES.balanced;
}
