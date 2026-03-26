import type { LicenseState } from './types';
import { ENTITLEMENT_MATRIX } from './entitlementMatrix';

export class FeatureGate {
    constructor(private readonly state: LicenseState) {}

    canUse(featureId: string): boolean {
        const entitlement = this.state.entitlements.find((item) => item.featureId === featureId);
        if (entitlement) {
            return entitlement.enabled === true;
        }
        const policy = ENTITLEMENT_MATRIX[featureId];
        if (!policy) return true;
        if (policy.requiresActiveLicense && this.state.status !== 'active') return false;
        return policy.defaultEnabled;
    }
}
