import { wailsGateway } from '../../platform/app-api/wailsGateway';
import { runSafe } from '../../shared/kernel/async';
import type { LicenseState } from './types';

function defaultState(): LicenseState {
    return {
        status: 'inactive',
        entitlements: [],
        policy: {
            requireOnlineRefresh: true,
            refreshIntervalMinutes: 30,
        },
    };
}

export async function getLicenseState() {
    return runSafe(
        'license.state.failed',
        'Unable to load license state',
        async () => {
            if (!wailsGateway.GetLicenseState) return defaultState();
            return await wailsGateway.GetLicenseState();
        },
    );
}

