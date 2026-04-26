import { describe, expect, it } from 'vitest';
import { isMutatingSql, resolveQueryPolicy } from './policy';
import { useSettingsStore } from '../../stores/settingsStore';
import { assignExecutionPolicyProfile, saveExecutionPolicyProfile } from './policyProfiles';

describe('query policy', () => {
    it('detects mutating statements', () => {
        expect(isMutatingSql('UPDATE users SET a = 1')).toBe(true);
        expect(isMutatingSql('delete from users')).toBe(true);
    });

    it('keeps select as non-mutating', () => {
        expect(isMutatingSql('SELECT * FROM users')).toBe(false);
    });

    it('uses assigned execution policy profile for environment', () => {
        useSettingsStore.setState({ queryTimeout: 120, viewMode: false });
        saveExecutionPolicyProfile({
            id: 'team-guarded',
            label: 'Team Guarded',
            timeoutSeconds: 30,
            rowCapPerTab: 25000,
            destructiveRules: 'block',
            environmentStrictness: 'strict',
            safetyLevel: 'strict',
            requireProdDoubleConfirm: true,
        });
        assignExecutionPolicyProfile('dev', 'team-guarded');

        const policy = resolveQueryPolicy('dev');
        expect(policy.rowCapPerTab).toBe(25000);
        expect(policy.destructiveRules).toBe('block');
        expect(policy.environmentStrictness).toBe('strict');
        expect(policy.safetyLevel).toBe('strict');
        expect(policy.requireProdDoubleConfirm).toBe(true);
        expect(policy.strongConfirmFromEnvironment).toBe('pro');
    });
});
