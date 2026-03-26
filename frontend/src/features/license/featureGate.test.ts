import { describe, expect, it } from 'vitest';
import { FeatureGate } from './featureGate';
import type { LicenseState } from './types';

const activeState: LicenseState = {
    status: 'active',
    entitlements: [
        { featureId: 'plugin.ui.commands', enabled: true },
        { featureId: 'license.online.refresh', enabled: false },
    ],
    policy: {
        requireOnlineRefresh: true,
        refreshIntervalMinutes: 30,
    },
};

describe('FeatureGate', () => {
    it('allows entitlement when license is active', () => {
        const gate = new FeatureGate(activeState);
        expect(gate.canUse('plugin.ui.commands')).toBe(true);
        expect(gate.canUse('license.online.refresh')).toBe(false);
    });

    it('uses matrix defaults when entitlement is missing', () => {
        const gate = new FeatureGate({
            ...activeState,
            status: 'inactive',
            entitlements: [],
        });
        expect(gate.canUse('query.result.compare')).toBe(true);
        expect(gate.canUse('query.advanced.ai-assist')).toBe(false);
    });
});
