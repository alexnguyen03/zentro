import { beforeEach, describe, expect, it } from 'vitest';
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

    it('migrates legacy consent key', () => {
        localStorage.setItem('zentro:telemetry-consent:v1', JSON.stringify({
            optedIn: false,
            lastUpdatedAt: 123,
        }));

        const migrated = getTelemetryConsent();
        expect(migrated.optedIn).toBe(false);
        expect(migrated.lastUpdatedAt).toBe(123);
        expect(migrated.source).toBe('migration');
    });
});
