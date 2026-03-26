import { beforeEach, describe, expect, it } from 'vitest';
import {
    assignExecutionPolicyProfile,
    resolveExecutionPolicyProfile,
    saveExecutionPolicyProfile,
} from './policyProfiles';

describe('policyProfiles', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('returns strict default profile for production', () => {
        const profile = resolveExecutionPolicyProfile('pro');
        expect(profile.environmentStrictness).toBe('strict');
        expect(profile.destructiveRules).toBe('block');
    });

    it('supports assigning custom profile per environment', () => {
        saveExecutionPolicyProfile({
            id: 'team-safe',
            label: 'Team Safe',
            timeoutSeconds: 90,
            rowCapPerTab: 30000,
            destructiveRules: 'prompt',
            environmentStrictness: 'strict',
        });
        assignExecutionPolicyProfile('tes', 'team-safe');

        const profile = resolveExecutionPolicyProfile('tes');
        expect(profile.id).toBe('team-safe');
        expect(profile.timeoutSeconds).toBe(90);
    });
});

