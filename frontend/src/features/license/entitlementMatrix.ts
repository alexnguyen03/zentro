export interface EntitlementPolicy {
    defaultEnabled: boolean;
    requiresActiveLicense?: boolean;
}

export type EntitlementMatrix = Record<string, EntitlementPolicy>;

export const ENTITLEMENT_MATRIX: EntitlementMatrix = {
    'query.execute.basic': { defaultEnabled: true },
    'query.result.search': { defaultEnabled: true },
    'query.result.jump': { defaultEnabled: true },
    'query.result.bookmark': { defaultEnabled: true },
    'query.result.export': { defaultEnabled: true },
    'query.result.compare': { defaultEnabled: true },
    'plugin.ui.commands': { defaultEnabled: true },
    // Tier-ready gate points for later commercial rollout.
    'query.advanced.ai-assist': { defaultEnabled: false, requiresActiveLicense: true },
    'telemetry.cloud.sync': { defaultEnabled: false, requiresActiveLicense: true },
};

