import type { LicenseState } from './types';

export class FeatureGate {
    constructor(private readonly state: LicenseState) {}

    canUse(featureId: string): boolean {
        if (this.state.status !== 'active') return false;
        const entitlement = this.state.entitlements.find((item) => item.featureId === featureId);
        return entitlement?.enabled === true;
    }
}

