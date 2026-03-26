export type ActivationStatus = 'inactive' | 'activating' | 'active' | 'expired' | 'revoked' | 'error';

export interface Entitlement {
    featureId: string;
    enabled: boolean;
    limit?: number;
}

export interface LicensePolicy {
    requireOnlineRefresh: boolean;
    refreshIntervalMinutes: number;
}

export interface LicenseState {
    status: ActivationStatus;
    licenseKeyMasked?: string;
    sessionToken?: string;
    expiresAt?: string;
    entitlements: Entitlement[];
    policy: LicensePolicy;
    lastError?: string;
}

export interface LicenseBackendContract {
    ActivateLicense(key: string, deviceInfo: string): Promise<LicenseState>;
    RefreshLicense(sessionToken: string): Promise<LicenseState>;
    DeactivateLicense(reason: string): Promise<void>;
    GetLicenseState(): Promise<LicenseState>;
}

