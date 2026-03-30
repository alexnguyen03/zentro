import React from 'react';
import { getLicenseState } from './service';
import { FeatureGate } from './featureGate';
import type { LicenseState } from './types';

const FALLBACK_STATE: LicenseState = {
    status: 'inactive',
    entitlements: [],
    policy: {
        requireOnlineRefresh: true,
        refreshIntervalMinutes: 30,
    },
};

export function useFeatureGate() {
    const [state, setState] = React.useState<LicenseState>(FALLBACK_STATE);

    React.useEffect(() => {
        let mounted = true;
        void getLicenseState().then((result) => {
            if (!mounted || !result.ok) return;
            setState(result.data);
        });
        return () => {
            mounted = false;
        };
    }, []);

    return React.useMemo(() => new FeatureGate(state), [state]);
}

