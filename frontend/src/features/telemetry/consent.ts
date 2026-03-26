import type { TelemetryConsentState } from './contracts';

const TELEMETRY_CONSENT_KEY_V1 = 'zentro:telemetry-consent:v1';
const TELEMETRY_CONSENT_KEY_V2 = 'zentro:telemetry-consent:v2';

export function getTelemetryConsent(): TelemetryConsentState {
    try {
        const nextRaw = localStorage.getItem(TELEMETRY_CONSENT_KEY_V2);
        if (nextRaw) {
            const parsed = JSON.parse(nextRaw) as TelemetryConsentState;
            return {
                optedIn: parsed.optedIn === true,
                lastUpdatedAt: parsed.lastUpdatedAt || 0,
                source: parsed.source || 'user',
            };
        }

        const legacyRaw = localStorage.getItem(TELEMETRY_CONSENT_KEY_V1);
        if (!legacyRaw) return { optedIn: false, lastUpdatedAt: 0, source: 'default' };

        const parsedLegacy = JSON.parse(legacyRaw) as TelemetryConsentState;
        const migrated: TelemetryConsentState = {
            optedIn: parsedLegacy.optedIn === true,
            lastUpdatedAt: parsedLegacy.lastUpdatedAt || 0,
            source: 'migration',
        };
        localStorage.setItem(TELEMETRY_CONSENT_KEY_V2, JSON.stringify(migrated));
        return migrated;
    } catch {
        return { optedIn: false, lastUpdatedAt: 0, source: 'default' };
    }
}

export function setTelemetryConsent(optedIn: boolean): TelemetryConsentState {
    const next: TelemetryConsentState = { optedIn, lastUpdatedAt: Date.now(), source: 'user' };
    localStorage.setItem(TELEMETRY_CONSENT_KEY_V2, JSON.stringify(next));
    return next;
}
