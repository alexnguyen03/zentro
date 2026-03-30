import { STORAGE_KEY } from '../../lib/constants';
import type { TelemetryConsentState } from './contracts';

export function getTelemetryConsent(): TelemetryConsentState {
    try {
        const raw = localStorage.getItem(STORAGE_KEY.TELEMETRY_CONSENT);
        if (!raw) return { optedIn: false, lastUpdatedAt: 0, source: 'default' };
        const parsed = JSON.parse(raw) as TelemetryConsentState;
        return {
            optedIn: parsed.optedIn === true,
            lastUpdatedAt: parsed.lastUpdatedAt || 0,
            source: parsed.source || 'user',
        };
    } catch {
        return { optedIn: false, lastUpdatedAt: 0, source: 'default' };
    }
}

export function setTelemetryConsent(optedIn: boolean): TelemetryConsentState {
    const next: TelemetryConsentState = { optedIn, lastUpdatedAt: Date.now(), source: 'user' };
    localStorage.setItem(STORAGE_KEY.TELEMETRY_CONSENT, JSON.stringify(next));
    return next;
}
