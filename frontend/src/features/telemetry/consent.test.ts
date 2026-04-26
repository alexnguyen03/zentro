import { beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEY } from '../../lib/constants';
import { getTelemetryConsent, setTelemetryConsent } from './consent';

describe('telemetry consent', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('persists consent flag', () => {
        const updated = setTelemetryConsent(true);
        expect(updated.optedIn).toBe(true);
        expect(updated.source).toBe('user');
        expect(getTelemetryConsent().optedIn).toBe(true);
    });

    it('returns default consent when value is missing', () => {
        const consent = getTelemetryConsent();
        expect(consent.optedIn).toBe(false);
        expect(consent.lastUpdatedAt).toBe(0);
        expect(consent.source).toBe('default');
    });

    it('reads latest consent key only', () => {
        localStorage.setItem(STORAGE_KEY.TELEMETRY_CONSENT, JSON.stringify({
            optedIn: true,
            lastUpdatedAt: 123,
            source: 'user',
        }));

        const consent = getTelemetryConsent();
        expect(consent.optedIn).toBe(true);
        expect(consent.lastUpdatedAt).toBe(123);
        expect(consent.source).toBe('user');
    });
});
