import type { TelemetryConsentState } from './localMetricsStore';

const TELEMETRY_CONSENT_KEY = 'zentro:telemetry-consent:v1';

export function getTelemetryConsent(): TelemetryConsentState {
    try {
        const raw = localStorage.getItem(TELEMETRY_CONSENT_KEY);
        if (!raw) return { optedIn: false, lastUpdatedAt: 0 };
        const parsed = JSON.parse(raw) as TelemetryConsentState;
        return {
            optedIn: parsed.optedIn === true,
            lastUpdatedAt: parsed.lastUpdatedAt || 0,
        };
    } catch {
        return { optedIn: false, lastUpdatedAt: 0 };
    }
}

export function setTelemetryConsent(optedIn: boolean): TelemetryConsentState {
    const next = { optedIn, lastUpdatedAt: Date.now() };
    localStorage.setItem(TELEMETRY_CONSENT_KEY, JSON.stringify(next));
    return next;
}

